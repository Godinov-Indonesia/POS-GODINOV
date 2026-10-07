import { ApiErrorResponse } from "../types";

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorMsg = `Request gagal dengan status ${response.status}`;
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;

    try {
      const errData: ApiErrorResponse = await response.json();
      if (errData.message) errorMsg = errData.message;
      else if (errData.error) errorMsg = errData.error;
      code = errData.code;
      details = errData.details;
    } catch {
      // Fallback text
    }

    throw new ApiError(errorMsg, response.status, code, details);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
