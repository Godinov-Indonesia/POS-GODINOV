import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email dan password wajib diisi" },
        { status: 400 }
      );
    }

    const resp = await fetch(`${BACKEND_BASE_URL}/v1/landlord/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const resJson = await resp.json().catch(() => null);

    if (!resp.ok) {
      return NextResponse.json(
        {
          success: false,
          message: resJson?.message || "Email atau password salah",
        },
        { status: resp.status }
      );
    }

    const data = resJson?.data;
    if (!data?.access_token) {
      return NextResponse.json(
        { success: false, message: "Format respons token tidak valid dari server" },
        { status: 500 }
      );
    }

    // Pasang token strictly di Cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: "landlord_access_token",
      value: data.access_token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      data: {
        user: data.user,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { success: false, message: err.message || "Gagal menghubungi server autentikasi" },
      { status: 500 }
    );
  }
}
