"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Platform, AccountStatus, PostStatus } from "@/db/schema";
import { PLATFORMS } from "@/lib/platforms";
import { BackIcon, PlatformIcon } from "./Icons";

export function TopBar({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-surface/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)] backdrop-blur">
      <div className="flex items-center gap-2">
        {back && (
          <Link href={back} className="-ml-2 rounded-full p-2 text-primary hover:bg-amber-100" aria-label="Kembali">
            <BackIcon />
          </Link>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight text-stone-900">{title}</h1>
          {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function PlatformBadge({ platform, size = "md" }: { platform: Platform; size?: "sm" | "md" | "lg" }) {
  const meta = PLATFORMS[platform];
  const dims = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const icon = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return (
    <span className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full text-white`} style={{ background: meta.color }}>
      <PlatformIcon platform={platform} className={icon} />
    </span>
  );
}

export function StatusPill({ status }: { status: AccountStatus | PostStatus }) {
  const map: Record<string, string> = {
    connected: "bg-green-100 text-green-700",
    published: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    scheduled: "bg-blue-100 text-blue-700",
    publishing: "bg-amber-100 text-amber-700",
    draft: "bg-stone-100 text-stone-600",
    expired: "bg-orange-100 text-orange-700",
    error: "bg-red-100 text-red-700",
    failed: "bg-red-100 text-red-700",
  };
  const label: Record<string, string> = {
    connected: "Terhubung",
    published: "Terbit",
    pending: "Menunggu",
    scheduled: "Terjadwal",
    publishing: "Memproses",
    draft: "Draf",
    expired: "Kedaluwarsa",
    error: "Error",
    failed: "Gagal",
  };
  return <span className={`chip ${map[status]}`}>{label[status]}</span>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-up max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200" />
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast }: { toast: { message: string; type: "success" | "error" } | null }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <div
        className={`fade-up rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
          toast.type === "success" ? "bg-stone-900" : "bg-red-600"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const show = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }, []);
  return { toast, show };
}

export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat data");
      setData((await res.json()) as T);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);
  return { data, loading, error, reload, setData };
}

export function Skeleton({ className = "h-16" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-amber-100/70 ${className}`} />;
}

export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="fade-up flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-primary">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-stone-500">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fade-up mx-4 my-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
      <p className="text-sm font-semibold text-red-700">{message}</p>
      <button onClick={onRetry} className="btn-outline mt-3">
        Coba lagi
      </button>
    </div>
  );
}

export function Avatar({ color, name, size = "md" }: { color: string; name: string; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : "h-11 w-11 text-base";
  return (
    <span className={`flex ${dims} shrink-0 items-center justify-center rounded-full font-bold text-white`} style={{ background: color }}>
      {name.replace(/[@]/g, "").charAt(0).toUpperCase()}
    </span>
  );
}
