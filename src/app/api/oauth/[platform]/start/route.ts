import type { Platform } from "@/db/schema";
import { buildAuthUrl, getBaseUrl, isConfigured } from "@/lib/oauth";
import { pkceChallenge, randomToken } from "@/lib/crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID: Platform[] = ["youtube", "instagram", "facebook", "tiktok"];

export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }) {
  const { platform } = await ctx.params;
  const baseUrl = getBaseUrl(req);
  const p = platform as Platform;

  if (!VALID.includes(p)) {
    return NextResponse.redirect(`${baseUrl}/accounts?error=${encodeURIComponent("Platform tidak valid")}`);
  }
  if (!isConfigured(p)) {
    return NextResponse.redirect(
      `${baseUrl}/accounts?error=${encodeURIComponent("OAuth belum dikonfigurasi untuk platform ini. Lihat docs/OAUTH_SETUP.md")}`,
    );
  }

  const state = randomToken(16);
  const verifier = randomToken(32);
  const url = buildAuthUrl(p, baseUrl, state, pkceChallenge(verifier));

  const res = NextResponse.redirect(url);
  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: baseUrl.startsWith("https"), path: "/", maxAge: 600 };
  res.cookies.set("oauth_state", state, cookieOpts);
  res.cookies.set("oauth_verifier", verifier, cookieOpts);
  return res;
}
