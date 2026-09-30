"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SocialAccount } from "@/db/schema";
import { formatNumber } from "@/lib/platforms";
import { Avatar, PlatformBadge, Skeleton, Toast, TopBar, useFetch, useToast } from "@/components/ui";
import { CheckIcon, SparkleIcon } from "@/components/Icons";

const MEDIA = [
  { id: "video", label: "Video", emoji: "🎬" },
  { id: "short", label: "Short/Reel", emoji: "📱" },
  { id: "image", label: "Gambar", emoji: "🖼️" },
  { id: "text", label: "Teks", emoji: "📝" },
] as const;

export default function NewPostPage() {
  const router = useRouter();
  const { data: accounts, loading } = useFetch<SocialAccount[]>("/api/accounts");
  const { toast, show } = useToast();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaType, setMediaType] = useState<(typeof MEDIA)[number]["id"]>("video");
  const [selected, setSelected] = useState<number[]>([]);
  const [mode, setMode] = useState<"now" | "schedule" | "draft">("now");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 1000 * 60 * 60 * 24);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [aiBusy, setAiBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const connected = (accounts ?? []).filter((a) => a.status === "connected");
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function aiAssist(task: "caption" | "hashtags") {
    if (!title.trim()) return show("Isi judul dulu sebagai topik", "error");
    setAiBusy(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, topic: title, tone: "santai" }),
    });
    const json = await res.json();
    if (task === "caption") setCaption(json.results[0]);
    else setHashtags(json.results[0]);
    setAiBusy(false);
  }

  async function submit() {
    if (!title.trim()) return show("Judul wajib diisi", "error");
    if (selected.length === 0) return show("Pilih minimal satu akun tujuan", "error");
    setSubmitting(true);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        caption,
        hashtags: hashtags.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, "")),
        mediaType,
        accountIds: selected,
        publishNow: mode === "now",
        scheduledAt: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) return show(json.error ?? "Gagal menyimpan", "error");
    router.push(`/content/${json.id}`);
  }

  return (
    <div>
      <TopBar title="Postingan Baru" subtitle="Cross-post ke beberapa platform" back="/content" />
      <div className="space-y-5 px-4">
        <section>
          <Label>Jenis media</Label>
          <div className="grid grid-cols-4 gap-2">
            {MEDIA.map((m) => (
              <button
                key={m.id}
                onClick={() => setMediaType(m.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold ${
                  mediaType === m.id ? "border-primary bg-amber-50 text-primary" : "border-amber-200 bg-white text-stone-600"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </section>

        {mediaType !== "text" && (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-white p-6 text-center">
            <input type="file" className="hidden" accept={mediaType === "image" ? "image/*" : "video/*"} onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
            <span className="text-3xl">📤</span>
            <p className="mt-2 text-sm font-semibold">{fileName ?? "Pilih file untuk diunggah"}</p>
            <p className="text-xs text-stone-500">Mode mock: file tidak dikirim ke server</p>
          </label>
        )}

        <section>
          <Label>Judul</Label>
          <input className="input" placeholder="Contoh: Tips editing video di HP" value={title} onChange={(e) => setTitle(e.target.value)} />
        </section>

        <section>
          <div className="flex items-center justify-between">
            <Label>Caption</Label>
            <button onClick={() => aiAssist("caption")} disabled={aiBusy} className="btn-ghost px-3 py-1 text-xs">
              <SparkleIcon className="h-4 w-4" /> {aiBusy ? "Menulis…" : "Tulis dengan AI"}
            </button>
          </div>
          <textarea className="input min-h-28" placeholder="Tulis caption…" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </section>

        <section>
          <div className="flex items-center justify-between">
            <Label>Hashtag</Label>
            <button onClick={() => aiAssist("hashtags")} disabled={aiBusy} className="btn-ghost px-3 py-1 text-xs">
              <SparkleIcon className="h-4 w-4" /> Saran AI
            </button>
          </div>
          <input className="input" placeholder="#fyp #kontenkreator" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
        </section>

        <section>
          <Label>Terbitkan ke</Label>
          {loading ? (
            <Skeleton className="h-16" />
          ) : connected.length === 0 ? (
            <div className="card p-4 text-center text-sm text-stone-500">
              Belum ada akun terhubung.{" "}
              <Link href="/accounts" className="font-semibold text-primary">
                Hubungkan sekarang
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {connected.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggle(a.id)} className={`card flex w-full items-center gap-3 p-3 text-left ${on ? "ring-2 ring-primary" : ""}`}>
                    <div className="relative">
                      <Avatar color={a.avatarColor} name={a.displayName} />
                      <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-white">
                        <PlatformBadge platform={a.platform} size="sm" />
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{a.displayName}</p>
                      <p className="text-xs text-stone-500">
                        {a.username} · {formatNumber(a.followers)}
                      </p>
                    </div>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? "border-primary bg-primary text-white" : "border-stone-300"}`}>
                      {on && <CheckIcon className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <Label>Kapan diterbitkan?</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["now", "Sekarang"],
                ["schedule", "Jadwalkan"],
                ["draft", "Simpan draf"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold ${mode === id ? "border-primary bg-primary text-white" : "border-amber-200 bg-white text-stone-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "schedule" && (
            <input type="datetime-local" className="input mt-2" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          )}
        </section>

        <button onClick={submit} disabled={submitting} className="btn-primary w-full py-3.5">
          {submitting ? "Memproses…" : mode === "now" ? `Terbitkan ke ${selected.length} platform` : mode === "schedule" ? "Jadwalkan postingan" : "Simpan draf"}
        </button>
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{children}</p>;
}
