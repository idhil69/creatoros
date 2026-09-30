import type { Platform } from "@/db/schema";

export type OAuthProfile = {
  externalId: string;
  username: string;
  displayName: string;
  followers: number;
};

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
};

const env = (k: string) => process.env[k]?.trim() || "";

export const OAUTH_ENV: Record<Platform, { id: string; secret: string }> = {
  youtube: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  facebook: { id: "FACEBOOK_APP_ID", secret: "FACEBOOK_APP_SECRET" },
  instagram: { id: "FACEBOOK_APP_ID", secret: "FACEBOOK_APP_SECRET" },
  tiktok: { id: "TIKTOK_CLIENT_KEY", secret: "TIKTOK_CLIENT_SECRET" },
};

export function isConfigured(platform: Platform): boolean {
  const e = OAUTH_ENV[platform];
  return Boolean(env(e.id) && env(e.secret));
}

export function getBaseUrl(req: Request): string {
  if (env("APP_URL")) return env("APP_URL").replace(/\/$/, "");
  const h = new Headers(req.headers);
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export function redirectUri(baseUrl: string, platform: Platform): string {
  return `${baseUrl}/api/oauth/${platform}/callback`;
}

const SCOPES: Record<Platform, string> = {
  youtube:
    "openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl",
  facebook: "public_profile,pages_show_list,pages_read_engagement",
  instagram: "public_profile,pages_show_list,instagram_basic",
  tiktok: "user.info.basic,user.info.profile,user.info.stats",
};

export function buildAuthUrl(platform: Platform, baseUrl: string, state: string, codeChallenge: string): string {
  const cid = env(OAUTH_ENV[platform].id);
  const cb = redirectUri(baseUrl, platform);
  switch (platform) {
    case "youtube": {
      const p = new URLSearchParams({
        client_id: cid,
        redirect_uri: cb,
        response_type: "code",
        scope: SCOPES.youtube,
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
    }
    case "facebook":
    case "instagram": {
      const p = new URLSearchParams({
        client_id: cid,
        redirect_uri: cb,
        response_type: "code",
        scope: SCOPES[platform],
        state,
      });
      return `https://www.facebook.com/v21.0/dialog/oauth?${p}`;
    }
    case "tiktok": {
      const p = new URLSearchParams({
        client_key: cid,
        redirect_uri: cb,
        response_type: "code",
        scope: SCOPES.tiktok,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
    }
  }
}

export async function exchangeCode(platform: Platform, baseUrl: string, code: string, codeVerifier: string): Promise<TokenSet> {
  const cid = env(OAUTH_ENV[platform].id);
  const secret = env(OAUTH_ENV[platform].secret);
  const cb = redirectUri(baseUrl, platform);

  if (platform === "youtube") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cid,
        client_secret: secret,
        redirect_uri: cb,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });
    const j = await res.json();
    if (!res.ok || !j.access_token) throw new Error(j.error_description ?? j.error ?? "Gagal menukar kode Google");
    return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in };
  }

  if (platform === "facebook" || platform === "instagram") {
    const p = new URLSearchParams({ client_id: cid, client_secret: secret, redirect_uri: cb, code });
    const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${p}`);
    const j = await res.json();
    if (!res.ok || !j.access_token) throw new Error(j.error?.message ?? "Gagal menukar kode Facebook");
    return { accessToken: j.access_token, expiresIn: j.expires_in };
  }

  // tiktok
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: cid,
      client_secret: secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: cb,
      code_verifier: codeVerifier,
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error(j.error_description ?? j.error ?? "Gagal menukar kode TikTok");
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in };
}

export async function fetchProfile(platform: Platform, accessToken: string): Promise<OAuthProfile> {
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } };

  if (platform === "youtube") {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", auth);
    const j = await res.json();
    const ch = j.items?.[0];
    if (ch) {
      return {
        externalId: ch.id,
        username: ch.snippet?.customUrl ?? `@${(ch.snippet?.title ?? "channel").replace(/\s+/g, "").toLowerCase()}`,
        displayName: ch.snippet?.title ?? "Channel YouTube",
        followers: Number(ch.statistics?.subscriberCount ?? 0),
      };
    }
    // Akun Google tanpa channel YouTube → pakai profil dasar
    const u = await (await fetch("https://www.googleapis.com/oauth2/v2/userinfo", auth)).json();
    if (!u.id) throw new Error("Tidak bisa membaca profil Google");
    return { externalId: u.id, username: u.email ?? "google-user", displayName: u.name ?? "Akun Google", followers: 0 };
  }

  if (platform === "facebook") {
    const me = await (await fetch("https://graph.facebook.com/v21.0/me?fields=id,name", auth)).json();
    if (!me.id) throw new Error(me.error?.message ?? "Tidak bisa membaca profil Facebook");
    const pages = await (await fetch("https://graph.facebook.com/v21.0/me/accounts?fields=id,name,followers_count,fan_count", auth)).json();
    const page = pages.data?.[0];
    if (page) {
      return {
        externalId: page.id,
        username: page.name,
        displayName: page.name,
        followers: Number(page.followers_count ?? page.fan_count ?? 0),
      };
    }
    return { externalId: me.id, username: me.name, displayName: me.name, followers: 0 };
  }

  if (platform === "instagram") {
    const pages = await (
      await fetch("https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account{id,username,name,followers_count}", auth)
    ).json();
    const ig = pages.data?.map((p: { instagram_business_account?: { id: string; username?: string; name?: string; followers_count?: number } }) => p.instagram_business_account).find(Boolean);
    if (!ig) {
      throw new Error(
        "Tidak ditemukan akun Instagram Business/Creator yang tertaut ke Halaman Facebook kamu. Ubah akun IG ke Professional lalu tautkan ke sebuah Halaman.",
      );
    }
    return {
      externalId: ig.id,
      username: `@${ig.username ?? "instagram"}`,
      displayName: ig.name ?? ig.username ?? "Instagram",
      followers: Number(ig.followers_count ?? 0),
    };
  }

  // tiktok
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,follower_count", auth);
  const j = await res.json();
  const u = j.data?.user;
  if (!u?.open_id) throw new Error(j.error?.message ?? "Tidak bisa membaca profil TikTok");
  return {
    externalId: u.open_id,
    username: u.username ? `@${u.username}` : "@tiktok-user",
    displayName: u.display_name ?? "Akun TikTok",
    followers: Number(u.follower_count ?? 0),
  };
}
