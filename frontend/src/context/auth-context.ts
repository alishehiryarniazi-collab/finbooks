import { createContext, useContext } from "react";
import type { Role, User } from "../lib/types";

// The context object + hook live in their OWN module (no React components here).
// This keeps the context identity stable across Vite Fast-Refresh — if the provider
// component's file changes, this module isn't re-evaluated, so consumers and the
// provider always share the same context (no "must be used inside Provider" glitch).

export interface RegisterPayload {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
