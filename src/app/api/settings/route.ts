import { db } from "@/db";
import { appSettings, auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, string> = {
  creatorName: "Kreator Studio",
  mockMode: "true",
  notifications: "true",
  timezone: "Asia/Jakarta",
  autoHashtags: "true",
};

export async function GET() {
  const rows = await db.select().from(appSettings);
  const settings = { ...DEFAULTS };
  rows.forEach((r) => (settings[r.key] = r.value));
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20);
  return NextResponse.json({ settings, logs });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(appSettings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: String(value) } });
  }
  return NextResponse.json({ ok: true });
}
