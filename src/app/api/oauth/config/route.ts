import { isConfigured } from "@/lib/oauth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    youtube: isConfigured("youtube"),
    instagram: isConfigured("instagram"),
    facebook: isConfigured("facebook"),
    tiktok: isConfigured("tiktok"),
  });
}
