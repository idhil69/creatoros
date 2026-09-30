import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export type Platform = "youtube" | "instagram" | "facebook" | "tiktok";
export type AccountStatus = "connected" | "pending" | "expired" | "error";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  platform: text("platform").$type<Platform>().notNull(),
  externalId: text("external_id"),
  isMock: boolean("is_mock").notNull().default(true),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#b45309"),
  followers: integer("followers").notNull().default(0),
  status: text("status").$type<AccountStatus>().notNull().default("pending"),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  tokenExpiresAt: timestamp("token_expires_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
  mediaType: text("media_type").$type<"video" | "image" | "short" | "text">().notNull().default("video"),
  mediaUrl: text("media_url"),
  thumbnailColor: text("thumbnail_color").notNull().default("#fbbf24"),
  status: text("status").$type<PostStatus>().notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const postTargets = pgTable("post_targets", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  accountId: integer("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  platform: text("platform").$type<Platform>().notNull(),
  status: text("status").$type<PostStatus>().notNull().default("draft"),
  externalUrl: text("external_url"),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  errorMessage: text("error_message"),
});

export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  platform: text("platform").$type<Platform>().notNull(),
  day: text("day").notNull(), // YYYY-MM-DD
  followers: integer("followers").notNull().default(0),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
});

export type LiveMessageType = "chat" | "gift" | "follow" | "question" | "system";
export type StreamHealth = "excellent" | "good" | "poor";

export type LiveExternal = {
  youtube?: {
    accountId: number;
    broadcastId: string;
    videoId: string;
    chatId: string;
    rtmpUrl: string;
    streamKey: string;
    nextPageToken?: string;
    lastPollAt?: number;
    lastError?: string;
    ingest?: { lifeCycle: string; streamStatus: string; health: string };
  };
};

export const liveStreams = pgTable("live_streams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("Just Chatting"),
  platforms: jsonb("platforms").$type<Platform[]>().notNull().default([]),
  isLive: boolean("is_live").notNull().default(false),
  viewers: integer("viewers").notNull().default(0),
  peakViewers: integer("peak_viewers").notNull().default(0),
  viewerBreakdown: jsonb("viewer_breakdown").$type<Partial<Record<Platform, number>>>().notNull().default({}),
  likes: integer("likes").notNull().default(0),
  newFollowers: integer("new_followers").notNull().default(0),
  giftsTotal: integer("gifts_total").notNull().default(0),
  health: text("health").$type<StreamHealth>().notNull().default("excellent"),
  bitrateKbps: integer("bitrate_kbps").notNull().default(4500),
  fps: integer("fps").notNull().default(30),
  droppedFrames: integer("dropped_frames").notNull().default(0),
  latencyMode: text("latency_mode").$type<"low" | "normal" | "ultra">().notNull().default("low"),
  streamKey: text("stream_key").notNull().default(""),
  isReal: boolean("is_real").notNull().default(false),
  external: jsonb("external").$type<LiveExternal>().notNull().default({}),
  blockedAuthors: jsonb("blocked_authors").$type<string[]>().notNull().default([]),
  slowMode: boolean("slow_mode").notNull().default(false),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const liveMessages = pgTable("live_messages", {
  id: serial("id").primaryKey(),
  streamId: integer("stream_id")
    .notNull()
    .references(() => liveStreams.id, { onDelete: "cascade" }),
  platform: text("platform").$type<Platform>().notNull(),
  author: text("author").notNull(),
  message: text("message").notNull(),
  type: text("type").$type<LiveMessageType>().notNull().default("chat"),
  amount: integer("amount").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  isAnswered: boolean("is_answered").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostTarget = typeof postTargets.$inferSelect;
export type LiveStream = typeof liveStreams.$inferSelect;
export type LiveMessage = typeof liveMessages.$inferSelect;
