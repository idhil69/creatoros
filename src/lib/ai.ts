import { seededRandom } from "./platforms";

export type AiTask = "caption" | "title" | "hashtags" | "ideas";

const HOOKS = [
  "Kamu nggak akan percaya ini 👀",
  "POV: akhirnya nemu cara paling gampang",
  "Ini yang selama ini kalian tunggu!",
  "Stop scroll dulu ⚠️",
  "3 hal yang aku pelajari tentang",
  "Behind the scenes:",
];

const CTAS = [
  "Simpan biar nggak lupa 🔖",
  "Tag teman kamu yang butuh ini!",
  "Komen pendapat kamu di bawah 👇",
  "Follow untuk konten serupa ✨",
  "Share ke story kamu 🙌",
];

const TITLE_FORMATS = [
  (t: string) => `${t}: Panduan Lengkap 2026`,
  (t: string) => `Aku Coba ${t} Selama 7 Hari, Ini Hasilnya`,
  (t: string) => `5 Kesalahan Fatal Saat ${t}`,
  (t: string) => `${t} — Yang Nggak Pernah Diceritain Orang`,
  (t: string) => `Rahasia ${t} yang Bikin Viral`,
];

const BASE_TAGS = ["fyp", "viral", "kontenkreator", "creatorlife", "indonesia", "trending", "tips", "tutorial", "vlog", "behindthescenes"];

const IDEAS = [
  (t: string) => `Day-in-the-life saat mengerjakan ${t}`,
  (t: string) => `Q&A: Mitos vs Fakta soal ${t}`,
  (t: string) => `Reaksi jujur pertama kali mencoba ${t}`,
  (t: string) => `Tantangan 24 jam: ${t} edition`,
  (t: string) => `Before/After transformasi ${t}`,
  (t: string) => `Kolaborasi dengan kreator lain membahas ${t}`,
  (t: string) => `Tutorial cepat 60 detik: ${t}`,
  (t: string) => `Cerita gagal & pelajaran dari ${t}`,
];

function hash(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

function tagsFor(topic: string): string[] {
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const custom = new Set<string>();
  words.forEach((w) => custom.add(w));
  if (words.length > 1) custom.add(words.join(""));
  return [...custom, ...BASE_TAGS].slice(0, 12);
}

export function generate(task: AiTask, topic: string, tone: string): string[] {
  const clean = topic.trim() || "konten baru";
  const rnd = seededRandom(hash(clean + task + tone));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const toneSuffix = tone === "profesional" ? "" : tone === "lucu" ? " 😂" : " 🔥";

  switch (task) {
    case "caption":
      return Array.from({ length: 3 }, () => `${pick(HOOKS)} ${clean}${toneSuffix}\n\n${pick(CTAS)}`);
    case "title":
      return TITLE_FORMATS.map((f) => f(clean.charAt(0).toUpperCase() + clean.slice(1))).slice(0, 4);
    case "hashtags":
      return [tagsFor(clean).map((t) => `#${t}`).join(" ")];
    case "ideas":
      return [...IDEAS].sort(() => rnd() - 0.5).slice(0, 5).map((f) => f(clean));
  }
}
