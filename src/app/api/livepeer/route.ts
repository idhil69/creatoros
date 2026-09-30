import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mengatur Multistream target di Livepeer secara otomatis:
 * kamera HP → Livepeer (WHIP) → diteruskan ke RTMP tujuan (mis. YouTube).
 * Dipanggil saat mulai live; key YouTube berubah tiap broadcast, jadi target
 * selalu di-update otomatis di sini.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    apiKey: string;
    livepeerStreamKey: string;
    targetName: string;
    rtmpUrl: string; // ex: rtmp://a.rtmp.youtube.com/live2
    streamKey: string; // key YouTube
  };

  if (!body.apiKey?.trim()) return NextResponse.json({ error: "Livepeer API key kosong" }, { status: 400 });
  if (!body.livepeerStreamKey?.trim()) return NextResponse.json({ error: "Livepeer stream key kosong" }, { status: 400 });
  if (!body.rtmpUrl || !body.streamKey) return NextResponse.json({ error: "Target RTMP tidak lengkap" }, { status: 400 });

  const auth = { Authorization: `Bearer ${body.apiKey.trim()}`, "Content-Type": "application/json" };

  // 1) Temukan stream Livepeer berdasarkan stream key
  const listRes = await fetch("https://livepeer.studio/api/stream?streamsonly=1", { headers: auth, cache: "no-store" });
  if (listRes.status === 401 || listRes.status === 403) {
    return NextResponse.json({ error: "Livepeer API key tidak valid (Developers → API Keys)" }, { status: 401 });
  }
  const streams = (await listRes.json()) as { id: string; streamKey?: string; name?: string }[];
  if (!Array.isArray(streams)) return NextResponse.json({ error: "Gagal membaca daftar stream Livepeer" }, { status: 502 });

  const stream = streams.find((s) => s.streamKey === body.livepeerStreamKey.trim());
  if (!stream) {
    return NextResponse.json({ error: "Stream dengan key tersebut tidak ditemukan di akun Livepeer ini" }, { status: 404 });
  }

  // 2) Set multistream target (ganti semua target lama dengan target baru → key YouTube selalu segar)
  const targetUrl = `${body.rtmpUrl.replace(/\/$/, "")}/${body.streamKey}`;
  const patchRes = await fetch(`https://livepeer.studio/api/stream/${stream.id}`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({
      multistream: {
        targets: [{ profile: "source", spec: { name: body.targetName || "CreatorOS Target", url: targetUrl } }],
      },
    }),
  });
  if (!patchRes.ok) {
    const t = await patchRes.text();
    return NextResponse.json({ error: `Gagal mengatur multistream: ${t.slice(0, 100)}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, streamId: stream.id, target: body.targetName });
}
