import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("landlord_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak valid atau telah berakhir" },
      { status: 401 }
    );
  }

  const url = `${BACKEND_BASE_URL}/v1/landlord/backups/files/${id}/download`;
  const backendRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ message: "Gagal mengunduh berkas" }));
    return NextResponse.json(err, { status: backendRes.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", backendRes.headers.get("Content-Type") || "application/gzip");
  if (backendRes.headers.get("Content-Disposition")) {
    headers.set("Content-Disposition", backendRes.headers.get("Content-Disposition")!);
  }
  if (backendRes.headers.get("Content-Length")) {
    headers.set("Content-Length", backendRes.headers.get("Content-Length")!);
  }

  return new NextResponse(backendRes.body, {
    status: 200,
    headers,
  });
}
