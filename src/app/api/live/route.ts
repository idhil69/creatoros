import { db } from "@/db";
import {
  liveStreams,
  liveMessages,
  socialAccounts,
  auditLogs,
  type Platform,
  type StreamHealth,
  type LiveExternal,
} from "@/db/schema";
import { googleAccessToken, ytCreateBroadcast, ytEndBroadcast, ytIngestStatus, ytPollChat, ytSendChat, ytStats } from "@/lib/live-youtube";
import { desc, eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUTHORS = ["rina_92", "budi.gaming", "sasha✨", "dimas_ok", "nurul.a", "kevinn", "tari_tari", "adit", "mega.putri", "yoga_fx", "lala.chan", "farhan01"];
const CHATS = [
  "Halo kak! 👋", "Semangat terus kontennya 🔥", "Salam dari Surabaya!", "Baru pertama nonton live, keren!",
  "Suaranya jelas banget", "Kapan kolab lagi?", "🔥🔥🔥", "First!", "Wkwkwk ngakak", "Setuju banget kak",
  "Nonton dari Medan nih", "Lanjut kak jangan berhenti", "Backgroundnya estetik 😍", "Mantap!", "Kak sapa dong",
];
const QUESTIONS = [
  "Kak spill kameranya apa?", "Kak bahas tips editing dong", "Aplikasi edit yang dipakai apa kak?", "Tips dapet sponsor pertama gimana?",
  "Berapa lama bikin satu video kak?", "Kak, mic yang dipakai apa?", "Gimana cara konsisten upload?",
];
const GIFTS = [
  { name: "Mawar 🌹", amount: 5 }, { name: "Kopi ☕", amount: 20 }, { name: "Roket 🚀", amount: 100 },
  { name: "Singa 🦁", amount: 500 }, { name: "Super Chat 💛", amount: 50 },
];

async function getActive() {
  const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.isLive, true)).orderBy(desc(liveStreams.id)).limit(1);
  return stream ?? null;
}

function genKey(platform: Platform) {
  const r = () => Math.random().toString(36).slice(2, 6);
  return `${platform.slice(0, 2)}-${r()}-${r()}-${r()}-${r()}`;
}

