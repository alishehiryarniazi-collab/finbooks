import { useEffect, useState, type ReactNode } from "react";
import { api, apiError, clearToken, getToken, setToken } from "../lib/api";
import { setActiveCurrency } from "../lib/format";
import type { Role, User } from "../lib/types";
import { AuthContext, type RegisterPayload } from "./auth-context";

// Re-exported so existing `import { useAuth } from "../context/AuthContext"` keeps working.
export { useAuth } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Set the user and keep the active display currency in sync with their org.
  function setUser(u: User | null) {
    setUserState(u);
    setActiveCurrency(u?.organization?.baseCurrency);
  }

  // On first load, if a token exists, fetch the current user to restore the session.
  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<{ user: User }>("/auth/me");
        setUser(data.user);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  async function login(email: string, password: string) {
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      throw new Error(apiError(err), { cause: err });
    }
  }

  async function register(payload: RegisterPayload) {
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/register", payload);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      throw new Error(apiError(err), { cause: err });
    }
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  // Re-fetch the current user (e.g. after company settings change) so the UI updates.
  async function refreshUser() {
    if (!getToken()) return;
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      /* ignore — a stale token will be handled on the next guarded request */
    }
  }

  // Switch the active company: get a new token for it, then hard-reload so every page's
  // data re-fetches for the new company (simplest and safest).
  async function switchCompany(orgId: string) {
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/switch", { orgId });
      setToken(data.token);
      window.location.assign("/");
    } catch (err) {
      throw new Error(apiError(err), { cause: err });
    }
  }

  // Create a brand-new company, then switch into it.
  async function createCompany(name: string) {
    try {
      const { data } = await api.post<{ organization: { id: string; name: string } }>("/auth/companies", { name });
      await switchCompany(data.organization.id);
    } catch (err) {
      throw new Error(apiError(err), { cause: err });
    }
  }

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser, switchCompany, createCompany, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}
