import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, apiError } from "../lib/api";
import { TextField } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { AuthShell } from "./Login";

// Step 1 of password reset: ask for the email. The server always responds the same way, so this
// page can't reveal whether an email is registered.
export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-mint/20 to-aurora-violet/20 text-2xl ring-1 ring-white/10">
            ✉️
          </span>
          <p className="text-sm text-slate-300">{t("auth.forgotSent")}</p>
          <Link to="/login" className="text-sm text-aurora-mint hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? t("auth.sending") : t("auth.sendResetLink")}
          </Button>
          <Link to="/login" className="text-center text-sm text-slate-400 hover:text-aurora-mint">
            {t("auth.backToLogin")}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
