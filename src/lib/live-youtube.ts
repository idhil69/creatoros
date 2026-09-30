import { db } from "@/db";
import { socialAccounts, type SocialAccount } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";

const YT = "https://www.googleapis.com/youtube/v3";

/** Ambil access token Google yang valid — otomatis refresh jika kedaluwarsa. */
export async function googleAccessToken(account: SocialAccount): Promise<string> {
  const access = account.accessTokenEnc ? decrypt(account.accessTokenEnc) : null;
  if (!access) throw new Error("Token YouTube tidak ditemukan. Hubungkan ulang akun.");

  const stillValid = account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() - Date.now() > 60_000;
  if (stillValid) return access;

  const refresh = account.refreshTokenEnc ? decrypt(account.refreshTokenEnc) : null;
  if (!refresh) return access; // coba saja token lama

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) return access;

  await db
    .update(socialAccounts)
    .set({ accessTokenEnc: encrypt(j.access_token), tokenExpiresAt: new Date(Date.now() + (j.expires_in ?? 3600) * 1000) })
    .where(eq(socialAccounts.id, account.id));
  return j.access_token as string;
}

async function ytFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${YT}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = j?.error?.errors?.[0]?.reason ?? "";
    const msg = j?.error?.message ?? `YouTube API error ${res.status}`;
    if (reason === "liveStreamingNotEnabled") {
      throw new Error("Live streaming belum aktif di channel YouTube kamu. Aktifkan di YouTube Studio → Buat → Live (verifikasi nomor HP, tunggu 24 jam).");
    }
    if (reason === "insufficientPermissions" || res.status === 403) {
      throw new Error("Izin kurang. Putuskan lalu hubungkan ulang akun YouTube untuk memberi izin live streaming.");
    }
    throw new Error(msg);
  }
  return j;
}

const PERSISTENT_STREAM_TITLE = "CreatorOS Persistent";

type YtStreamItem = {
  id: string;
  snippet?: { title?: string };
  cdn?: { ingestionInfo?: { ingestionAddress?: string; streamName?: string } };
};

/**
 * Ambil (atau buat sekali) stream RTMP PERMANEN "CreatorOS Persistent".
 * Kuncinya TIDAK berubah antar siaran → target multistream Livepeer cukup diatur sekali.
 */
async function ytGetOrCreatePersistentStream(token: string): Promise<YtStreamItem> {
  const list = await ytFetch(token, "/liveStreams?part=snippet,cdn&mine=true&maxResults=50");
  const existing = (list.items as YtStreamItem[] | undefined)?.find(
    (s) => s.snippet?.title === PERSISTENT_STREAM_TITLE,
  );
  if (existing?.cdn?.ingestionInfo?.streamName) return existing;

  return (await ytFetch(token, "/liveStreams?part=snippet,cdn", {
    method: "POST",
    body: JSON.stringify({
      snippet: { title: PERSISTENT_STREAM_TITLE },
      cdn: { ingestionType: "rtmp", resolution: "variable", frameRate: "variable" },
    }),
  })) as YtStreamItem;
}

/** Buat broadcast baru, tapi BIND ke stream permanen (key YouTube stabil selamanya). */
export async function ytCreateBroadcast(token: string, title: string, description: string) {
  const broadcast = await ytFetch(token, "/liveBroadcasts?part=snippet,contentDetails,status", {
    method: "POST",
    body: JSON.stringify({
      snippet: { title: title.slice(0, 100), description, scheduledStartTime: new Date().toISOString() },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: true, monitorStream: { enableMonitorStream: false } },
    }),
  });

  const stream = await ytGetOrCreatePersistentStream(token);

  await ytFetch(token, `/liveBroadcasts/bind?id=${broadcast.id}&streamId=${stream.id}&part=id`, { method: "POST" });

  const ing = stream.cdn?.ingestionInfo ?? {};
  return {
    broadcastId: broadcast.id as string,
    videoId: broadcast.id as string,
    chatId: (broadcast.snippet?.liveChatId ?? "") as string,
    rtmpUrl: (ing.ingestionAddress ?? "rtmp://a.rtmp.youtube.com/live2") as string,
    streamKey: (ing.streamName ?? "") as string,
  };
}

