import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, apiError } from "../lib/api";
import { TextField } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { AuthShell } from "./Login";

// Step 2 of password reset: the user arrives via the emailed link (?token=...) and sets a new
// password. The token is validated server-side (unexpired, unused).
export function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError(t("auth.pwTooShort"));
    if (password !== confirm) return setError(t("auth.pwMismatch"));
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 1600);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  // No token in the URL → the link is broken/missing.
  if (!token) {
    return (
      <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
        <p className="text-center text-sm text-rose-400">{t("auth.resetNoToken")}</p>
        <p className="mt-4 text-center">
          <Link to="/forgot-password" className="text-sm text-aurora-mint hover:underline">
            {t("auth.requestNewLink")}
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      {done ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-3xl">✅</span>
          <p className="text-sm text-emerald-300">{t("auth.resetDone")}</p>
          <Link to="/login" className="text-sm text-aurora-mint hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField
            label={t("auth.newPassword")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <TextField
            label={t("auth.confirmPassword")}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? t("actions.saving") : t("auth.resetButton")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
