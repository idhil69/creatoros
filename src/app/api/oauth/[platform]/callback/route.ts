import { db } from "@/db";
import { auditLogs, socialAccounts, type Platform } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, fetchProfile, getBaseUrl } from "@/lib/oauth";
import { AVATAR_COLORS, PLATFORMS } from "@/lib/platforms";
import { seedAnalyticsFor } from "@/lib/seed-analytics";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID: Platform[] = ["youtube", "instagram", "facebook", "tiktok"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const baseUrl = getBaseUrl(req);
  const p = platform as Platform;
  const fail = (msg: string) => {
    const res = NextResponse.redirect(`${baseUrl}/accounts?error=${encodeURIComponent(msg)}`);
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_verifier");
    return res;
  };

  if (!VALID.includes(p)) return fail("Platform tidak valid");

  const sp = req.nextUrl.searchParams;
  const providerError = sp.get("error_description") ?? sp.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "Otorisasi dibatalkan" : providerError);

  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;
  const verifier = req.cookies.get("oauth_verifier")?.value ?? "";

  if (!code) return fail("Kode otorisasi tidak ditemukan");
  if (!state || !cookieState || state !== cookieState) return fail("Validasi state gagal — silakan coba lagi");

  try {
    const tokens = await exchangeCode(p, baseUrl, code, verifier);
    const profile = await fetchProfile(p, tokens.accessToken);

    const values = {
      username: profile.username,
      displayName: profile.displayName,
      followers: profile.followers,
      status: "connected" as const,
      isMock: false,
      scopes: PLATFORMS[p].scopes,
      accessTokenEnc: encrypt(tokens.accessToken),
      refreshTokenEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
      lastSyncedAt: new Date(),
      errorMessage: null,
    };

    // Upsert berdasarkan platform + externalId (hubungkan ulang = update, bukan duplikat)
    const [existing] = await db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.platform, p), eq(socialAccounts.externalId, profile.externalId)));

    let accountId: number;
    if (existing) {
      await db.update(socialAccounts).set(values).where(eq(socialAccounts.id, existing.id));
      accountId = existing.id;
    } else {
      const count = (await db.select({ id: socialAccounts.id }).from(socialAccounts)).length;
      const [row] = await db
        .insert(socialAccounts)
        .values({ platform: p, externalId: profile.externalId, avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length], ...values })
        .returning();
      accountId = row.id;
      await seedAnalyticsFor(accountId, p, profile.followers);
    }

    await db.insert(auditLogs).values({
      action: existing ? "oauth.reconnected" : "oauth.connected",
      detail: `${PLATFORMS[p].name} ${profile.username} (asli) terhubung`,
    });

    const res = NextResponse.redirect(`${baseUrl}/accounts?connected=${encodeURIComponent(profile.displayName)}`);
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_verifier");
    return res;
  } catch (e) {
    await db.insert(auditLogs).values({ action: "oauth.failed", detail: `${PLATFORMS[p].name}: ${(e as Error).message}` });
    return fail((e as Error).message);
  }
}
