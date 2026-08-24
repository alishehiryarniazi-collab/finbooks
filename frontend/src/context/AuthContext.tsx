import { useEffect, useState, type ReactNode } from "react";
import { api, apiError, clearToken, getToken, setToken } from "../lib/api";
import type { Role, User } from "../lib/types";
import { AuthContext, type RegisterPayload } from "./auth-context";

// Re-exported so existing `import { useAuth } from "../context/AuthContext"` keeps working.
export { useAuth } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      throw new Error(apiError(err));
    }
  }

  async function register(payload: RegisterPayload) {
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/register", payload);
      setToken(data.token);
      setUser(data.user);
    } catch (err) {
      throw new Error(apiError(err));
    }
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
