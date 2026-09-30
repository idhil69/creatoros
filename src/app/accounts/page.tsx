"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SocialAccount, Platform } from "@/db/schema";
import { PLATFORM_LIST, formatNumber } from "@/lib/platforms";
import { Avatar, EmptyState, ErrorState, PlatformBadge, Sheet, Skeleton, StatusPill, Toast, TopBar, useFetch, useToast } from "@/components/ui";
import { ChevronIcon, LinkIcon, PlusIcon } from "@/components/Icons";

export default function AccountsPage() {
  const { data, loading, error, reload } = useFetch<SocialAccount[]>("/api/accounts");
  const config = useFetch<Record<Platform, boolean>>("/api/oauth/config");
  const [sheet, setSheet] = useState(false);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const { toast, show } = useToast();

  // Tangani hasil redirect dari OAuth callback (?connected= / ?error=)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const ok = sp.get("connected");
    const err = sp.get("error");
    if (ok) show(`${ok} berhasil terhubung 🎉`);
    if (err) setOauthError(err);
    if (ok || err) window.history.replaceState({}, "", "/accounts");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyReal = config.data ? Object.values(config.data).some(Boolean) : false;

  async function connect(platform: Platform, simulateError = false) {
    // OAuth asli terkonfigurasi → redirect penuh ke provider
    if (config.data?.[platform] && !simulateError) {
      setConnecting(platform);
      window.location.href = `/api/oauth/${platform}/start`;
      return;
    }
    setConnecting(platform);
    setOauthError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, simulateError }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menghubungkan");
      show(`${json.displayName} berhasil terhubung`);
      setSheet(false);
      reload();
    } catch (e) {
      setOauthError((e as Error).message);
    } finally {
      setConnecting(null);
    }
  }

  return (
    <div>
      <TopBar
        title="Akun Terhubung"
        subtitle="Kelola koneksi platform sosial"
        back="/"
        action={
          <button onClick={() => setSheet(true)} className="btn-primary px-4 py-2">
            <PlusIcon className="h-4 w-4" /> Hubungkan
          </button>
        }
      />

      <div className="px-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : data!.length === 0 ? (
          <EmptyState
            icon={<LinkIcon className="h-10 w-10" />}
            title="Belum ada akun terhubung"
            desc="Hubungkan akun YouTube, Instagram, Facebook, atau TikTok untuk mulai memposting dan melihat analitik dari satu tempat."
            action={
              <button onClick={() => setSheet(true)} className="btn-primary">
                <PlusIcon className="h-5 w-5" /> Hubungkan platform
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {data!.map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="card fade-up flex items-center gap-3 p-4">
                <div className="relative">
                  <Avatar color={a.avatarColor} name={a.displayName} />
                  <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-white">
                    <PlatformBadge platform={a.platform} size="sm" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{a.displayName}</p>
                  <p className="truncate text-xs text-stone-500">
                    {a.username} · {formatNumber(a.followers)} pengikut
                  </p>
                  <div className="mt-1">
                    <StatusPill status={a.status} />
                  </div>
                </div>
                <ChevronIcon className="text-stone-400" />
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-xl bg-amber-100/60 p-4 text-xs text-amber-900">
          {anyReal ? (
            <>
              <p className="font-bold">🔐 OAuth asli aktif</p>
              <p className="mt-1">
                Platform berlabel <b>Asli</b> akan login ke akun sosmed pribadimu (OAuth 2.0 + PKCE, token dienkripsi AES-256 di server). Platform berlabel{" "}
                <b>Mock</b> memakai data simulasi.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold">🔒 Mode Mock OAuth aktif</p>
              <p className="mt-1">
                Untuk login dengan akun sosmed pribadimu, isi kredensial API di environment variables (lihat <b>docs/OAUTH_SETUP.md</b>). Tanpa itu, koneksi
                memakai data simulasi.
              </p>
            </>
          )}
        </div>
      </div>

      <Sheet open={sheet} onClose={() => !connecting && setSheet(false)} title="Pilih platform">
        {connecting ? (
          <div className="flex flex-col items-center py-8 text-center">
            <PlatformBadge platform={connecting} size="lg" />
            <div className="mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-amber-100">
              <div className="h-full w-1/2 animate-[oauth_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold">Mengarahkan ke halaman otorisasi…</p>
            <p className="mt-1 text-xs text-stone-500">OAuth 2.0 + PKCE (simulasi)</p>
            <style>{`@keyframes oauth{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
          </div>
        ) : (
          <>
            {oauthError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p className="font-bold">Koneksi gagal</p>
                <p>{oauthError}</p>
              </div>
            )}
            <div className="space-y-2">
              {PLATFORM_LIST.map((p) => {
                const real = config.data?.[p.id] ?? false;
                return (
                  <button key={p.id} onClick={() => connect(p.id)} className="card flex w-full items-center gap-3 p-3 text-left hover:bg-amber-50">
                    <PlatformBadge platform={p.id} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="truncate text-[11px] text-stone-500">{p.scopes.join(" · ")}</p>
                    </div>
                    <span className={`chip shrink-0 ${real ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>{real ? "Asli" : "Mock"}</span>
                    <ChevronIcon className="text-stone-400" />
                  </button>
                );
              })}
            </div>
            <button onClick={() => connect("instagram", true)} className="btn-ghost mt-3 w-full text-xs text-stone-500">
              Simulasikan otorisasi gagal (uji state error)
            </button>
          </>
        )}
      </Sheet>
      <Toast toast={toast} />
    </div>
  );
}