export async function GET() {
  const stream = await getActive();
  const history = await db.select().from(liveStreams).where(eq(liveStreams.isLive, false)).orderBy(desc(liveStreams.id)).limit(10);
  if (!stream) return NextResponse.json({ stream: null, messages: [], history });

  const platforms = stream.platforms.length ? stream.platforms : (["youtube"] as Platform[]);
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const external: LiveExternal = { ...stream.external };
  const realPlatforms = new Set<Platform>(external.youtube ? (["youtube"] as Platform[]) : []);
  const breakdown: Partial<Record<Platform, number>> = { ...stream.viewerBreakdown };
  let likes = stream.likes;
  let newFollowers = stream.newFollowers;
  let giftsTotal = stream.giftsTotal;

  // ===== LIVE ASLI: tarik chat + penonton YouTube sungguhan (throttle ±5 dtk) =====
  if (external.youtube && Date.now() - (external.youtube.lastPollAt ?? 0) > 4500) {
    external.youtube.lastPollAt = Date.now();
    try {
      const [acc] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, external.youtube.accountId));
      if (acc) {
        const token = await googleAccessToken(acc);
        if (external.youtube.chatId) {
          const chat = await ytPollChat(token, external.youtube.chatId, external.youtube.nextPageToken || undefined);
          external.youtube.nextPageToken = chat.nextPageToken;
          for (const m of chat.items) {
            if (m.authorChannelId === acc.externalId) continue; // pesan host sudah dicatat lokal
            if (stream.blockedAuthors.includes(m.author)) continue;
            if (!m.text) continue;
            if (m.isSuperChat) giftsTotal += m.amount;
            await db.insert(liveMessages).values({
              streamId: stream.id,
              platform: "youtube",
              author: m.author,
              message: m.isSuperChat ? `${m.text} (Super Chat)` : m.text,
              type: m.isSuperChat ? "gift" : m.text.includes("?") ? "question" : "chat",
              amount: m.amount,
            });
          }
        }
        const s = await ytStats(token, external.youtube.videoId);
        breakdown.youtube = s.viewers;
        if (s.likes > likes) likes = s.likes;
        try {
          external.youtube.ingest = await ytIngestStatus(token, external.youtube.broadcastId);
        } catch {
          /* diagnosa opsional */
        }
        external.youtube.lastError = undefined;
      }
    } catch (e) {
      external.youtube.lastError = (e as Error).message;
    }
  }

  // ===== SIMULASI: hanya untuk platform yang bukan live asli =====
  const simPlatforms = platforms.filter((p) => !realPlatforms.has(p));
  const count = (await db.select({ id: liveMessages.id }).from(liveMessages).where(eq(liveMessages.streamId, stream.id))).length;
  if (simPlatforms.length && count < 400) {
    const roll = Math.random();
    const author = pick(AUTHORS);
    if (!stream.blockedAuthors.includes(author)) {
      if (roll < 0.55) {
        await db.insert(liveMessages).values({ streamId: stream.id, platform: pick(simPlatforms), author, message: pick(CHATS), type: "chat" });
      } else if (roll < 0.72) {
        await db.insert(liveMessages).values({ streamId: stream.id, platform: pick(simPlatforms), author, message: pick(QUESTIONS), type: "question" });
      } else if (roll < 0.82) {
        const g = pick(GIFTS);
        giftsTotal += g.amount;
        await db.insert(liveMessages).values({ streamId: stream.id, platform: pick(simPlatforms), author, message: `mengirim ${g.name}`, type: "gift", amount: g.amount });
      } else if (roll < 0.9) {
        newFollowers += 1;
        await db.insert(liveMessages).values({ streamId: stream.id, platform: pick(simPlatforms), author, message: "mulai mengikuti kamu", type: "follow" });
      }
    }
    likes += Math.floor(Math.random() * 6);
  }

  const elapsedMin = stream.startedAt ? (Date.now() - new Date(stream.startedAt).getTime()) / 60000 : 0;
  for (const p of simPlatforms) {
    const cur = breakdown[p] ?? 5;
    const drift = elapsedMin < 5 ? Math.random() * 12 - 2 : Math.random() * 14 - 7;
    breakdown[p] = Math.max(1, Math.round(cur + drift));
  }
  const viewers = Object.values(breakdown).reduce((a, b) => a + (b ?? 0), 0);
  const peakViewers = Math.max(stream.peakViewers, viewers);

  const healthRoll = Math.random();
  const health: StreamHealth = healthRoll < 0.8 ? "excellent" : healthRoll < 0.95 ? "good" : "poor";
  const bitrateKbps = health === "excellent" ? 4300 + Math.round(Math.random() * 400) : health === "good" ? 3200 + Math.round(Math.random() * 600) : 1200 + Math.round(Math.random() * 800);
  const fps = health === "poor" ? 22 + Math.round(Math.random() * 5) : 30;
  const droppedFrames = stream.droppedFrames + (health === "poor" ? Math.round(Math.random() * 20) : health === "good" ? Math.round(Math.random() * 3) : 0);

  await db
    .update(liveStreams)
    .set({ viewers, peakViewers, viewerBreakdown: breakdown, likes, newFollowers, giftsTotal, health, bitrateKbps, fps, droppedFrames, external })
    .where(eq(liveStreams.id, stream.id));

  const messages = await db
    .select()
    .from(liveMessages)
    .where(and(eq(liveMessages.streamId, stream.id), eq(liveMessages.isDeleted, false)))
    .orderBy(desc(liveMessages.id))
    .limit(80);

  return NextResponse.json({
    stream: { ...stream, viewers, peakViewers, viewerBreakdown: breakdown, likes, newFollowers, giftsTotal, health, bitrateKbps, fps, droppedFrames, external },
    messages: messages.reverse(),
    history,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    title: string;
    description?: string;
    category?: string;
    platforms: Platform[];
    latencyMode?: "low" | "normal" | "ultra";
  };
  const existing = await getActive();
  if (existing) return NextResponse.json({ error: "Sudah ada live yang berjalan" }, { status: 409 });
  if (!body.title?.trim()) return NextResponse.json({ error: "Judul wajib diisi" }, { status: 400 });

  const accounts = await db.select().from(socialAccounts);
  const platforms = (body.platforms ?? []).filter((p) => accounts.some((a) => a.platform === p && a.status === "connected"));
  if (!platforms.length) return NextResponse.json({ error: "Pilih minimal satu platform terhubung" }, { status: 400 });

  // ===== LIVE ASLI: buat broadcast YouTube sungguhan jika akun asli tersedia =====
  const external: LiveExternal = {};
  let isReal = false;
  let realStreamKey = "";
  const ytAccount = accounts.find((a) => a.platform === "youtube" && a.status === "connected" && !a.isMock && a.accessTokenEnc);
  if (platforms.includes("youtube") && ytAccount) {
    try {
      const token = await googleAccessToken(ytAccount);
      const b = await ytCreateBroadcast(token, body.title.trim(), body.description ?? "Live via CreatorOS");
      external.youtube = { accountId: ytAccount.id, ...b };
      realStreamKey = b.streamKey;
      isReal = true;
    } catch (e) {
      return NextResponse.json({ error: `YouTube Live gagal dibuat: ${(e as Error).message}` }, { status: 400 });
    }
  }

  const breakdown: Partial<Record<Platform, number>> = {};
  platforms.forEach((p) => (breakdown[p] = p === "youtube" && external.youtube ? 0 : 3 + Math.floor(Math.random() * 8)));
  const viewers = Object.values(breakdown).reduce((a, b) => a + (b ?? 0), 0);

  const [stream] = await db
    .insert(liveStreams)
    .values({
      title: body.title.trim(),
      description: body.description ?? "",
      category: body.category ?? "Just Chatting",
      platforms,
      isLive: true,
      isReal,
      external,
      viewers,
      peakViewers: viewers,
      viewerBreakdown: breakdown,
      latencyMode: body.latencyMode ?? "low",
      streamKey: realStreamKey || genKey(platforms[0]),
      startedAt: new Date(),
    })
    .returning();

  await db.insert(liveMessages).values({
    streamId: stream.id,
    platform: platforms[0],
    author: "CreatorOS",
    message: external.youtube
      ? "🔴 Broadcast YouTube ASLI dibuat! Hubungkan encoder (Larix/OBS) dengan RTMP di tab Kontrol — siaran mulai otomatis saat encoder terhubung."
      : `Siaran dimulai di ${platforms.length} platform. Selamat streaming! 🎉`,
    type: "system",
    isPinned: true,
  });
  await db.insert(auditLogs).values({
    action: isReal ? "live.started.real" : "live.started",
    detail: `"${stream.title}" → ${platforms.join(", ")}${isReal ? " (YouTube asli)" : ""}`,
  });
  return NextResponse.json(stream, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    action: "end" | "send" | "pin" | "unpin" | "delete" | "block" | "unblock" | "answer" | "slowmode" | "title";
    message?: string;
    messageId?: number;
    author?: string;
    title?: string;
    platform?: Platform;
  };
  const stream = await getActive();
  if (!stream) return NextResponse.json({ error: "Tidak ada live aktif" }, { status: 404 });
  const external = stream.external;

  switch (body.action) {
    case "end": {
      if (external.youtube) {
        try {
          const [acc] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, external.youtube.accountId));
          if (acc) await ytEndBroadcast(await googleAccessToken(acc), external.youtube.broadcastId);
        } catch {
          /* biarkan enableAutoStop yang menutup */
        }
      }
      await db.update(liveStreams).set({ isLive: false, endedAt: new Date() }).where(eq(liveStreams.id, stream.id));
      const dur = stream.startedAt ? Math.round((Date.now() - new Date(stream.startedAt).getTime()) / 60000) : 0;
      await db.insert(auditLogs).values({ action: "live.ended", detail: `"${stream.title}" · ${dur} menit · puncak ${stream.peakViewers} penonton` });
      return NextResponse.json({ ok: true, summaryId: stream.id });
    }
    case "send":
      if (body.message?.trim()) {
        const text = body.message.trim();
        if (external.youtube?.chatId) {
          try {
            const [acc] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, external.youtube.accountId));
            if (acc) await ytSendChat(await googleAccessToken(acc), external.youtube.chatId, text);
          } catch {
            /* tetap catat lokal */
          }
        }
        await db.insert(liveMessages).values({
          streamId: stream.id,
          platform: body.platform ?? stream.platforms[0] ?? "youtube",
          author: "Host",
          message: text,
          type: "chat",
        });
      }
      break;
    case "pin":
      if (body.messageId) {
        await db.update(liveMessages).set({ isPinned: false }).where(eq(liveMessages.streamId, stream.id));
        await db.update(liveMessages).set({ isPinned: true }).where(eq(liveMessages.id, body.messageId));
      }
      break;
    case "unpin":
      await db.update(liveMessages).set({ isPinned: false }).where(eq(liveMessages.streamId, stream.id));
      break;
    case "delete":
      if (body.messageId) await db.update(liveMessages).set({ isDeleted: true, isPinned: false }).where(eq(liveMessages.id, body.messageId));
      break;
    case "block":
      if (body.author && !stream.blockedAuthors.includes(body.author)) {
        await db.update(liveStreams).set({ blockedAuthors: [...stream.blockedAuthors, body.author] }).where(eq(liveStreams.id, stream.id));
        await db
          .update(liveMessages)
          .set({ isDeleted: true, isPinned: false })
          .where(and(eq(liveMessages.streamId, stream.id), eq(liveMessages.author, body.author)));
      }
      break;
    case "unblock":
      if (body.author) {
        await db.update(liveStreams).set({ blockedAuthors: stream.blockedAuthors.filter((a) => a !== body.author) }).where(eq(liveStreams.id, stream.id));
      }
      break;
    case "answer":
      if (body.messageId) await db.update(liveMessages).set({ isAnswered: true }).where(eq(liveMessages.id, body.messageId));
      break;
    case "slowmode":
      await db.update(liveStreams).set({ slowMode: !stream.slowMode }).where(eq(liveStreams.id, stream.id));
      break;
    case "title":
      if (body.title?.trim()) await db.update(liveStreams).set({ title: body.title.trim() }).where(eq(liveStreams.id, stream.id));
      break;
  }
  return NextResponse.json({ ok: true });
}
