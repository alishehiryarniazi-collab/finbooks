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

// Turn backend error payloads into a plain Error with a readable message.
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message ?? "Something went wrong.";
  }
  return "Something went wrong.";
}
