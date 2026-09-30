"use client";

import Link from "next/link";
import { useState } from "react";
import type { Platform } from "@/db/schema";
import { PLATFORMS, formatNumber } from "@/lib/platforms";
import { EmptyState, PlatformBadge, Skeleton, TopBar, useFetch } from "@/components/ui";
import { ChartIcon } from "@/components/Icons";

type Analytics = {
  totalFollowers: number;
  totals: { views: number; likes: number; comments: number; shares: number };
  growth: { views: number; likes: number };
  series: { day: string; views: number; likes: number; comments: number; shares: number; followers: number }[];
  perPlatform: { accountId: number; platform: Platform; username: string; followers: number; views: number; likes: number; engagementRate: number }[];
  topPosts: { id: number; postId: number; platform: Platform; views: number; likes: number; title: string }[];
};

type Metric = "views" | "likes" | "comments" | "shares";
const METRICS: { id: Metric; label: string }[] = [
  { id: "views", label: "Tayangan" },
  { id: "likes", label: "Suka" },
  { id: "comments", label: "Komentar" },
  { id: "shares", label: "Bagikan" },
];

export default function AnalyticsPage() {
  const { data, loading } = useFetch<Analytics>("/api/analytics");
  const [metric, setMetric] = useState<Metric>("views");
  const [range, setRange] = useState<7 | 30>(30);

  const series = (data?.series ?? []).slice(-range);
  const max = Math.max(1, ...series.map((s) => s[metric]));
  const w = 320;
  const h = 120;
  const pts = series.map((s, i) => [(i / Math.max(1, series.length - 1)) * w, h - (s[metric] / max) * (h - 10)] as const);
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${path} L${w},${h} L0,${h} Z` : "";
  const totalMetric = series.reduce((a, b) => a + b[metric], 0);

  return (
    <div>
      <TopBar title="Analitik" subtitle="Performa gabungan semua platform" />
      <div className="px-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        ) : !data || data.perPlatform.length === 0 ? (
          <EmptyState
            icon={<ChartIcon className="h-10 w-10" />}
            title="Belum ada data analitik"
            desc="Hubungkan akun untuk mulai melihat metrik performa terpadu."
            action={
              <Link href="/accounts" className="btn-primary">
                Hubungkan akun
              </Link>
            }
          />
        ) : (
          <div className="fade-up space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Total pengikut" value={formatNumber(data.totalFollowers)} />
              <Kpi label="Tayangan 30 hari" value={formatNumber(data.totals.views)} delta={data.growth.views} />
              <Kpi label="Suka 30 hari" value={formatNumber(data.totals.likes)} delta={data.growth.likes} />
              <Kpi
                label="Engagement rate"
                value={`${(data.perPlatform.reduce((a, b) => a + b.engagementRate, 0) / data.perPlatform.length).toFixed(2)}%`}
              />
            </div>

            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500">{METRICS.find((m) => m.id === metric)!.label} · {range} hari</p>
                  <p className="text-xl font-bold">{formatNumber(totalMetric)}</p>
                </div>
                <div className="flex rounded-full bg-amber-100 p-0.5 text-xs font-semibold">
                  {([7, 30] as const).map((r) => (
                    <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1 ${range === r ? "bg-white text-primary shadow-sm" : "text-stone-600"}`}>
                      {r}h
                    </button>
                  ))}
                </div>
              </div>
              <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full overflow-visible">
                <defs>
                  <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {area && <path d={area} fill="url(#g)" />}
                {path && <path d={path} fill="none" stroke="#b45309" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
                {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#ea580c" stroke="#fff" strokeWidth="2" />}
              </svg>
              <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                <span>{series[0]?.day.slice(5)}</span>
                <span>{series[series.length - 1]?.day.slice(5)}</span>
              </div>
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetric(m.id)}
                    className={`chip shrink-0 px-3 py-1.5 ${metric === m.id ? "bg-primary text-white" : "bg-amber-50 text-stone-600"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-bold">Per platform</h2>
              <div className="card divide-y divide-amber-50">
                {data.perPlatform.map((p) => (
                  <Link key={p.accountId} href={`/accounts/${p.accountId}`} className="flex items-center gap-3 px-4 py-3">
                    <PlatformBadge platform={p.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{PLATFORMS[p.platform].name}</p>
                      <p className="truncate text-xs text-stone-500">{p.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatNumber(p.views)} tayangan</p>
                      <p className="text-xs text-stone-500">
                        {formatNumber(p.followers)} pengikut · ER {p.engagementRate}%
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-sm font-bold">Konten terbaik</h2>
              {data.topPosts.length === 0 ? (
                <div className="card p-4 text-center text-sm text-stone-500">Belum ada konten terbit.</div>
              ) : (
                <div className="card divide-y divide-amber-50">
                  {data.topPosts.map((t, i) => (
                    <Link key={t.id} href={`/content/${t.postId}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-5 text-center text-sm font-bold text-stone-400">{i + 1}</span>
                      <PlatformBadge platform={t.platform} size="sm" />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</p>
                      <span className="text-xs font-semibold text-primary">{formatNumber(t.views)} 👁</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {delta !== undefined && (
        <p className={`text-xs font-semibold ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs minggu lalu
        </p>
      )}
    </div>
  );
}
