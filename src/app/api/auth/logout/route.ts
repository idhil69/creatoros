import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL("/login", req.url);
  const res = NextResponse.redirect(url);
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
