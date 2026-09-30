"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { SocialAccount } from "@/db/schema";
import { PLATFORMS, formatNumber } from "@/lib/platforms";
import { Avatar, ErrorState, PlatformBadge, Sheet, Skeleton, StatusPill, Toast, TopBar, useFetch, useToast } from "@/components/ui";
import { CheckIcon, RefreshIcon, TrashIcon } from "@/components/Icons";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload, setData } = useFetch<SocialAccount>(`/api/accounts/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast, show } = useToast();

  async function act(action: "refresh" | "expire" | "sync") {
    setBusy(action);
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setData(await res.json());
    setBusy(null);
    show(action === "refresh" ? "Token diperbarui" : action === "sync" ? "Data disinkronkan" : "Token ditandai kedaluwarsa", action === "expire" ? "error" : "success");
  }

  async function disconnect() {
    setBusy("delete");
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    router.push("/accounts");
  }

  const meta = data ? PLATFORMS[data.platform] : null;

  return (
    <div>
      <TopBar title="Detail Akun" back="/accounts" />
      <div className="px-4">
        {loading ? (
          <Skeleton className="h-48" />
        ) : error || !data ? (
          <ErrorState message={error ?? "Akun tidak ditemukan"} onRetry={reload} />
        ) : (
          <div className="fade-up space-y-4">
            <div className="card flex flex-col items-center p-6 text-center">
              <div className="relative">
                <Avatar color={data.avatarColor} name={data.displayName} size="lg" />
                <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-white">
                  <PlatformBadge platform={data.platform} size="sm" />
                </span>
              </div>
              <h2 className="mt-3 text-lg font-bold">{data.displayName}</h2>
              <p className="text-sm text-stone-500">
                {data.username} · {meta!.name}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <StatusPill status={data.status} />
                <span className={`chip ${data.isMock ? "bg-stone-100 text-stone-500" : "bg-green-100 text-green-700"}`}>
                  {data.isMock ? "Akun simulasi" : "Akun asli"}
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold text-primary">{formatNumber(data.followers)}</p>
              <p className="text-xs text-stone-500">pengikut</p>
            </div>

            {data.status !== "connected" && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-bold text-orange-800">Perlu tindakan</p>
                <p className="text-xs text-orange-700">{data.errorMessage ?? "Akun perlu dihubungkan ulang."}</p>
                <button
                  onClick={() => {
                    if (data.isMock) act("refresh");
                    else window.location.href = `/api/oauth/${data.platform}/start`;
                  }}
                  disabled={!!busy}
                  className="btn-primary mt-3 w-full"
                >
                  <RefreshIcon /> {busy === "refresh" ? "Menghubungkan…" : "Hubungkan ulang"}
                </button>
              </div>
            )}

            <div className="card divide-y divide-amber-50 text-sm">
              <Row label="Izin (scopes)">
                <div className="flex flex-wrap justify-end gap-1">
                  {data.scopes.map((s) => (
                    <span key={s} className="chip bg-amber-100 text-amber-800">
                      <CheckIcon className="h-3 w-3" /> {s}
                    </span>
                  ))}
                </div>
              </Row>
              <Row label="Token berlaku hingga">
                {data.tokenExpiresAt ? new Date(data.tokenExpiresAt).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—"}
              </Row>
              <Row label="Sinkron terakhir">
                {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"}
              </Row>
              <Row label="Terhubung sejak">{new Date(data.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}</Row>
              <Row label="Penyimpanan token">AES-256 (server)</Row>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => act("sync")} disabled={!!busy} className="btn-outline">
                <RefreshIcon className={busy === "sync" ? "animate-spin" : ""} /> Sinkronkan
              </button>
              <button onClick={() => act("refresh")} disabled={!!busy} className="btn-outline">
                Refresh token
              </button>
            </div>
            {data.status === "connected" && (
              <button onClick={() => act("expire")} disabled={!!busy} className="btn-ghost w-full text-xs text-stone-500">
                Simulasikan token kedaluwarsa (uji state)
              </button>
            )}
            <button onClick={() => setConfirm(true)} className="btn-danger w-full">
              <TrashIcon /> Putuskan akun
            </button>
          </div>
        )}
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Putuskan akun?">
        <p className="text-sm text-stone-600">
          Akun <b>{data?.displayName}</b> akan dihapus dari CreatorOS beserta data analitiknya. Postingan yang sudah terbit tidak akan dihapus dari platform.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirm(false)} className="btn-outline">
            Batal
          </button>
          <button onClick={disconnect} disabled={!!busy} className="btn-danger">
            {busy === "delete" ? "Memutuskan…" : "Ya, putuskan"}
          </button>
        </div>
      </Sheet>
      <Toast toast={toast} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-stone-500">{label}</span>
      <span className="text-right font-semibold">{children}</span>
    </div>
  );
}
