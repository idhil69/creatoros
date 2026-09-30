import { generate, type AiTask } from "@/lib/ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { task: AiTask; topic: string; tone?: string };
  if (!body.topic?.trim()) {
    return NextResponse.json({ error: "Topik wajib diisi" }, { status: 400 });
  }
  // Simulate model latency
  await new Promise((r) => setTimeout(r, 900));
  const results = generate(body.task ?? "caption", body.topic, body.tone ?? "santai");
  return NextResponse.json({ results, provider: process.env.AI_API_KEY ? "live" : "mock" });
}
