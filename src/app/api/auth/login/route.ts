import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PASSWORD, ADMIN_USERNAME, AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body ?? {};

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Username atau password salah." },
        { status: 401 }
      );
    }

    const token = await createSessionToken(username);
    const res = NextResponse.json({ success: true, user: username });

    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 hari
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
