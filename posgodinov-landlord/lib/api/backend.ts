import { cookies } from "next/headers";

const BACKEND_BASE_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080";

export async function backendFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; status: number }> {
  const cookieStore = await cookies();
  const token = cookieStore.get("landlord_access_token")?.value;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${BACKEND_BASE_URL}${endpoint}`;
  const resp = await fetch(url, {
    ...options,
    headers,
  });

  const rawJson = await resp.json().catch(() => null);

  if (!resp.ok) {
    const errorMsg = rawJson?.message || rawJson?.error || `Backend error HTTP ${resp.status}`;
    const err = new Error(errorMsg);
    (err as Error & { status: number; details?: unknown }).status = resp.status;
    (err as Error & { status: number; details?: unknown }).details = rawJson;
    throw err;
  }

  return {
    data: (rawJson?.data !== undefined ? rawJson.data : rawJson) as T,
    status: resp.status,
  };
}
