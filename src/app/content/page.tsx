"use client";

import Link from "next/link";
import { useState } from "react";
import type { Post, PostTarget } from "@/db/schema";
import { formatNumber } from "@/lib/platforms";
import { EmptyState, ErrorState, PlatformBadge, Skeleton, StatusPill, TopBar, useFetch } from "@/components/ui";
import { ContentIcon, EyeIcon, HeartIcon, PlusIcon } from "@/components/Icons";

type PostWithTargets = Post & { targets: PostTarget[] };
const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "published", label: "Terbit" },
  { id: "scheduled", label: "Terjadwal" },
  { id: "draft", label: "Draf" },
];

export default function ContentPage() {
  const { data, loading, error, reload } = useFetch<PostWithTargets[]>("/api/posts");
  const [filter, setFilter] = useState("all");
  const list = (data ?? []).filter((p) => filter === "all" || p.status === filter);

  return (
    <div>
      <TopBar
        title="Konten"
        subtitle="Upload sekali, terbitkan di mana saja"
        action={
          <Link href="/content/new" className="btn-primary px-4 py-2">
            <PlusIcon className="h-4 w-4" /> Buat
          </Link>
        }
      />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`chip shrink-0 px-4 py-1.5 ${filter === f.id ? "bg-primary text-white" : "bg-white text-stone-600 ring-1 ring-amber-200"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<ContentIcon className="h-10 w-10" />}
            title={filter === "all" ? "Belum ada konten" : "Tidak ada konten di filter ini"}
            desc="Buat postingan pertama kamu dan terbitkan ke beberapa platform sekaligus."
            action={
              <Link href="/content/new" className="btn-primary">
                <PlusIcon className="h-5 w-5" /> Buat postingan
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {list.map((p) => {
              const views = p.targets.reduce((s, t) => s + t.views, 0);
              const likes = p.targets.reduce((s, t) => s + t.likes, 0);
              return (
                <Link key={p.id} href={`/content/${p.id}`} className="card fade-up flex gap-3 p-3">
                  <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg text-3xl" style={{ background: p.thumbnailColor }}>
                    {p.mediaType === "video" ? "🎬" : p.mediaType === "short" ? "📱" : p.mediaType === "image" ? "🖼️" : "📝"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-bold">{p.title}</p>
                      <StatusPill status={p.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{p.caption || "Tanpa caption"}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex -space-x-1.5">
                        {p.targets.map((t) => (
                          <span key={t.id} className="rounded-full ring-2 ring-white">
                            <PlatformBadge platform={t.platform} size="sm" />
                          </span>
                        ))}
                      </div>
                      {p.status === "published" ? (
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <span className="flex items-center gap-0.5">
                            <EyeIcon /> {formatNumber(views)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <HeartIcon /> {formatNumber(likes)}
                          </span>
                        </div>
                      ) : p.scheduledAt ? (
                        <span className="text-xs text-stone-500">
                          {new Date(p.scheduledAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
