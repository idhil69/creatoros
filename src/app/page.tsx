"use client";

import Link from "next/link";
import type { SocialAccount, Post, PostTarget } from "@/db/schema";
import { formatNumber, PLATFORMS } from "@/lib/platforms";
import { Avatar, PlatformBadge, Skeleton, StatusPill, useFetch } from "@/components/ui";
import { ChevronIcon, LinkIcon, LiveIcon, PlusIcon, SparkleIcon, CalendarIcon, ChartIcon } from "@/components/Icons";

type PostWithTargets = Post & { targets: PostTarget[] };
type Analytics = { totalFollowers: number; totals: { views: number; likes: number }; growth: { views: number; likes: number } };

export default function HomePage() {
  const accounts = useFetch<SocialAccount[]>("/api/accounts");
  const posts = useFetch<PostWithTargets[]>("/api/posts");
  const analytics = useFetch<Analytics>("/api/analytics");
  const live = useFetch<{ stream: { title: string; viewers: number; platforms: string[]; isReal?: boolean } | null }>("/api/live");

  const connected = accounts.data?.filter((a) => a.status === "connected") ?? [];
  const upcoming = (posts.data ?? [])
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 3);
  const hour = new Date().getHours();
  const greet = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 19 ? "Selamat sore" : "Selamat malam";

  return (
    <div>
      <header className="bg-gradient-to-br from-primary via-accent to-secondary px-5 pb-16 pt-[calc(env(safe-area-inset-top)+20px)] text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm/5 text-amber-100">{greet} 👋</p>
            <h1 className="text-2xl font-bold">CreatorOS</h1>
          </div>
          <Link href="/accounts" className="flex -space-x-2">
            {connected.slice(0, 4).map((a) => (
              <span key={a.id} className="rounded-full ring-2 ring-white/80">
                <PlatformBadge platform={a.platform} size="sm" />
              </span>
            ))}
            {connected.length === 0 && (
              <span className="rounded-full bg-white/20 p-2">
                <LinkIcon className="h-5 w-5" />
              </span>
            )}
          </Link>
        </div>
      </header>

      <section className="-mt-12 px-4">
        <div className="card grid grid-cols-3 divide-x divide-amber-100 p-4">
          <Stat label="Pengikut" value={analytics.data ? formatNumber(analytics.data.totalFollowers) : "—"} />
          <Stat
            label="Tayangan 30h"
            value={analytics.data ? formatNumber(analytics.data.totals.views) : "—"}
            delta={analytics.data?.growth.views}
          />
          <Stat
            label="Suka 30h"
            value={analytics.data ? formatNumber(analytics.data.totals.likes) : "—"}
            delta={analytics.data?.growth.likes}
          />
        </div>
      </section>

      {live.data?.stream && (
        <section className="mt-4 px-4">
          <Link href="/live" className="fade-up flex items-center gap-3 rounded-xl bg-stone-900 p-3 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {live.data.stream.isReal ? "LIVE ASLI" : "LIVE"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{live.data.stream.title}</p>
              <p className="text-xs text-stone-300">{formatNumber(live.data.stream.viewers)} penonton · {live.data.stream.platforms.length} platform</p>
            </div>
            <ChevronIcon className="text-stone-400" />
          </Link>
        </section>
      )}

      <section className="mt-5 px-4">
        <div className="grid grid-cols-4 gap-2">
          <Quick href="/content/new" label="Posting" icon={<PlusIcon className="h-6 w-6" />} />
          <Quick href="/schedule" label="Jadwal" icon={<CalendarIcon className="h-6 w-6" />} />
          <Quick href="/live" label="Live" icon={<LiveIcon className="h-6 w-6" />} />
          <Quick href="/ai" label="AI" icon={<SparkleIcon className="h-6 w-6" />} />
        </div>
      </section>

      <Section title="Akun Terhubung" href="/accounts">
        {accounts.loading ? (
          <Skeleton className="h-20" />
        ) : connected.length === 0 ? (
          <Link href="/accounts" className="card flex items-center gap-3 border-dashed border-amber-300 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-primary">
              <LinkIcon />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">Belum ada akun terhubung</p>
              <p className="text-xs text-stone-500">Hubungkan YouTube, Instagram, Facebook, atau TikTok</p>
            </div>
            <ChevronIcon className="text-stone-400" />
          </Link>
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {accounts.data!.map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="card w-40 shrink-0 p-3">
                <div className="flex items-center justify-between">
                  <Avatar color={a.avatarColor} name={a.displayName} />
                  <PlatformBadge platform={a.platform} size="sm" />
                </div>
                <p className="mt-2 truncate text-sm font-bold">{a.displayName}</p>
                <p className="truncate text-xs text-stone-500">{a.username}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">{formatNumber(a.followers)}</span>
                  <StatusPill status={a.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Jadwal Mendatang" href="/schedule">
        {posts.loading ? (
          <Skeleton className="h-24" />
        ) : upcoming.length === 0 ? (
          <div className="card p-4 text-center text-sm text-stone-500">
            Tidak ada postingan terjadwal.{" "}
            <Link href="/content/new" className="font-semibold text-primary">
              Buat sekarang
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((p) => (
              <Link key={p.id} href={`/content/${p.id}`} className="card flex items-center gap-3 p-3">
                <span className="h-12 w-12 shrink-0 rounded-lg" style={{ background: p.thumbnailColor }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.title}</p>
                  <p className="text-xs text-stone-500">
                    {new Date(p.scheduledAt!).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex -space-x-1.5">
                  {p.targets.map((t) => (
                    <PlatformBadge key={t.id} platform={t.platform} size="sm" />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Ringkasan Platform" href="/analytics">
        <div className="card divide-y divide-amber-50">
          {(Object.keys(PLATFORMS) as (keyof typeof PLATFORMS)[]).map((p) => {
            const acc = accounts.data?.filter((a) => a.platform === p) ?? [];
            const f = acc.reduce((s, a) => s + a.followers, 0);
            return (
              <div key={p} className="flex items-center gap-3 px-4 py-3">
                <PlatformBadge platform={p} />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{PLATFORMS[p].name}</p>
                  <p className="text-xs text-stone-500">{acc.length ? `${acc.length} akun` : "Belum terhubung"}</p>
                </div>
                <span className="text-sm font-bold text-primary">{acc.length ? formatNumber(f) : "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-center">
          <Link href="/analytics" className="btn-ghost text-xs">
            <ChartIcon className="h-4 w-4" /> Lihat analitik lengkap
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="px-2 text-center first:pl-0 last:pr-0">
      <p className="text-lg font-bold text-stone-900">{value}</p>
      <p className="text-[11px] text-stone-500">{label}</p>
      {delta !== undefined && (
        <p className={`text-[11px] font-semibold ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
        </p>
      )}
    </div>
  );
}

function Quick({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-amber-100 transition active:scale-95">
        {icon}
      </span>
      <span className="text-xs font-semibold text-stone-700">{label}</span>
    </Link>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <Link href={href} className="text-xs font-semibold text-primary">
          Lihat semua
        </Link>
      </div>
      {children}
    </section>
  );
}
