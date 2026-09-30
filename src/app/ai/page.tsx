"use client";

import { useState } from "react";
import { Toast, TopBar, useToast } from "@/components/ui";
import { SparkleIcon } from "@/components/Icons";

const TASKS = [
  { id: "caption", label: "Caption", emoji: "✍️" },
  { id: "title", label: "Judul", emoji: "🏷️" },
  { id: "hashtags", label: "Hashtag", emoji: "#️⃣" },
  { id: "ideas", label: "Ide Konten", emoji: "💡" },
] as const;
const TONES = ["santai", "profesional", "lucu"];

export default function AiPage() {
  const [task, setTask] = useState<(typeof TASKS)[number]["id"]>("caption");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("santai");
  const [results, setResults] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  async function run() {
    if (!topic.trim()) return show("Masukkan topik dulu", "error");
    setBusy(true);
    const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, topic, tone }) });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return show(json.error, "error");
    setResults(json.results);
  }

  async function copy(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      show("Disalin ke clipboard");
    } catch {
      show("Gagal menyalin", "error");
    }
  }

  return (
    <div>
      <TopBar title="Asisten AI" subtitle="Bantuan caption, judul, hashtag & ide" back="/" />
      <div className="space-y-4 px-4">
        <div className="grid grid-cols-4 gap-2">
          {TASKS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTask(t.id);
                setResults([]);
              }}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold ${
                task === t.id ? "border-primary bg-amber-50 text-primary" : "border-amber-200 bg-white text-stone-600"
              }`}
            >
              <span className="text-2xl">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="card p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Topik konten</p>
          <textarea className="input min-h-24" placeholder="Contoh: review kamera murah untuk vlog pemula" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <p className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide text-stone-500">Nada</p>
          <div className="flex gap-2">
            {TONES.map((t) => (
              <button key={t} onClick={() => setTone(t)} className={`chip px-4 py-1.5 capitalize ${tone === t ? "bg-primary text-white" : "bg-amber-50 text-stone-600"}`}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={busy} className="btn-primary mt-4 w-full py-3">
            <SparkleIcon className={`h-5 w-5 ${busy ? "animate-spin" : ""}`} /> {busy ? "Menghasilkan…" : "Hasilkan"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold">Hasil</h2>
            {results.map((r, i) => (
              <div key={i} className="card fade-up p-4" style={{ animationDelay: `${i * 60}ms` }}>
                <p className="whitespace-pre-wrap text-sm text-stone-800">{r}</p>
                <button onClick={() => copy(r)} className="btn-ghost mt-2 px-3 py-1 text-xs">
                  Salin
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-stone-400">Mode mock: hasil deterministik tanpa koneksi internet.</p>
      </div>
      <Toast toast={toast} />
    </div>
  );
}
