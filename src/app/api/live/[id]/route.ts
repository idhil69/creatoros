import { db } from "@/db";
import { liveStreams, liveMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, Number(id)));
  if (!stream) return NextResponse.json({ error: "Siaran tidak ditemukan" }, { status: 404 });

  const msgs = await db.select().from(liveMessages).where(and(eq(liveMessages.streamId, stream.id), eq(liveMessages.isDeleted, false)));
  const byType = { chat: 0, question: 0, gift: 0, follow: 0, system: 0 };
  const byPlatform: Record<string, number> = {};
  const topFans: Record<string, number> = {};
  for (const m of msgs) {
    byType[m.type] += 1;
    byPlatform[m.platform] = (byPlatform[m.platform] ?? 0) + 1;
    if (m.author !== "Host" && m.author !== "CreatorOS") topFans[m.author] = (topFans[m.author] ?? 0) + 1 + m.amount;
  }
  const durationSec = stream.startedAt ? Math.round(((stream.endedAt ? new Date(stream.endedAt) : new Date()).getTime() - new Date(stream.startedAt).getTime()) / 1000) : 0;

  return NextResponse.json({
    stream,
    durationSec,
    totalMessages: msgs.length,
    byType,
    byPlatform,
    topFans: Object.entries(topFans)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([author, score]) => ({ author, score })),
    questions: msgs.filter((m) => m.type === "question").slice(-10),
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(liveStreams).where(eq(liveStreams.id, Number(id)));
  return NextResponse.json({ ok: true });
}
