"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Post, PostTarget } from "@/db/schema";
import { PlatformBadge, Skeleton, StatusPill, TopBar, useFetch } from "@/components/ui";
import { BackIcon, ChevronIcon, PlusIcon } from "@/components/Icons";

type PostWithTargets = Post & { targets: PostTarget[] };
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SchedulePage() {
  const { data, loading } = useFetch<PostWithTargets[]>("/api/posts");
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(key(today));

  const byDay = useMemo(() => {
    const map = new Map<string, PostWithTargets[]>();
    (data ?? []).forEach((p) => {
      const d = p.scheduledAt ?? p.publishedAt;
      if (!d) return;
      const k = key(new Date(d));
      map.set(k, [...(map.get(k) ?? []), p]);
    });
    return map;
  }, [data]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = first.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const arr: (Date | null)[] = Array(start).fill(null);
    for (let i = 1; i <= days; i++) arr.push(new Date(month.getFullYear(), month.getMonth(), i));
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [month]);

  const dayPosts = (byDay.get(selected) ?? []).sort(
    (a, b) => new Date(a.scheduledAt ?? a.publishedAt!).getTime() - new Date(b.scheduledAt ?? b.publishedAt!).getTime(),
  );

  return (
    <div>
      <TopBar
        title="Kalender Konten"
        subtitle="Rencanakan postingan lintas platform"
        action={
          <Link href="/content/new" className="btn-primary px-4 py-2">
            <PlusIcon className="h-4 w-4" /> Jadwalkan
          </Link>
        }
      />
      <div className="px-4">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full p-1 hover:bg-amber-100">
              <BackIcon className="h-5 w-5" />
            </button>
            <p className="text-sm font-bold">{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</p>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full p-1 hover:bg-amber-100">
              <ChevronIcon />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-stone-500">
            {DAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const k = key(d);
              const items = byDay.get(k) ?? [];
              const isSel = k === selected;
              const isToday = k === key(today);
              return (
                <button key={k} onClick={() => setSelected(k)} className="flex flex-col items-center py-1">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${
                      isSel ? "bg-primary text-white" : isToday ? "bg-amber-100 text-primary" : "text-stone-700"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-0.5 flex h-1.5 gap-0.5">
                    {items.slice(0, 3).map((p) => (
                      <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${p.status === "published" ? "bg-green-500" : "bg-accent"}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-center gap-4 text-[11px] text-stone-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-accent" /> Terjadwal
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> Terbit
            </span>
          </div>
        </div>

        <h2 className="mb-2 mt-5 text-sm font-bold">
          {new Date(selected + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {loading ? (
          <Skeleton className="h-20" />
        ) : dayPosts.length === 0 ? (
          <div className="card p-5 text-center text-sm text-stone-500">
            Tidak ada postingan di tanggal ini.
            <div className="mt-3">
              <Link href="/content/new" className="btn-outline">
                <PlusIcon className="h-4 w-4" /> Jadwalkan postingan
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {dayPosts.map((p) => (
              <Link key={p.id} href={`/content/${p.id}`} className="card fade-up flex items-center gap-3 p-3">
                <div className="w-12 text-center">
                  <p className="text-sm font-bold text-primary">
                    {new Date(p.scheduledAt ?? p.publishedAt!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="h-10 w-1 rounded-full" style={{ background: p.thumbnailColor }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {p.targets.map((t) => (
                        <PlatformBadge key={t.id} platform={t.platform} size="sm" />
                      ))}
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
