import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { TextField } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { AuthShell } from "./Login";

export function Register() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.createTitle")} subtitle={t("auth.createSubtitle")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label={t("auth.organizationName")}
          value={form.organizationName}
          onChange={set("organizationName")}
          required
        />
        <TextField label={t("auth.yourName")} value={form.name} onChange={set("name")} required />
        <TextField label={t("auth.email")} type="email" value={form.email} onChange={set("email")} required />
        <TextField
          label={t("auth.password")}
          type="password"
          value={form.password}
          onChange={set("password")}
          required
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={busy}>
          {busy ? t("auth.creating") : t("auth.createAccount")}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-400">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link to="/login" className="text-aurora-mint hover:underline">
          {t("auth.signInLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
