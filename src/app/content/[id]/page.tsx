"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Post, PostTarget } from "@/db/schema";
import { PLATFORMS, formatNumber } from "@/lib/platforms";
import { ErrorState, PlatformBadge, Sheet, Skeleton, StatusPill, Toast, TopBar, useToast } from "@/components/ui";
import { EyeIcon, HeartIcon, TrashIcon } from "@/components/Icons";

type PostWithTargets = Post & { targets: PostTarget[] };

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostWithTargets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", caption: "", hashtags: "" });
  const { toast, show } = useToast();

  async function load() {
    const res = await fetch("/api/posts", { cache: "no-store" });
    if (!res.ok) return setError("Gagal memuat");
    const all = (await res.json()) as PostWithTargets[];
    const p = all.find((x) => x.id === Number(id));
    if (!p) return setError("Postingan tidak ditemukan");
    setPost(p);
    setForm({ title: p.title, caption: p.caption, hashtags: p.hashtags.map((h) => `#${h}`).join(" ") });
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(msg);
    const res = await fetch(`/api/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setPost(await res.json());
    setBusy(null);
    show(msg);
  }

  async function remove() {
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    router.push("/content");
  }

  return (
    <div>
      <TopBar
        title="Detail Konten"
        back="/content"
        action={
          <button onClick={() => setConfirm(true)} className="rounded-full p-2 text-red-600 hover:bg-red-50" aria-label="Hapus">
            <TrashIcon />
          </button>
        }
      />
      <div className="px-4">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !post ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="fade-up space-y-4">
            <div className="flex h-44 items-center justify-center rounded-xl text-6xl shadow-inner" style={{ background: post.thumbnailColor }}>
              {post.mediaType === "video" ? "🎬" : post.mediaType === "short" ? "📱" : post.mediaType === "image" ? "🖼️" : "📝"}
            </div>

            <div className="card p-4">
              <div className="flex items-start justify-between gap-2">
                {editing ? (
                  <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                ) : (
                  <h2 className="text-lg font-bold">{post.title}</h2>
                )}
                <StatusPill status={post.status} />
              </div>
              {editing ? (
                <>
                  <textarea className="input mt-2 min-h-24" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
                  <input className="input mt-2" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => setEditing(false)} className="btn-outline">
                      Batal
                    </button>
                    <button
                      onClick={async () => {
                        await patch(
                          { title: form.title, caption: form.caption, hashtags: form.hashtags.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, "")) },
                          "Perubahan disimpan",
                        );
                        setEditing(false);
                      }}
                      className="btn-primary"
                    >
                      Simpan
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{post.caption || <span className="text-stone-400">Tanpa caption</span>}</p>
                  {post.hashtags.length > 0 && <p className="mt-2 text-sm font-semibold text-primary">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>}
                  <p className="mt-3 text-xs text-stone-500">
                    {post.status === "published" && post.publishedAt
                      ? `Terbit ${new Date(post.publishedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`
                      : post.status === "scheduled" && post.scheduledAt
                        ? `Dijadwalkan ${new Date(post.scheduledAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}`
                        : `Dibuat ${new Date(post.createdAt).toLocaleString("id-ID", { dateStyle: "medium" })}`}
                  </p>
                  {post.status !== "published" && (
                    <button onClick={() => setEditing(true)} className="btn-ghost mt-2 px-3 py-1 text-xs">
                      Edit teks
                    </button>
                  )}
                </>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Platform tujuan</p>
              <div className="card divide-y divide-amber-50">
                {post.targets.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <PlatformBadge platform={t.platform} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{PLATFORMS[t.platform].name}</p>
                      {t.status === "published" ? (
                        <div className="flex items-center gap-3 text-xs text-stone-500">
                          <span className="flex items-center gap-0.5">
                            <EyeIcon /> {formatNumber(t.views)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <HeartIcon /> {formatNumber(t.likes)}
                          </span>
                          <span>💬 {formatNumber(t.comments)}</span>
                          <span>↗ {formatNumber(t.shares)}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500">{t.errorMessage ?? "Menunggu publikasi"}</p>
                      )}
                    </div>
                    <StatusPill status={t.status} />
                  </div>
                ))}
              </div>
            </div>

            {post.status !== "published" && (
              <div className="space-y-2">
                <button onClick={() => patch({ action: "publish" }, "Postingan diterbitkan!")} disabled={!!busy} className="btn-primary w-full py-3.5">
                  {busy ? "Menerbitkan ke semua platform…" : "Terbitkan sekarang"}
                </button>
                {post.status === "scheduled" && (
                  <button onClick={() => patch({ action: "unschedule" }, "Jadwal dibatalkan")} disabled={!!busy} className="btn-outline w-full">
                    Batalkan jadwal
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Hapus postingan?">
        <p className="text-sm text-stone-600">Tindakan ini tidak bisa dibatalkan.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirm(false)} className="btn-outline">
            Batal
          </button>
          <button onClick={remove} className="btn-danger">
            Hapus
          </button>
        </div>
      </Sheet>
      <Toast toast={toast} />
    </div>
  );
}
