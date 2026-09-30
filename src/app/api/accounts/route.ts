import { db } from "@/db";
import { socialAccounts, auditLogs, type Platform } from "@/db/schema";
import { PLATFORMS, AVATAR_COLORS } from "@/lib/platforms";
import { sanitizeAccount } from "@/lib/sanitize";
import { seedAnalyticsFor } from "@/lib/seed-analytics";
import { desc, eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(socialAccounts).orderBy(desc(socialAccounts.createdAt));
  return NextResponse.json(rows.map(sanitizeAccount));
}

// Mock OAuth: create account with "pending" then seed analytics after "callback"
export async function POST(req: Request) {
  const body = (await req.json()) as { platform?: Platform; simulateError?: boolean };
  const platform = body.platform;
  if (!platform || !PLATFORMS[platform]) {
    return NextResponse.json({ error: "Platform tidak valid" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.platform, platform)));
  const meta = PLATFORMS[platform];
  const user = meta.mockUsers[existing.length % meta.mockUsers.length];

  // Simulate OAuth 2.0 + PKCE round trip (2s delay like the Flutter mock)
  await new Promise((r) => setTimeout(r, 1500));

  if (body.simulateError) {
    await db.insert(auditLogs).values({
      action: "oauth.failed",
      detail: `${meta.name}: pengguna membatalkan otorisasi`,
    });
    return NextResponse.json(
      { error: "Otorisasi dibatalkan oleh pengguna (mock error)" },
      { status: 400 },
    );
  }

  const [account] = await db
    .insert(socialAccounts)
    .values({
      platform,
      isMock: true,
      username: user.username,
      displayName: user.displayName,
      followers: user.followers,
      avatarColor: AVATAR_COLORS[(existing.length + Object.keys(PLATFORMS).indexOf(platform)) % AVATAR_COLORS.length],
      status: "connected",
      scopes: meta.scopes,
      tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
      lastSyncedAt: new Date(),
    })
    .returning();

  await seedAnalyticsFor(account.id, platform, user.followers);
  await db.insert(auditLogs).values({
    action: "account.connected",
    detail: `${meta.name} ${user.username} terhubung (mock)`,
  });

  return NextResponse.json(sanitizeAccount(account), { status: 201 });
}
