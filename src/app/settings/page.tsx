"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton, Toast, TopBar, useFetch, useToast } from "@/components/ui";
import { ChevronIcon, LinkIcon, LiveIcon, SparkleIcon } from "@/components/Icons";

type SettingsRes = { settings: Record<string, string>; logs: { id: number; action: string; detail: string; createdAt: string }[] };

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function SettingsPage() {
  const { data, loading, reload } = useFetch<SettingsRes>("/api/settings");
  const [local, setLocal] = useState<Record<string, string>>({});
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    if (data) setLocal(data.settings);
  }, [data]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function save(patch: Record<string, string>) {
    const next = { ...local, ...patch };
    setLocal(next);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    show("Setelan disimpan");
    reload();
  }

  const toggle = (key: string) => save({ [key]: local[key] === "true" ? "false" : "true" });

  return (
    <div>
      <TopBar title="Setelan" subtitle="CreatorOS v1.0.0-alpha" />
      <div className="space-y-5 px-4">
        <div className="card overflow-hidden bg-gradient-to-br from-primary to-accent p-4 text-white">
          <p className="text-xs text-amber-100">Pasang sebagai aplikasi Android</p>
          <p className="text-base font-bold">{installed ? "CreatorOS sudah terpasang ✓" : "Instal CreatorOS di layar utama"}</p>
          <p className="mt-1 text-xs text-amber-100">Berjalan layar penuh seperti APK, dengan ikon di home screen dan dukungan offline.</p>
          {!installed && (
            <button
              onClick={async () => {
                if (installEvt) {
                  await installEvt.prompt();
                  const { outcome } = await installEvt.userChoice;
                  if (outcome === "accepted") setInstalled(true);
                } else {
                  show("Buka menu browser (⋮) → 'Tambahkan ke layar utama'");
                }
              }}
              className="btn mt-3 bg-white text-primary"
            >
              Instal aplikasi
            </button>
          )}
        </div>

        <Group title="Profil">
          <div className="px-4 py-3">
            <p className="mb-1 text-xs text-stone-500">Nama kreator</p>
            <input
              className="input"
              value={local.creatorName ?? ""}
              onChange={(e) => setLocal({ ...local, creatorName: e.target.value })}
              onBlur={() => save({ creatorName: local.creatorName ?? "" })}
            />
          </div>
          <Item href="/accounts" icon={<LinkIcon className="h-5 w-5" />} label="Akun terhubung" />
          <Item href="/live" icon={<LiveIcon className="h-5 w-5" />} label="Live Center" />
          <Item href="/ai" icon={<SparkleIcon className="h-5 w-5" />} label="Asisten AI" />
        </Group>

        {loading ? (
          <Skeleton className="h-40" />
        ) : (
          <Group title="Preferensi">
            <Toggle label="Mode mock (offline)" desc="Respons OAuth & data deterministik" on={local.mockMode === "true"} onToggle={() => toggle("mockMode")} />
            <Toggle label="Notifikasi" desc="Pengingat jadwal & ringkasan harian" on={local.notifications === "true"} onToggle={() => toggle("notifications")} />
            <Toggle label="Hashtag otomatis" desc="Sarankan hashtag saat membuat konten" on={local.autoHashtags === "true"} onToggle={() => toggle("autoHashtags")} />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Zona waktu</p>
                <p className="text-xs text-stone-500">Untuk penjadwalan</p>
              </div>
              <select className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold" value={local.timezone ?? "Asia/Jakarta"} onChange={(e) => save({ timezone: e.target.value })}>
                <option value="Asia/Jakarta">WIB (Jakarta)</option>
                <option value="Asia/Makassar">WITA (Makassar)</option>
                <option value="Asia/Jayapura">WIT (Jayapura)</option>
              </select>
            </div>
          </Group>
        )}

        <Group title="Keamanan">
          {[
            ["Tanpa rahasia OAuth di aplikasi", true],
            ["Autentikasi dimediasi backend", true],
            ["Penyimpanan token terenkripsi (AES-256)", true],
            ["Validasi parameter state", true],
            ["Audit log koneksi akun", true],
            ["HTTPS/TLS enforcement", false],
            ["PKCE flow produksi", false],
          ].map(([label, ok]) => (
            <div key={label as string} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-stone-700">{label as string}</span>
              <span className={`chip ${ok ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>{ok ? "Aktif" : "Produksi"}</span>
            </div>
          ))}
        </Group>

        <Group title="Log audit">
          {data?.logs.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">Belum ada aktivitas.</p>}
          {data?.logs.map((l) => (
            <div key={l.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-primary">{l.action}</span>
                <span className="text-[11px] text-stone-400">{new Date(l.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <p className="text-xs text-stone-600">{l.detail}</p>
            </div>
          ))}
        </Group>

        <p className="pb-4 text-center text-[11px] text-stone-400">
          Built with ❤️ for Content Creators · MIT License
        </p>
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{title}</h2>
      <div className="card divide-y divide-amber-50">{children}</div>
    </section>
  );
}

function Item({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3">
      <span className="text-primary">{icon}</span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronIcon className="text-stone-400" />
    </Link>
  );
}

function Toggle({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-stone-500">{desc}</p>
      </div>
      <button onClick={onToggle} className={`relative h-7 w-12 rounded-full transition ${on ? "bg-primary" : "bg-stone-300"}`} aria-pressed={on}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
