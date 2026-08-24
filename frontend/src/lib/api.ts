import axios from "axios";

// One axios instance for the whole app. The dev server proxies "/api" to the backend.
export const api = axios.create({ baseURL: "/api" });

const TOKEN_KEY = "finbooks_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Attach the JWT to every request if we have one.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turn backend error payloads into a readable STRING message.
// Guards against non-string payloads (e.g. a zod `details` object) so the UI
// never renders "[object Object]".
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: unknown; message?: unknown } | undefined;
    const candidate = data?.error ?? data?.message ?? err.message;
    if (typeof candidate === "string") return candidate;
    if (candidate != null) return JSON.stringify(candidate);
    return "Something went wrong.";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
