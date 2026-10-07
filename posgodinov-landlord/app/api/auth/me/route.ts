import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("landlord_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { authenticated: false, message: "Sesi tidak ditemukan" },
      { status: 401 }
    );
  }

  try {
    const resp = await fetch(`${BACKEND_BASE_URL}/v1/landlord/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      // Token tidak valid atau kedaluwarsa -> bersihkan cookie
      cookieStore.delete("landlord_access_token");
      return NextResponse.json(
        { authenticated: false, message: "Sesi telah berakhir" },
        { status: 401 }
      );
    }

    const data = await resp.json();
    return NextResponse.json({
      authenticated: true,
      user: data?.data,
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, message: "Gagal memverifikasi sesi ke server" },
      { status: 500 }
    );
  }
}