export type YtChatItem = {
  externalId: string;
  authorChannelId: string;
  author: string;
  text: string;
  isSuperChat: boolean;
  amount: number;
};

/** Ambil pesan chat baru sejak pageToken terakhir. */
export async function ytPollChat(token: string, chatId: string, pageToken?: string) {
  const p = new URLSearchParams({ liveChatId: chatId, part: "snippet,authorDetails", maxResults: "50" });
  if (pageToken) p.set("pageToken", pageToken);
  const j = await ytFetch(token, `/liveChat/messages?${p}`);
  const items: YtChatItem[] = (j.items ?? [])
    .filter((i: { snippet?: { type?: string } }) => ["textMessageEvent", "superChatEvent"].includes(i.snippet?.type ?? ""))
    .map((i: { id: string; snippet: { type: string; displayMessage?: string; superChatDetails?: { amountDisplayString?: string; amountMicros?: string } }; authorDetails: { channelId: string; displayName: string } }) => ({
      externalId: i.id,
      authorChannelId: i.authorDetails.channelId,
      author: i.authorDetails.displayName,
      text: i.snippet.displayMessage ?? "",
      isSuperChat: i.snippet.type === "superChatEvent",
      amount: i.snippet.superChatDetails ? Math.round(Number(i.snippet.superChatDetails.amountMicros ?? 0) / 1_000_000) : 0,
    }));
  return { items, nextPageToken: (j.nextPageToken ?? "") as string };
}

/** Kirim pesan ke live chat YouTube asli. */
export async function ytSendChat(token: string, chatId: string, text: string) {
  await ytFetch(token, "/liveChat/messages?part=snippet", {
    method: "POST",
    body: JSON.stringify({
      snippet: { liveChatId: chatId, type: "textMessageEvent", textMessageDetails: { messageText: text.slice(0, 200) } },
    }),
  });
}

/** Jumlah penonton bersamaan + status siaran asli. */
export async function ytStats(token: string, videoId: string) {
  const j = await ytFetch(token, `/videos?part=liveStreamingDetails,statistics&id=${videoId}`);
  const v = j.items?.[0];
  return {
    viewers: v?.liveStreamingDetails?.concurrentViewers ? Number(v.liveStreamingDetails.concurrentViewers) : 0,
    likes: v?.statistics?.likeCount ? Number(v.statistics.likeCount) : 0,
    actualStartTime: v?.liveStreamingDetails?.actualStartTime as string | undefined,
  };
}

/** Status ingest asli dari YouTube: apakah data video benar-benar masuk? */
export async function ytIngestStatus(token: string, broadcastId: string) {
  const b = await ytFetch(token, `/liveBroadcasts?part=contentDetails,status&id=${broadcastId}`);
  const item = b.items?.[0];
  const lifeCycle = (item?.status?.lifeCycleStatus ?? "unknown") as string;
  const boundStreamId = item?.contentDetails?.boundStreamId as string | undefined;
  if (!boundStreamId) return { lifeCycle, streamStatus: "unknown", health: "noData" };
  const s = await ytFetch(token, `/liveStreams?part=status&id=${boundStreamId}`);
  const st = s.items?.[0]?.status;
  return {
    lifeCycle,
    streamStatus: (st?.streamStatus ?? "unknown") as string, // active | ready | inactive | error
    health: (st?.healthStatus?.status ?? "noData") as string, // good | ok | bad | noData
  };
}

/** Akhiri broadcast YouTube. */
export async function ytEndBroadcast(token: string, broadcastId: string) {
  try {
    await ytFetch(token, `/liveBroadcasts/transition?broadcastStatus=complete&id=${broadcastId}&part=status`, { method: "POST" });
  } catch {
    /* sudah berakhir via enableAutoStop — abaikan */
  }
}
