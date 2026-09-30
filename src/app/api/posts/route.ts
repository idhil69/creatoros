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

export async function POST(req: Request) {
  const body = (await req.json()) as {
    title: string;
    caption?: string;
    hashtags?: string[];
    mediaType?: "video" | "image" | "short" | "text";
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

  const status: PostStatus = body.publishNow ? "published" : body.scheduledAt ? "scheduled" : "draft";
  const count = (await db.select({ id: posts.id }).from(posts)).length;

  const [post] = await db
    .insert(posts)
    .values({
      title: body.title.trim(),
      caption: body.caption ?? "",
      hashtags: body.hashtags ?? [],
      mediaType: body.mediaType ?? "video",
      thumbnailColor: THUMBS[count % THUMBS.length],
      status,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      publishedAt: body.publishNow ? new Date() : null,
    })
    .returning();

  await db.insert(postTargets).values(
    accounts.map((a) => ({
      postId: post.id,
      accountId: a.id,
      platform: a.platform,
      status,
      externalUrl: body.publishNow ? `https://${a.platform}.com/${a.username}/p/${post.id}` : null,
      views: body.publishNow ? Math.round(a.followers * 0.08) : 0,
      likes: body.publishNow ? Math.round(a.followers * 0.006) : 0,
      comments: body.publishNow ? Math.round(a.followers * 0.0005) : 0,
      shares: body.publishNow ? Math.round(a.followers * 0.001) : 0,
    })),
  );

  await db.insert(auditLogs).values({
    action: body.publishNow ? "post.published" : status === "scheduled" ? "post.scheduled" : "post.drafted",
    detail: `"${post.title}" → ${accounts.length} platform`,
  });

  const [full] = await db.select().from(posts).where(eq(posts.id, post.id));
  return NextResponse.json(full, { status: 201 });
}
