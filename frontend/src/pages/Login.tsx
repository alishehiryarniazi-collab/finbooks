import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { TextField } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@finbooks.app");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your FinBooks workspace">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        New here?{" "}
        <Link to="/register" className="text-aurora-mint hover:underline">
          Create an organization
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">Demo: demo@finbooks.app / demo1234</p>
    </AuthShell>
  );
}

// Shared centered card used by Login and Register.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="aurora-bg-blobs">
        <span />
        <span />
        <span />
      </div>
      <div className="glass w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold gradient-text">FinBooks</span>
          <h1 className="mt-4 text-xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
