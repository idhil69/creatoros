import type { Platform } from "@/db/schema";

export const PLATFORMS: Record<
  Platform,
  {
    id: Platform;
    name: string;
    color: string;
    bg: string;
    text: string;
    scopes: string[];
    mockUsers: { username: string; displayName: string; followers: number }[];
  }
> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    color: "#ff0000",
    bg: "bg-red-50",
    text: "text-red-600",
    scopes: ["youtube.upload", "youtube.readonly", "yt-analytics.readonly"],
    mockUsers: [
      { username: "@kreatorstudio", displayName: "Kreator Studio", followers: 128400 },
      { username: "@dailyvlogid", displayName: "Daily Vlog ID", followers: 54200 },
    ],
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    color: "#e1306c",
    bg: "bg-pink-50",
    text: "text-pink-600",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    mockUsers: [
      { username: "@kreator.studio", displayName: "Kreator Studio", followers: 86300 },
      { username: "@foodie.jkt", displayName: "Foodie Jakarta", followers: 21900 },
    ],
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    color: "#1877f2",
    bg: "bg-blue-50",
    text: "text-blue-600",
    scopes: ["pages_manage_posts", "pages_read_engagement", "publish_video"],
    mockUsers: [
      { username: "KreatorStudioPage", displayName: "Kreator Studio Page", followers: 42100 },
      { username: "KomunitasKreator", displayName: "Komunitas Kreator", followers: 9800 },
    ],
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    color: "#010101",
    bg: "bg-neutral-100",
    text: "text-neutral-800",
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    mockUsers: [
      { username: "@kreatorstudio", displayName: "Kreator Studio", followers: 312000 },
      { username: "@lucu.banget", displayName: "Lucu Banget", followers: 77500 },
    ],
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export const AVATAR_COLORS = ["#b45309", "#ea580c", "#fbbf24", "#d97706", "#f59e0b", "#c2410c"];

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
