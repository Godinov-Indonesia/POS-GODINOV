import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

export async function proxyLandlordRequest(
  req: NextRequest,
  backendPath: string,
  methodOverride?: string
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("landlord_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Sesi tidak valid atau telah berakhir" },
      { status: 401 }
    );
  }

  const method = methodOverride || req.method;
  const url = `${BACKEND_BASE_URL}${backendPath}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  if (req.headers.get("Content-Type")) {
    headers.set("Content-Type", req.headers.get("Content-Type")!);
  } else if (method !== "GET" && method !== "DELETE") {
    headers.set("Content-Type", "application/json");
  }

  let body: BodyInit | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await req.text();
    } catch {
      body = undefined;
    }
  }

  try {
    const backendRes = await fetch(url, {
      method,
      headers,
      body: body ? body : undefined,
    });

    const resContentType = backendRes.headers.get("content-type");
    if (resContentType && resContentType.includes("application/json")) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status: backendRes.status });
    }

    const text = await backendRes.text();
    return new NextResponse(text, { status: backendRes.status });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Gagal menghubungkan ke backend POS-GODINOV",
      },
      { status: 502 }
    );
  }
}
