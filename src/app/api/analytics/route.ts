import { db } from "@/db";
import { analyticsSnapshots, socialAccounts, postTargets, posts } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await db.select().from(socialAccounts);
  const snaps = await db.select().from(analyticsSnapshots).orderBy(asc(analyticsSnapshots.day));

  const byDay = new Map<string, { day: string; views: number; likes: number; comments: number; shares: number; followers: number }>();
  for (const s of snaps) {
    const d = byDay.get(s.day) ?? { day: s.day, views: 0, likes: 0, comments: 0, shares: 0, followers: 0 };
    d.views += s.views;
    d.likes += s.likes;
    d.comments += s.comments;
    d.shares += s.shares;
    d.followers += s.followers;
    byDay.set(s.day, d);
  }
  const series = [...byDay.values()];

  const totals = series.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      likes: acc.likes + d.likes,
      comments: acc.comments + d.comments,
      shares: acc.shares + d.shares,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  );

  const last7 = series.slice(-7);
  const prev7 = series.slice(-14, -7);
  const sum = (arr: typeof series, k: "views" | "likes") => arr.reduce((a, b) => a + b[k], 0);
  const growth = (cur: number, prev: number) => (prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100));

  const perPlatform = accounts.map((a) => {
    const mine = snaps.filter((s) => s.accountId === a.id);
    return {
      accountId: a.id,
      platform: a.platform,
      username: a.username,
      followers: a.followers,
      views: mine.reduce((x, y) => x + y.views, 0),
      likes: mine.reduce((x, y) => x + y.likes, 0),
      engagementRate:
        a.followers > 0
          ? Number(((mine.reduce((x, y) => x + y.likes + y.comments + y.shares, 0) / Math.max(1, mine.length) / a.followers) * 100).toFixed(2))
          : 0,
    };
  });

  const topTargets = await db
    .select({
      id: postTargets.id,
      platform: postTargets.platform,
      views: postTargets.views,
      likes: postTargets.likes,
      title: posts.title,
      postId: posts.id,
    })
    .from(postTargets)
    .innerJoin(posts, eq(posts.id, postTargets.postId))
    .where(eq(postTargets.status, "published"))
    .orderBy(desc(postTargets.views))
    .limit(5);

  return NextResponse.json({
    totalFollowers: accounts.reduce((a, b) => a + b.followers, 0),
    totals,
    growth: {
      views: growth(sum(last7, "views"), sum(prev7, "views")),
      likes: growth(sum(last7, "likes"), sum(prev7, "likes")),
    },
    series,
    perPlatform,
    topPosts: topTargets,
  });
}
