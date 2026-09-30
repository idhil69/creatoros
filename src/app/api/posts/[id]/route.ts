import { db } from "@/db";
import { posts, postTargets, socialAccounts, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const postId = Number(id);
  const body = (await req.json()) as {
    action?: "publish" | "unschedule";
    title?: string;
    caption?: string;
    hashtags?: string[];
    scheduledAt?: string | null;
  };

  if (body.action === "publish") {
    await new Promise((r) => setTimeout(r, 1200));
    const targets = await db.select().from(postTargets).where(eq(postTargets.postId, postId));
    for (const t of targets) {
      const [acc] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, t.accountId));
      const followers = acc?.followers ?? 1000;
      await db
        .update(postTargets)
        .set({
          status: "published",
          externalUrl: `https://${t.platform}.com/${acc?.username ?? "user"}/p/${postId}`,
          views: Math.round(followers * 0.08),
          likes: Math.round(followers * 0.006),
          comments: Math.round(followers * 0.0005),
          shares: Math.round(followers * 0.001),
        })
        .where(eq(postTargets.id, t.id));
    }
    await db
      .update(posts)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(posts.id, postId));
    await db.insert(auditLogs).values({ action: "post.published", detail: `Post #${postId}` });
  } else if (body.action === "unschedule") {
    await db.update(posts).set({ status: "draft", scheduledAt: null, updatedAt: new Date() }).where(eq(posts.id, postId));
    await db.update(postTargets).set({ status: "draft" }).where(eq(postTargets.postId, postId));
  } else {
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
    await db
      .update(posts)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        ...(body.hashtags !== undefined ? { hashtags: body.hashtags } : {}),
        ...(body.scheduledAt !== undefined
          ? { scheduledAt: scheduledAt ?? null, status: scheduledAt ? "scheduled" : "draft" }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));
  }

  const [row] = await db.select().from(posts).where(eq(posts.id, postId));
  const targets = await db.select().from(postTargets).where(eq(postTargets.postId, postId));
  return NextResponse.json({ ...row, targets });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  await db.delete(posts).where(eq(posts.id, Number(id)));
  return NextResponse.json({ ok: true });
}
