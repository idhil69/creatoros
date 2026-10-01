/**
 * CreatorOS Relay — browser (WebSocket/TCP 443) → ffmpeg → RTMP(S) YouTube.
 * Menghindari WebRTC/UDP yang sering diblokir jaringan seluler.
 *
 * Deploy gratis di Railway/Render (lihat docs/RELAY.md).
 * Env opsional: RELAY_TOKEN (kunci akses), PORT (otomatis di Railway/Render).
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import ffmpegPath from "ffmpeg-static";

const PORT = process.env.PORT || 8080;
const TOKEN = (process.env.RELAY_TOKEN || "").trim();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify({ ok: true, service: "creatoros-relay" }));
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  // MULTISTREAM: dukung banyak ?target= sekaligus (YouTube, Facebook, IG, TikTok, dll)
  const targets = url.searchParams.getAll("target").filter((t) => /^rtmps?:\/\/[^\s|"']+$/.test(t));
  const token = url.searchParams.get("token") || "";

  if (TOKEN && token !== TOKEN) return ws.close(1008, "Token salah");
  if (!targets.length) return ws.close(1008, "Tidak ada target RTMP valid");

  console.log(`[relay] mulai → ${targets.length} target: ${targets.map((t) => t.replace(/\/[^/]*$/, "/****")).join(" | ")}`);

  // Browser mengirim WebM (VP8/H264 + Opus) → transcode SEKALI ke H.264 + AAC,
  // lalu ffmpeg "tee" menyalin hasilnya ke semua platform serentak (hemat CPU).
  // onfail=ignore: jika satu platform putus, yang lain tetap siaran.
  const common = [
    "-hide_banner", "-loglevel", "warning",
    "-i", "pipe:0",
    "-map", "0:v?", "-map", "0:a?",
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
    "-pix_fmt", "yuv420p", "-r", "30", "-g", "60",
    "-b:v", "2500k", "-maxrate", "2500k", "-bufsize", "5000k",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-flags", "+global_header",
  ];
  const out =
    targets.length === 1
      ? ["-f", "flv", targets[0]]
      : ["-f", "tee", targets.map((t) => `[f=flv:onfail=ignore]${t}`).join("|")];
  const ff = spawn(ffmpegPath, [...common, ...out]);

  ff.stderr.on("data", (d) => {
    const line = d.toString();
    if (/error|failed|refused|denied/i.test(line)) {
      console.error("[ffmpeg]", line.trim());
      try { ws.send(JSON.stringify({ type: "error", message: line.trim().slice(0, 200) })); } catch {}
    }
  });
  ff.on("close", (code) => {
    console.log(`[relay] ffmpeg selesai (code ${code})`);
    try { ws.close(1011, `ffmpeg exit ${code}`); } catch {}
  });

  let started = false;
  ws.on("message", (data, isBinary) => {
    if (!isBinary) return;
    if (!started) { started = true; try { ws.send(JSON.stringify({ type: "started" })); } catch {} }
    if (ff.stdin.writable) ff.stdin.write(data);
  });
  ws.on("close", () => {
    console.log("[relay] koneksi ditutup");
    try { ff.stdin.end(); } catch {}
    setTimeout(() => ff.kill("SIGKILL"), 3000);
  });
  ws.on("error", () => { try { ff.stdin.end(); } catch {} });
});

server.listen(PORT, () => console.log(`CreatorOS relay siap di port ${PORT}`));
