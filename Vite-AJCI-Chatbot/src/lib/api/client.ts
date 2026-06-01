export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Strip any trailing slash so `${BASE}${path}` can't produce a double slash
// (e.g. a misconfigured "https://host/" + "/auth/login" → "https://host//auth/login").
const BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "");

// Bearer token store. We persist the JWT in localStorage so auth survives a
// page reload, and send it as an Authorization header — this works cross-site
// on every browser, unlike cookies which get blocked as third-party.
const TOKEN_KEY = "ajci_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // localStorage unavailable (private mode quota, etc.) — auth will fall
    // back to the cookie if one is present.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Build the Authorization header when a token is present. Exported so the SSE
// streaming fetch (which bypasses `request`) can reuse it.
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
