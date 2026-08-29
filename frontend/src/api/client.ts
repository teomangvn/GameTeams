/**
 * API istemcisi.
 *
 * Access token bellekte tutulur (localStorage değil): XSS durumunda diskten
 * okunamasın diye. Sayfa yenilendiğinde /refresh ile yeniden alınır — refresh
 * token HttpOnly cookie'de olduğu için JavaScript ona erişemez.
 */

// Bos varsayilan = ayni origin. Dev'de Vite, prod'da nginx vekillik yapar;
// mutlak URL yalnizca API baska bir alan adindaysa gerekir.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export interface ApiErrorBody {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  fieldErrors?: Record<string, string> | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = body.status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors ?? {};
  }
}

/** Eşzamanlı 401'lerde tek bir yenileme isteği yapılır. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Sonsuz döngüyü önlemek için iç kullanım. */
  retryOnUnauthorized?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, retryOnUnauthorized = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Access token süresi dolmuşsa bir kez yenileyip isteği tekrarla.
  // /api/auth/refresh'in kendisi için tekrar denenmez.
  if (response.status === 401 && retryOnUnauthorized && !path.startsWith("/api/auth/refresh")) {
    if (await refreshAccessToken()) {
      return request<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      data ?? {
        timestamp: new Date().toISOString(),
        status: response.status,
        code: "UNKNOWN",
        message: "Sunucuya ulaşılamadı.",
      },
    );
  }

  return data as T;
}
