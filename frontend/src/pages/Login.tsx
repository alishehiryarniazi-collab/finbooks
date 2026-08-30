import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { TextField } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { LanguageSwitcher } from "../components/layout/LanguageSwitcher";

export function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
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
    <AuthShell title={t("auth.welcomeBack")} subtitle={t("auth.signInSubtitle")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label={t("auth.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="-mt-2 flex justify-end">
          <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-aurora-mint">
            {t("auth.forgot")}
          </Link>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        {t("auth.newHere")}{" "}
        <Link to="/register" className="text-aurora-mint hover:underline">
          {t("auth.createOrganization")}
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
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="aurora-bg-blobs">
        <span />
        <span />
        <span />
      </div>
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="glass w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <span className="text-2xl font-bold gradient-text">{t("app.name")}</span>
          <h1 className="mt-4 text-xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
