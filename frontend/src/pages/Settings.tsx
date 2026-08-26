import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { TextField, SelectField } from "../components/ui/Field";
import { ErrorNote } from "./Dashboard";

const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "INR", "AED", "SAR", "CAD", "AUD"];
const MAX_LOGO_BYTES = 300_000; // keep the inline logo small

export function Settings() {
  const { t, i18n } = useTranslation();
  // Localize month names from the active language instead of a hardcoded English list.
  const monthName = (i: number) =>
    new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(new Date(2000, i, 1));
  const { user, refreshUser, hasRole } = useAuth();
  const org = user?.organization;
  const canEdit = hasRole("ADMIN");

  const [form, setForm] = useState({
    name: org?.name ?? "",
    baseCurrency: org?.baseCurrency ?? "USD",
    fiscalYearStartMonth: String(org?.fiscalYearStartMonth ?? 1),
    address: org?.address ?? "",
    phone: org?.phone ?? "",
    email: org?.email ?? "",
    logoDataUrl: org?.logoDataUrl ?? "",
    booksLockedBefore: org?.booksLockedBefore ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setOk(false);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setError(t("settings.logoTooLarge", { kb: (MAX_LOGO_BYTES / 1000).toFixed(0) }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", String(reader.result));
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await api.patch("/organization", {
        ...form,
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
      });
      await refreshUser();
      setOk(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("nav.companySettings")} subtitle={t("settings.subtitle")} />

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t("settings.companyProfile")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                label={t("settings.companyName")}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>
            <SelectField
              label={t("settings.baseCurrency")}
              value={form.baseCurrency}
              onChange={(e) => set("baseCurrency", e.target.value)}
              disabled={!canEdit}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t("settings.fiscalYearStarts")}
              value={form.fiscalYearStartMonth}
              onChange={(e) => set("fiscalYearStartMonth", e.target.value)}
              disabled={!canEdit}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1)}>
                  {monthName(i)}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t("fields.email")}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={!canEdit}
              placeholder="billing@company.com"
            />
            <TextField
              label={t("fields.phone")}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              disabled={!canEdit}
              placeholder="+92 300 1234567"
            />
            <div className="sm:col-span-2">
              <TextField
                label={t("settings.lockDateLabel")}
                type="date"
                value={form.booksLockedBefore ?? ""}
                onChange={(e) => set("booksLockedBefore", e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block">
                <span className="label">{t("fields.address")}</span>
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  disabled={!canEdit}
                  placeholder={t("settings.addressPlaceholder")}
                />
              </label>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">{t("settings.logo")}</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt={t("settings.logo")} className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-500">{t("settings.noLogo")}</span>
              )}
            </div>
            {canEdit && (
              <div className="flex flex-col items-center gap-2">
                <label className="btn-ghost cursor-pointer text-sm">
                  {t("settings.uploadLogo")}
                  <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                </label>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => set("logoDataUrl", "")}
                    className="text-xs text-slate-500 hover:text-rose-400"
                  >
                    {t("settings.remove")}
                  </button>
                )}
                <p className="text-center text-[11px] text-slate-500">{t("settings.logoHint")}</p>
              </div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-3">
          {error && (
            <div className="mb-3">
              <ErrorNote message={error} />
            </div>
          )}
          {ok && <p className="mb-3 text-sm text-emerald-300">{t("settings.saved")}</p>}
          {canEdit ? (
            <Button type="submit" disabled={busy}>
              {busy ? t("actions.saving") : t("settings.saveSettings")}
            </Button>
          ) : (
            <p className="text-sm text-slate-500">{t("settings.adminOnly")}</p>
          )}
        </div>
      </form>
    </div>
  );
}
