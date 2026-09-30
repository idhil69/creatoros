"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveMessage, LiveStream, Platform, SocialAccount } from "@/db/schema";
import { PLATFORMS, formatNumber } from "@/lib/platforms";
import { PlatformBadge, Sheet, Skeleton, Toast, TopBar, useFetch, useToast } from "@/components/ui";
import { CheckIcon, ChevronIcon, LiveIcon, SendIcon, TrashIcon } from "@/components/Icons";

type LiveState = { stream: LiveStream | null; messages: LiveMessage[]; history: LiveStream[] };
type Summary = {
  stream: LiveStream;
  durationSec: number;
  totalMessages: number;
  byType: Record<string, number>;
  byPlatform: Record<string, number>;
  topFans: { author: string; score: number }[];
  questions: LiveMessage[];
};

const CATEGORIES = ["Just Chatting", "Gaming", "Musik", "Tutorial", "Kuliner", "Q&A", "Unboxing", "Olahraga"];
const QUICK_REPLIES = ["Terima kasih sudah nonton! 🙏", "Jangan lupa follow ya ✨", "Pertanyaan bagus, aku jawab sekarang 👇", "Sebentar lagi kita mulai segmen berikutnya 🔥"];

function fmtDur(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (h ? `${h}:` : "") + `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function LivePage() {
  const accounts = useFetch<SocialAccount[]>("/api/accounts");
  const [state, setState] = useState<LiveState | null>(null);
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const { toast, show } = useToast();

  const poll = useCallback(async () => {
    const res = await fetch("/api/live", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  const connectedPlatforms = [...new Set((accounts.data ?? []).filter((a) => a.status === "connected").map((a) => a.platform))];
  const realPlatforms = new Set((accounts.data ?? []).filter((a) => a.status === "connected" && !a.isMock).map((a) => a.platform));

  if (summaryId !== null) {
    return <SummaryView id={summaryId} onClose={() => setSummaryId(null)} />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Live Center" subtitle={state?.stream ? "Sedang siaran" : "Studio siaran multi-platform"} back="/" />
      {!state ? (
        <div className="px-4">
          <Skeleton className="h-64" />
        </div>
      ) : state.stream ? (
        <OnAir state={state} onRefresh={poll} onEnded={(id) => setSummaryId(id)} show={show} />
      ) : (
        <Setup connectedPlatforms={connectedPlatforms} realPlatforms={realPlatforms} history={state.history} onStarted={poll} onOpenSummary={setSummaryId} show={show} />
      )}
      <Toast toast={toast} />
    </div>
  );
}

/* ---------------- Camera preview ---------------- */
function CameraPreview({
  live,
  muted,
  camOff,
  onStreamReady,
}: {
  live?: boolean;
  muted: boolean;
  camOff: boolean;
  onStreamReady?: (stream: MediaStream) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "noaudio" | "denied">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let audioCtx: AudioContext | null = null;

    async function init() {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setStatus("denied");
        setErrMsg("Akses kamera membutuhkan HTTPS. Buka aplikasi lewat alamat https://");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("denied");
        setErrMsg("Browser ini tidak mendukung akses kamera.");
        return;
      }
      setStatus("loading");
      let s: MediaStream | null = null;
      try {
        // Coba kamera + mic sekaligus
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!cancelled) setStatus("ok");
      } catch {
        // Fallback: kamera saja (mic ditolak / tidak ada)
        try {
          s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
          if (!cancelled) setStatus("noaudio");
        } catch (e) {
          if (!cancelled) {
            setStatus("denied");
            const name = (e as DOMException)?.name;
            setErrMsg(
              name === "NotAllowedError"
                ? "Izin kamera ditolak. Ketuk ikon 🔒 di samping alamat → Izin → aktifkan Kamera & Mikrofon, lalu ketuk Coba lagi."
                : name === "NotFoundError"
                  ? "Kamera tidak ditemukan di perangkat ini."
                  : name === "NotReadableError"
                    ? "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi."
                    : "Gagal mengakses kamera. Ketuk Coba lagi.",
            );
          }
          return;
        }
      }
      if (!s) return;
      if (cancelled) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = s;
      // Elemen <video> selalu ter-mount, jadi ref dijamin ada di sini
      const v = videoRef.current;
      if (v) {
        v.srcObject = s;
        v.play().catch(() => {});
      }
      onStreamReady?.(s);
      // Meter level suara mic (bukti mic benar-benar aktif)
      if (s.getAudioTracks().length) {
        try {
          audioCtx = new AudioContext();
          audioCtx.resume().catch(() => {});
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          audioCtx.createMediaStreamSource(s).connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const loop = () => {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            if (meterRef.current) meterRef.current.style.width = `${Math.min(100, Math.round((avg / 70) * 100))}%`;
            raf = requestAnimationFrame(loop);
          };
          loop();
        } catch {
          /* meter opsional */
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      audioCtx?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt, facing]);

  // Toggle kamera/mic tanpa menghentikan stream (cukup enable/disable track)
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !camOff));
  }, [camOff, status]);
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted, status]);

  const showVideo = (status === "ok" || status === "noaudio") && !camOff;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-stone-900">
      {/* Video selalu ter-mount agar srcObject bisa dipasang kapan pun */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${showVideo ? "" : "hidden"}`}
      />
      {!showVideo && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-stone-800 to-stone-950 px-6 text-center text-stone-400">
          {status === "loading" ? (
            <>
              <span className="animate-pulse text-4xl">🎥</span>
              <p className="mt-2 text-xs">Meminta izin kamera & mic…</p>
            </>
          ) : camOff && status !== "denied" ? (
            <>
              <span className="text-4xl">📷</span>
              <p className="mt-2 text-xs">Kamera dimatikan</p>
            </>
          ) : (
            <>
              <span className="text-4xl">🚫</span>
              <p className="mt-2 text-xs leading-relaxed">{errMsg}</p>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-3 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                🔄 Coba lagi
              </button>
            </>
          )}
        </div>
      )}
      {live && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE
        </span>
      )}
      {muted ? (
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">🔇 Mic mati</span>
      ) : status === "noaudio" ? (
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">⚠️ Tanpa mic</span>
      ) : null}
      {showVideo && (
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-sm text-white"
          aria-label="Balik kamera depan/belakang"
        >
          🔄
        </button>
      )}
      {showVideo && status === "ok" && (
        <div className="absolute bottom-0 left-0 h-1 w-full bg-black/40">
          <div ref={meterRef} className="h-full rounded-r-full bg-green-400 transition-[width] duration-75" style={{ width: "0%" }} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Setup phase ---------------- */
function Setup({
  connectedPlatforms,
  realPlatforms,
  history,
  onStarted,
  onOpenSummary,
  show,
}: {
  connectedPlatforms: Platform[];
  realPlatforms: Set<Platform>;
  history: LiveStream[];
  onStarted: () => void;
  onOpenSummary: (id: number) => void;
  show: (m: string, t?: "success" | "error") => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [latency, setLatency] = useState<"low" | "normal" | "ultra">("low");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [camOff, setCamOff] = useState(false);
  const [muted, setMuted] = useState(false);
  const [livepeerKey, setLivepeerKey] = useState("");
  const [livepeerApiKey, setLivepeerApiKey] = useState("");

  useEffect(() => {
    setLivepeerKey(localStorage.getItem("livepeerKey") || "");
    setLivepeerApiKey(localStorage.getItem("livepeerApiKey") || "");
  }, []);

  useEffect(() => {
    if (platforms.length === 0 && connectedPlatforms.length) setPlatforms(connectedPlatforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedPlatforms.length]);

  const checklist = [
    { label: "Judul siaran", ok: title.trim().length > 3 },
    { label: "Minimal 1 platform", ok: platforms.length > 0 },
    { label: "Kamera & mic", ok: !camOff && !muted },
    { label: "Koneksi internet", ok: true },
  ];
  const ready = checklist.slice(0, 2).every((c) => c.ok);

  async function start() {
    if (!ready) return show("Lengkapi judul dan pilih platform", "error");
    setBusy(true);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(null);
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, category, platforms, latencyMode: latency }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return show(json.error, "error");

    // Auto-multistream: Livepeer → YouTube (key YouTube baru tiap broadcast)
    const lpKey = localStorage.getItem("livepeerKey")?.trim();
    const lpApi = localStorage.getItem("livepeerApiKey")?.trim();
    const yt = json.external?.youtube as { rtmpUrl: string; streamKey: string } | undefined;
    if (lpKey && lpApi && yt) {
      try {
        const ms = await fetch("/api/livepeer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: lpApi,
            livepeerStreamKey: lpKey,
            targetName: "YouTube (CreatorOS)",
            rtmpUrl: yt.rtmpUrl,
            streamKey: yt.streamKey,
          }),
        });
        const msj = await ms.json();
        if (ms.ok) show("Kamu LIVE! Livepeer → YouTube tersambung otomatis 🎉");
        else show(`LIVE, tapi multistream gagal: ${msj.error}`, "error");
      } catch {
        show("LIVE, tapi pengaturan multistream gagal", "error");
      }
    } else {
      show("Kamu sedang LIVE! 🎉");
    }
    onStarted();
  }

  return (
    <div className="space-y-4 px-4">
      <div className="relative">
        <CameraPreview muted={muted} camOff={camOff} />
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
            <span className="text-7xl font-bold text-white">{countdown}</span>
          </div>
        )}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          <button onClick={() => setMuted((m) => !m)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${muted ? "bg-red-600 text-white" : "bg-white/90 text-stone-800"}`}>
            {muted ? "🔇 Mic" : "🎙️ Mic"}
          </button>
          <button onClick={() => setCamOff((c) => !c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${camOff ? "bg-red-600 text-white" : "bg-white/90 text-stone-800"}`}>
            {camOff ? "📷 Kamera off" : "📹 Kamera"}
          </button>
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <div>
          <Label>Judul siaran</Label>
          <input className="input" placeholder="Contoh: Ngobrol santai + Q&A editing" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Deskripsi (opsional)</Label>
          <textarea className="input min-h-16" placeholder="Apa yang akan dibahas hari ini?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Kategori</Label>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`chip shrink-0 px-3 py-1.5 ${category === c ? "bg-primary text-white" : "bg-amber-50 text-stone-600"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Livepeer Stream Key (opsional — siaran langsung dari browser)</Label>
          <input
            className="input font-mono text-xs"
            placeholder="Contoh: 0e87-mx1k-n6b1-lpwf"
            value={livepeerKey}
            onChange={(e) => {
              setLivepeerKey(e.target.value);
              localStorage.setItem("livepeerKey", e.target.value);
            }}
          />
          <p className="mt-1 text-[10px] text-stone-500">
            Isi stream key dari livepeer.studio untuk menyiarkan kamera HP ini langsung via WebRTC (tanpa OBS). Bisa dipakai bersama YouTube LIVE ASLI
            (multistream diatur di Livepeer), atau kosongkan untuk simulasi/encoder eksternal.
          </p>
          {livepeerKey.trim() && !/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(livepeerKey.trim()) && (
            <p className="mt-1 rounded-lg bg-orange-50 px-2 py-1.5 text-[10px] font-semibold text-orange-700">
              ⚠️ Format key tampak salah. Stream Key Livepeer berpola <code>xxxx-xxxx-xxxx-xxxx</code> (Dashboard → Streams → pilih stream → Stream key).
              Jangan pakai API Key (format panjang UUID) atau Playback ID.
            </p>
          )}
          {livepeerKey.trim() && (
            <>
              <div className="mt-2">
                <Label>Livepeer API Key (opsional — auto-teruskan ke YouTube)</Label>
                <input
                  className="input font-mono text-xs"
                  placeholder="Dari livepeer.studio → Developers → API Keys"
                  value={livepeerApiKey}
                  onChange={(e) => {
                    setLivepeerApiKey(e.target.value);
                    localStorage.setItem("livepeerApiKey", e.target.value);
                  }}
                />
                <p className="mt-1 text-[10px] text-stone-500">
                  Jika diisi + YouTube LIVE ASLI dipilih, CreatorOS otomatis mengatur Multistream Livepeer → YouTube setiap mulai live (key YouTube
                  berubah tiap siaran, jadi ini menghemat langkah manual).
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card p-4">
        <Label>Siarkan ke</Label>
        {connectedPlatforms.length === 0 ? (
          <p className="text-sm text-stone-500">
            Belum ada akun terhubung.{" "}
            <Link href="/accounts" className="font-semibold text-primary">
              Hubungkan sekarang
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {connectedPlatforms.map((p) => {
              const on = platforms.includes(p);
              const real = realPlatforms.has(p) && p === "youtube";
              return (
                <button
                  key={p}
                  onClick={() => setPlatforms((s) => (on ? s.filter((x) => x !== p) : [...s, p]))}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${on ? "border-primary bg-amber-50" : "border-amber-200 bg-white"}`}
                >
                  <PlatformBadge platform={p} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-bold">
                      {PLATFORMS[p].name}
                      <span className={`chip px-2 py-0 text-[10px] ${real ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-500"}`}>
                        {real ? "🔴 LIVE ASLI" : "Simulasi"}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-stone-500">
                      {real ? "Broadcast sungguhan dibuat di channel YouTube kamu" : `RTMP · rtmp://live.${p}.com/app · 1080p60 maks`}
                    </p>
                  </div>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-primary bg-primary text-white" : "border-stone-300"}`}>
                    {on && <CheckIcon className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          <Label>Mode latensi</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["ultra", "Ultra rendah", "~2 dtk"],
                ["low", "Rendah", "~5 dtk"],
                ["normal", "Normal", "~15 dtk"],
              ] as const
            ).map(([id, label, sub]) => (
              <button key={id} onClick={() => setLatency(id)} className={`rounded-xl border p-2 text-center ${latency === id ? "border-primary bg-amber-50" : "border-amber-200 bg-white"}`}>
                <p className="text-xs font-bold">{label}</p>
                <p className="text-[10px] text-stone-500">{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <Label>Checklist sebelum live</Label>
        <ul className="space-y-1.5">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${c.ok ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`}>
                <CheckIcon className="h-3 w-3" />
              </span>
              <span className={c.ok ? "text-stone-800" : "text-stone-400"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <button onClick={start} disabled={busy || !ready} className="btn w-full bg-red-600 py-3.5 text-white hover:bg-red-700">
        <LiveIcon className="h-5 w-5" /> {busy ? "Menyiapkan siaran…" : `Mulai Live di ${platforms.length} platform`}
      </button>

      {history.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold">Riwayat siaran</h2>
          <div className="card divide-y divide-amber-50">
            {history.map((s) => (
              <button key={s.id} onClick={() => onOpenSummary(s.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
                <div className="flex shrink-0 -space-x-1">
                  {s.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} size="sm" />
                  ))}
                </div>
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{s.title}</p>
                <p className="shrink-0 whitespace-nowrap text-[11px] text-stone-500">
                  {s.startedAt &&
                    new Date(s.startedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}{" "}
                  · {formatNumber(s.peakViewers)} 👁
                </p>
                <ChevronIcon className="text-stone-300" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- On-air phase ---------------- */
type Tab = "chat" | "questions" | "stats" | "settings";

function OnAir({
  state,
  onRefresh,
  onEnded,
  show,
}: {
  state: LiveState;
  onRefresh: () => void;
  onEnded: (id: number) => void;
  show: (m: string, t?: "success" | "error") => void;
}) {
  const stream = state.stream!;
  const [tab, setTab] = useState<Tab>("chat");
  const [filter, setFilter] = useState<Platform | "all">("all");
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<LiveMessage | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [tick, setTick] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  // ===== Livepeer WebRTC (WHIP) — siaran riil langsung dari browser =====
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [whipStatus, setWhipStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [whipError, setWhipError] = useState("");

  const handleStreamReady = useCallback(async (s: MediaStream) => {
    const key = localStorage.getItem("livepeerKey")?.trim();
    if (!key || pcRef.current) return; // tanpa key = simulasi/encoder eksternal
    setWhipStatus("connecting");
    try {
      // 1) Sesuai docs Livepeer: HEAD request dulu untuk dapat URL server region terdekat (redirect GeoDNS)
      const headRes = await fetch(`https://livepeer.studio/webrtc/${key}`, { method: "HEAD" });
      const redirectUrl = headRes.url && headRes.url.includes("/webrtc/") ? headRes.url : `https://livepeer.studio/webrtc/${key}`;
      const host = new URL(redirectUrl).host;

      // 2) STUN/TURN milik Livepeer WAJIB untuk broadcasting (bukan STUN Google)
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: `stun:${host}` },
          { urls: `turn:${host}`, username: "livepeer", credential: "livepeer" },
        ],
      });
      pcRef.current = pc;

      // 3) Transceiver sendonly sesuai contoh resmi
      const vTrack = s.getVideoTracks()[0] ?? null;
      const aTrack = s.getAudioTracks()[0] ?? null;
      const vTransceiver = vTrack ? pc.addTransceiver(vTrack, { direction: "sendonly" }) : null;
      if (aTrack) pc.addTransceiver(aTrack, { direction: "sendonly" });

      // 3b) Prioritaskan H.264 (YouTube RTMP hanya menerima H.264; default browser sering VP8)
      try {
        const caps = RTCRtpSender.getCapabilities?.("video");
        if (caps && vTransceiver?.setCodecPreferences) {
          const h264 = caps.codecs.filter((c) => /h264/i.test(c.mimeType));
          const rest = caps.codecs.filter((c) => !/h264/i.test(c.mimeType));
          if (h264.length) vTransceiver.setCodecPreferences([...h264, ...rest]);
        }
      } catch {
        /* opsional — Livepeer tetap mentranscode ke H.264 di profil rendition */
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4) Tunggu ICE gathering (maks 5 dtk, sesuai docs)
      const ofr = await new Promise<RTCSessionDescription | null>((resolve) => {
        setTimeout(() => resolve(pc.localDescription), 5000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") resolve(pc.localDescription);
        };
      });
      if (!ofr) throw new Error("Gagal mengumpulkan ICE candidates");

      // 5) POST SDP ke URL redirect (tanpa header Authorization — tidak dipakai Livepeer WHIP)
      const whipRes = await fetch(redirectUrl, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/sdp" },
        body: ofr.sdp,
      });
      if (!whipRes.ok) {
        const errText = await whipRes.text();
        throw new Error(`Ditolak server Livepeer (${whipRes.status}): ${errText.substring(0, 60)}`);
      }
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: await whipRes.text() }));

      // 6) Pantau status koneksi sebenarnya
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setWhipStatus("live");
        else if (pc.connectionState === "failed") {
          setWhipStatus("error");
          setWhipError("Koneksi WebRTC terputus (jaringan/firewall). Coba jaringan lain.");
        }
      };
      setWhipStatus("live");
    } catch (e) {
      pcRef.current?.close();
      pcRef.current = null;
      setWhipStatus("error");
      setWhipError((e as Error).message || "Gagal menghubungkan ke WHIP");
    }
  }, []);

  useEffect(() => {
    return () => {
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (autoScroll && tab === "chat") chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages.length, autoScroll, tab]);

  const elapsed = stream.startedAt ? Math.floor((Date.now() - new Date(stream.startedAt).getTime()) / 1000) : 0;
  void tick;

  const action = useCallback(
    async (body: Record<string, unknown>) => {
      await fetch("/api/live", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onRefresh();
    },
    [onRefresh],
  );

  async function endLive() {
    const res = await fetch("/api/live", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "end" }) });
    const json = await res.json();
    setConfirmEnd(false);
    onEnded(json.summaryId ?? stream.id);
  }

  const pinned = state.messages.find((m) => m.isPinned);
  const chatMsgs = state.messages.filter((m) => filter === "all" || m.platform === filter);
  const questions = state.messages.filter((m) => m.type === "question");
  const unanswered = questions.filter((q) => !q.isAnswered).length;
  const healthColor = stream.health === "excellent" ? "text-green-600 bg-green-100" : stream.health === "good" ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
  const healthLabel = stream.health === "excellent" ? "Sangat baik" : stream.health === "good" ? "Baik" : "Buruk";

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="relative">
        <CameraPreview live muted={muted} camOff={camOff} onStreamReady={handleStreamReady} />
        <div className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">{fmtDur(elapsed)}</div>
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <button onClick={() => setMuted((m) => !m)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${muted ? "bg-red-600 text-white" : "bg-white/90 text-stone-800"}`}>
            {muted ? "🔇" : "🎙️"}
          </button>
          <button onClick={() => setCamOff((c) => !c)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${camOff ? "bg-red-600 text-white" : "bg-white/90 text-stone-800"}`}>
            {camOff ? "📷" : "📹"}
          </button>
        </div>
      </div>

      {whipStatus !== "idle" && (
        <div
          className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            whipStatus === "live"
              ? "border border-green-200 bg-green-100 text-green-700"
              : whipStatus === "error"
                ? "border border-red-200 bg-red-100 text-red-700"
                : "border border-amber-200 bg-amber-100 text-amber-700"
          }`}
        >
          {whipStatus === "live"
            ? "✅ Terhubung ke Livepeer — kamera HP ini SEDANG SIARAN RIIL (WebRTC)"
            : whipStatus === "connecting"
              ? "⏳ Menghubungkan ke Livepeer WebRTC…"
              : `❌ Livepeer gagal: ${whipError}${/404|retrieve stream|open failed/i.test(whipError) ? " — Key tidak dikenal server. Pastikan yang dipakai adalah STREAM KEY (pola xxxx-xxxx-xxxx-xxxx) dari livepeer.studio → Streams → pilih stream → Stream key, bukan API Key/Playback ID, dan stream-nya belum dihapus." : ""}`}
        </div>
      )}

      {/* Live stats strip */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Mini label="Penonton" value={formatNumber(stream.viewers)} />
        <Mini label="Puncak" value={formatNumber(stream.peakViewers)} />
        <Mini label="Suka" value={formatNumber(stream.likes)} />
        <Mini label="Follower+" value={`+${stream.newFollowers}`} />
      </div>

      <div className="mt-2 flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-amber-100">
        <div className="flex items-center gap-2">
          <span className={`chip ${healthColor}`}>● {healthLabel}</span>
          <span className="text-[11px] text-stone-500">
            {stream.bitrateKbps} kbps · {stream.fps} fps · drop {stream.droppedFrames}
          </span>
        </div>
        <div className="flex -space-x-1">
          {stream.platforms.map((p) => (
            <PlatformBadge key={p} platform={p} size="sm" />
          ))}
        </div>
      </div>

      {stream.external?.youtube && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
            🔴 YOUTUBE LIVE ASLI — hubungkan encoder untuk on-air
          </p>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-stone-500">Server RTMP</span>
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono">{stream.external.youtube.rtmpUrl}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(stream.external!.youtube!.rtmpUrl).then(() => show("Server RTMP disalin"))}
                className="btn-outline shrink-0 px-2.5 py-1 text-[11px]"
              >
                Salin
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-stone-500">Stream key</span>
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 font-mono">
                {showKey ? stream.external.youtube.streamKey : "••••-••••-••••-••••"}
              </code>
              <button onClick={() => setShowKey((s) => !s)} className="btn-ghost shrink-0 px-2 py-1 text-[11px]">
                {showKey ? "🙈" : "👁"}
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(stream.external!.youtube!.streamKey).then(() => show("Stream key disalin"))}
                className="btn-outline shrink-0 px-2.5 py-1 text-[11px]"
              >
                Salin
              </button>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${stream.external.youtube.videoId}`}
              target="_blank"
              rel="noreferrer"
              className="btn-outline flex-1 px-2 py-1.5 text-[11px]"
            >
              ▶ Tonton di YouTube
            </a>
            <a
              href={`https://studio.youtube.com/video/${stream.external.youtube.videoId}/livestreaming`}
              target="_blank"
              rel="noreferrer"
              className="btn-outline flex-1 px-2 py-1.5 text-[11px]"
            >
              🎛 YouTube Studio
            </a>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-red-600">
            Masukkan Server + Key ke aplikasi encoder (Larix Broadcaster / PRISM / OBS). Siaran otomatis on-air saat encoder terhubung, dan otomatis
            berakhir saat encoder berhenti. Chat & penonton di bawah adalah data YouTube sungguhan.
          </p>
          {stream.external.youtube.lastError && (
            <p className="mt-1 rounded bg-white px-2 py-1 text-[10px] text-orange-700">⚠️ {stream.external.youtube.lastError}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-3 grid grid-cols-4 rounded-full bg-amber-100 p-1 text-xs font-semibold">
        {(
          [
            ["chat", "Chat"],
            ["questions", `Tanya${unanswered ? ` (${unanswered})` : ""}`],
            ["stats", "Statistik"],
            ["settings", "Kontrol"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`rounded-full py-1.5 ${tab === id ? "bg-white text-primary shadow-sm" : "text-stone-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <>
          {pinned && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <span className="flex-1">
                <span className="font-bold text-primary">📌 {pinned.author}: </span>
                {pinned.message}
              </span>
              <button onClick={() => action({ action: "unpin" })} className="text-stone-400">
                ✕
              </button>
            </div>
          )}
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            <button onClick={() => setFilter("all")} className={`chip shrink-0 px-3 py-1.5 ${filter === "all" ? "bg-primary text-white" : "bg-white text-stone-600 ring-1 ring-amber-200"}`}>
              Semua
            </button>
            {stream.platforms.map((p) => (
              <button key={p} onClick={() => setFilter(p)} className={`chip shrink-0 px-3 py-1.5 ${filter === p ? "bg-primary text-white" : "bg-white text-stone-600 ring-1 ring-amber-200"}`}>
                {PLATFORMS[p].name} · {stream.viewerBreakdown[p] ?? 0}
              </button>
            ))}
          </div>
          <div
            ref={chatRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
            }}
            className="card mt-2 h-64 space-y-1.5 overflow-y-auto p-3"
          >
            {chatMsgs.map((m) => (
              <MessageRow key={m.id} m={m} onSelect={() => m.author !== "Host" && m.author !== "CreatorOS" && setSelected(m)} />
            ))}
          </div>
          {!autoScroll && (
            <button onClick={() => setAutoScroll(true)} className="btn-ghost mx-auto mt-1 px-3 py-1 text-xs">
              ↓ Pesan baru
            </button>
          )}
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {QUICK_REPLIES.map((q) => (
              <button key={q} onClick={() => action({ action: "send", message: q })} className="chip shrink-0 bg-white text-stone-700 ring-1 ring-amber-200">
                {q}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!msg.trim()) return;
              action({ action: "send", message: msg });
              setMsg("");
            }}
          >
            <input className="input flex-1" placeholder="Balas sebagai host…" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button type="submit" className="btn-primary px-4" aria-label="Kirim">
              <SendIcon />
            </button>
          </form>
        </>
      )}

      {tab === "questions" && (
        <div className="mt-3 space-y-2">
          {questions.length === 0 ? (
            <div className="card p-6 text-center text-sm text-stone-500">Belum ada pertanyaan dari penonton.</div>
          ) : (
            [...questions].reverse().map((q) => (
              <div key={q.id} className={`card p-3 ${q.isAnswered ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2">
                  <PlatformBadge platform={q.platform} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-primary">{q.author}</p>
                    <p className="text-sm">{q.message}</p>
                  </div>
                  {q.isAnswered && <span className="chip bg-green-100 text-green-700">Dijawab</span>}
                </div>
                {!q.isAnswered && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => action({ action: "pin", messageId: q.id })} className="btn-outline px-3 py-1 text-xs">
                      📌 Tampilkan
                    </button>
                    <button onClick={() => action({ action: "answer", messageId: q.id })} className="btn-primary px-3 py-1 text-xs">
                      ✓ Sudah dijawab
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "stats" && (
        <div className="mt-3 space-y-3">
          <div className="card p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Penonton per platform</p>
            {stream.platforms.map((p) => {
              const v = stream.viewerBreakdown[p] ?? 0;
              const pct = stream.viewers ? Math.round((v / stream.viewers) * 100) : 0;
              return (
                <div key={p} className="mb-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <PlatformBadge platform={p} size="sm" /> {PLATFORMS[p].name}
                    </span>
                    <span className="font-bold">
                      {v} <span className="text-xs font-normal text-stone-500">({pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PLATFORMS[p].color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Total pesan" value={String(state.messages.length)} />
            <Kpi label="Pertanyaan" value={String(questions.length)} />
            <Kpi label="Gift / Super Chat" value={`${formatNumber(stream.giftsTotal)} koin`} />
            <Kpi label="Durasi" value={fmtDur(elapsed)} />
          </div>
          <div className="card p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Kesehatan stream</p>
            <div className="grid grid-cols-3 text-center">
              <div>
                <p className="text-lg font-bold">{stream.bitrateKbps}</p>
                <p className="text-[11px] text-stone-500">kbps</p>
              </div>
              <div>
                <p className="text-lg font-bold">{stream.fps}</p>
                <p className="text-[11px] text-stone-500">fps</p>
              </div>
              <div>
                <p className="text-lg font-bold">{stream.droppedFrames}</p>
                <p className="text-[11px] text-stone-500">frame drop</p>
              </div>
            </div>
            <p className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold ${healthColor}`}>
              {stream.health === "poor" ? "Koneksi tidak stabil — pertimbangkan turunkan resolusi ke 720p" : stream.health === "good" ? "Koneksi cukup baik" : "Koneksi sangat stabil"}
            </p>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="mt-3 space-y-3">
          <div className="card divide-y divide-amber-50">
            <Row label="Judul" value={stream.title} />
            <Row label="Kategori" value={stream.category} />
            <Row label="Latensi" value={stream.latencyMode === "ultra" ? "Ultra rendah" : stream.latencyMode === "low" ? "Rendah" : "Normal"} />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Stream key</p>
                <p className="font-mono text-xs text-stone-500">{showKey ? stream.streamKey : "••••-••••-••••-••••"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShowKey((s) => !s)} className="btn-ghost px-3 py-1 text-xs">
                  {showKey ? "Sembunyikan" : "Lihat"}
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(stream.streamKey).then(() => show("Stream key disalin"))}
                  className="btn-outline px-3 py-1 text-xs"
                >
                  Salin
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Mode lambat (slow mode)</p>
                <p className="text-xs text-stone-500">Batasi 1 pesan / 10 dtk per penonton</p>
              </div>
              <button onClick={() => action({ action: "slowmode" })} className={`relative h-7 w-12 rounded-full transition ${stream.slowMode ? "bg-primary" : "bg-stone-300"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${stream.slowMode ? "left-6" : "left-1"}`} />
              </button>
            </div>
          </div>

          <div className="card p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Penonton diblokir ({stream.blockedAuthors.length})</p>
            {stream.blockedAuthors.length === 0 ? (
              <p className="text-sm text-stone-500">Tidak ada. Ketuk pesan di chat untuk memoderasi.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stream.blockedAuthors.map((a) => (
                  <button key={a} onClick={() => action({ action: "unblock", author: a })} className="chip bg-red-50 text-red-700 ring-1 ring-red-200">
                    {a} ✕
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setConfirmEnd(true)} className="btn-danger w-full py-3">
            Akhiri siaran
          </button>
        </div>
      )}

      {tab !== "settings" && (
        <button onClick={() => setConfirmEnd(true)} className="btn mt-3 w-full border border-red-200 bg-white py-2.5 text-red-600 hover:bg-red-50">
          Akhiri siaran
        </button>
      )}

      {/* Moderation sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Moderasi pesan">
        {selected && (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 p-3 text-sm">
              <div className="flex items-center gap-2">
                <PlatformBadge platform={selected.platform} size="sm" />
                <span className="font-bold text-primary">{selected.author}</span>
              </div>
              <p className="mt-1">{selected.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  action({ action: "pin", messageId: selected.id });
                  setSelected(null);
                }}
                className="btn-outline"
              >
                📌 Sematkan
              </button>
              <button
                onClick={() => {
                  action({ action: "send", message: `@${selected.author} ` + (selected.type === "gift" ? "terima kasih giftnya! 🙏" : "terima kasih! 🙌") });
                  setSelected(null);
                }}
                className="btn-outline"
              >
                💬 Balas cepat
              </button>
              <button
                onClick={() => {
                  action({ action: "delete", messageId: selected.id });
                  setSelected(null);
                }}
                className="btn-outline text-red-600"
              >
                <TrashIcon className="h-4 w-4" /> Hapus pesan
              </button>
              <button
                onClick={() => {
                  action({ action: "block", author: selected.author });
                  setSelected(null);
                  show(`${selected.author} diblokir`, "error");
                }}
                className="btn-danger"
              >
                🚫 Blokir
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Akhiri siaran?">
        <p className="text-sm text-stone-600">
          Siaran akan dihentikan di semua platform ({stream.platforms.map((p) => PLATFORMS[p].name).join(", ")}). Ringkasan performa akan ditampilkan.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => setConfirmEnd(false)} className="btn-outline">
            Lanjutkan live
          </button>
          <button onClick={endLive} className="btn-danger">
            Akhiri
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function MessageRow({ m, onSelect }: { m: LiveMessage; onSelect: () => void }) {
  if (m.type === "gift")
    return (
      <button onClick={onSelect} className="flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-amber-100 to-amber-50 px-2 py-1.5 text-left text-sm">
        <PlatformBadge platform={m.platform} size="sm" />
        <span className="flex-1">
          <span className="font-bold text-primary">{m.author}</span> {m.message}
        </span>
        <span className="chip bg-secondary text-amber-950">+{m.amount}</span>
      </button>
    );
  if (m.type === "follow")
    return (
      <div className="flex items-center gap-2 px-2 text-xs text-stone-500">
        <PlatformBadge platform={m.platform} size="sm" />
        <span>
          <b className="text-stone-700">{m.author}</b> {m.message} 💛
        </span>
      </div>
    );
  if (m.type === "system")
    return <p className="rounded-lg bg-stone-100 px-2 py-1 text-center text-[11px] text-stone-500">{m.message}</p>;
  const isHost = m.author === "Host";
  return (
    <button onClick={onSelect} className={`flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left ${isHost ? "bg-amber-50" : "hover:bg-stone-50"}`}>
      <PlatformBadge platform={m.platform} size="sm" />
      <p className="text-sm leading-snug">
        <span className={`font-bold ${isHost ? "text-accent" : "text-primary"}`}>{isHost ? "🎙️ Kamu" : m.author}</span>{" "}
        {m.type === "question" && <span className="chip bg-blue-100 px-1.5 py-0 text-[10px] text-blue-700">Q</span>}{" "}
        <span className="text-stone-700">{m.message}</span>
      </p>
    </button>
  );
}

/* ---------------- Post-live summary ---------------- */
function SummaryView({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, loading } = useFetch<Summary>(`/api/live/${id}`);
  const s = data?.stream;
  return (
    <div>
      <TopBar title="Ringkasan Siaran" subtitle={s?.title} action={<button onClick={onClose} className="btn-outline px-4 py-1.5 text-xs">Tutup</button>} />
      <div className="space-y-4 px-4">
        {loading || !data || !s ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="card bg-gradient-to-br from-primary to-accent p-5 text-white">
              <p className="text-xs text-amber-100">Siaran selesai 🎉</p>
              <p className="text-2xl font-bold">{fmtDur(data.durationSec)}</p>
              <div className="mt-3 flex items-center gap-2">
                {s.platforms.map((p) => (
                  <PlatformBadge key={p} platform={p} size="sm" />
                ))}
                <span className="text-xs text-amber-100">
                  {s.startedAt && new Date(s.startedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Kpi label="Puncak penonton" value={formatNumber(s.peakViewers)} />
              <Kpi label="Suka" value={formatNumber(s.likes)} />
              <Kpi label="Follower baru" value={`+${s.newFollowers}`} />
              <Kpi label="Gift / Super Chat" value={`${formatNumber(s.giftsTotal)} koin`} />
              <Kpi label="Total pesan" value={String(data.totalMessages)} />
              <Kpi label="Pertanyaan" value={String(data.byType.question ?? 0)} />
            </div>
            <div className="card p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Aktivitas chat per platform</p>
              {s.platforms.map((p) => {
                const v = data.byPlatform[p] ?? 0;
                const pct = data.totalMessages ? Math.round((v / data.totalMessages) * 100) : 0;
                return (
                  <div key={p} className="mb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <PlatformBadge platform={p} size="sm" /> {PLATFORMS[p].name}
                      </span>
                      <span className="font-bold">{v} pesan</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-amber-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PLATFORMS[p].color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {data.topFans.length > 0 && (
              <div className="card p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Penggemar teraktif</p>
                {data.topFans.map((f, i) => (
                  <div key={f.author} className="flex items-center justify-between py-1.5 text-sm">
                    <span>
                      <span className="mr-2 text-stone-400">{["🥇", "🥈", "🥉", "4.", "5."][i]}</span>
                      <b className="text-primary">{f.author}</b>
                    </span>
                    <span className="text-xs text-stone-500">{f.score} poin</span>
                  </div>
                ))}
              </div>
            )}
            {data.questions.length > 0 && (
              <div className="card p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Pertanyaan penonton (ide konten berikutnya)</p>
                <ul className="space-y-1.5 text-sm">
                  {data.questions.map((q) => (
                    <li key={q.id} className="flex gap-2">
                      <span className="text-stone-400">•</span>
                      <span>
                        {q.message} <span className="text-xs text-stone-400">— {q.author}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link href="/ai" className="btn-secondary w-full">
              ✨ Buat ide konten dari pertanyaan ini
            </Link>
            <button onClick={onClose} className="btn-primary w-full">
              Kembali ke Live Center
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- small bits ---------------- */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">{children}</p>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-2 text-center">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[10px] text-stone-500">{label}</p>
    </div>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="max-w-[60%] truncate font-semibold">{value}</span>
    </div>
  );
}
