import { db } from "@/db";
import { posts, postTargets, socialAccounts, auditLogs, type PostStatus } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const THUMBS = ["#fbbf24", "#f59e0b", "#ea580c", "#b45309", "#fde68a", "#c2410c"];

export async function GET() {
  const rows = await db.select().from(posts).orderBy(desc(posts.createdAt));
  const ids = rows.map((r) => r.id);
  const targets = ids.length
    ? await db.select().from(postTargets).where(inArray(postTargets.postId, ids))
    : [];
  return NextResponse.json(
    rows.map((p) => ({ ...p, targets: targets.filter((t) => t.postId === p.id) })),
  );
}

import { publishToPlatform } from "@/lib/publisher";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    title: string;
    caption?: string;
    hashtags?: string[];
    mediaType?: "video" | "image" | "short" | "text";
    mediaUrl?: string | null;
    accountIds: number[];
    scheduledAt?: string | null;
    publishNow?: boolean;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Judul wajib diisi" }, { status: 400 });
  }
  if (!body.accountIds?.length) {
    return NextResponse.json({ error: "Pilih minimal satu akun tujuan" }, { status: 400 });
  }

  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(inArray(socialAccounts.id, body.accountIds));

  let initialStatus: PostStatus = body.publishNow ? "publishing" : body.scheduledAt ? "scheduled" : "draft";
  const count = (await db.select({ id: posts.id }).from(posts)).length;

  const [post] = await db
    .insert(posts)
    .values({
      title: body.title.trim(),
      caption: body.caption ?? "",
      hashtags: body.hashtags ?? [],
      mediaType: body.mediaType ?? "video",
      mediaUrl: body.mediaUrl ?? null,
      thumbnailColor: THUMBS[count % THUMBS.length],
      status: initialStatus,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      publishedAt: body.publishNow ? new Date() : null,
    })
    .returning();

  let hasPublished = false;

  for (const a of accounts) {
    if (body.publishNow) {
      const pubResult = await publishToPlatform(
        {
          title: post.title,
          caption: post.caption,
          hashtags: post.hashtags,
          mediaType: post.mediaType,
          mediaUrl: post.mediaUrl,
        },
        a
      );

      if (pubResult.success) {
        hasPublished = true;
        await db.insert(postTargets).values({
          postId: post.id,
          accountId: a.id,
          platform: a.platform,
          status: "published",
          externalUrl: pubResult.externalUrl ?? `https://${a.platform}.com/${a.username}/p/${post.id}`,
          views: Math.round(a.followers * 0.08),
          likes: Math.round(a.followers * 0.006),
          comments: Math.round(a.followers * 0.0005),
          shares: Math.round(a.followers * 0.001),
        });
      } else {
        await db.insert(postTargets).values({
          postId: post.id,
          accountId: a.id,
          platform: a.platform,
          status: "failed",
          errorMessage: pubResult.errorMessage ?? "Gagal mempublikasikan ke platform",
        });
      }
    } else {
      await db.insert(postTargets).values({
        postId: post.id,
        accountId: a.id,
        platform: a.platform,
        status: body.scheduledAt ? "scheduled" : "draft",
        externalUrl: null,
      });
    }
  }

  const finalStatus: PostStatus = body.publishNow
    ? hasPublished
      ? "published"
      : "failed"
    : body.scheduledAt
      ? "scheduled"
      : "draft";

  await db.update(posts).set({ status: finalStatus }).where(eq(posts.id, post.id));

  await db.insert(auditLogs).values({
    action: body.publishNow ? (hasPublished ? "post.published" : "post.failed") : body.scheduledAt ? "post.scheduled" : "post.drafted",
    detail: `"${post.title}" → ${accounts.length} platform`,
  });

  const [full] = await db.select().from(posts).where(eq(posts.id, post.id));
  return NextResponse.json(full, { status: 201 });
}
