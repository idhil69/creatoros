import { db } from "@/db";
import { analyticsSnapshots, type Platform } from "@/db/schema";
import { seededRandom } from "./platforms";

/** Seed 30 hari snapshot analitik deterministik berdasarkan jumlah pengikut. */
export async function seedAnalyticsFor(accountId: number, platform: Platform, followerCount: number) {
  const base = Math.max(followerCount, 50);
  const rnd = seededRandom(accountId * 977 + platform.length);
  const snapshots = [];
  let followers = Math.round(base * 0.93);
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    followers += Math.round(rnd() * (base * 0.004));
    snapshots.push({
      accountId,
      platform,
      day: d.toISOString().slice(0, 10),
      followers,
      views: Math.round(base * (0.05 + rnd() * 0.15)),
      likes: Math.round(base * (0.004 + rnd() * 0.01)),
      comments: Math.round(base * (0.0003 + rnd() * 0.001)),
      shares: Math.round(base * (0.0005 + rnd() * 0.002)),
    });
  }
  await db.insert(analyticsSnapshots).values(snapshots);
}
