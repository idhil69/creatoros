import { db } from "@/db";
import { socialAccounts, auditLogs } from "@/db/schema";
import { sanitizeAccount } from "@/lib/sanitize";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [row] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, Number(id)));
  if (!row) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json(sanitizeAccount(row));
}

// Actions: refresh token, simulate expiry, reconnect
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { action } = (await req.json()) as { action: "refresh" | "expire" | "sync" };
  const accountId = Number(id);

  await new Promise((r) => setTimeout(r, 800));

  if (action === "expire") {
    await db
      .update(socialAccounts)
      .set({ status: "expired", errorMessage: "Token kedaluwarsa, silakan hubungkan ulang" })
      .where(eq(socialAccounts.id, accountId));
  } else if (action === "refresh") {
    await db
      .update(socialAccounts)
      .set({
        status: "connected",
        errorMessage: null,
        tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60),
        lastSyncedAt: new Date(),
      })
      .where(eq(socialAccounts.id, accountId));
    await db.insert(auditLogs).values({ action: "token.refreshed", detail: `Akun #${accountId}` });
  } else if (action === "sync") {
    const [acc] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, accountId));
    if (acc) {
      await db
        .update(socialAccounts)
        .set({ lastSyncedAt: new Date(), followers: acc.followers + Math.round(acc.followers * 0.002) })
        .where(eq(socialAccounts.id, accountId));
    }
  }
  const [row] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, accountId));
  return NextResponse.json(sanitizeAccount(row));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [row] = await db.delete(socialAccounts).where(eq(socialAccounts.id, Number(id))).returning();
  if (row) {
    await db.insert(auditLogs).values({
      action: "account.disconnected",
      detail: `${row.platform} ${row.username} diputus`,
    });
  }
  return NextResponse.json({ ok: true });
}
