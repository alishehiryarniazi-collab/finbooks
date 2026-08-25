import { useState } from "react";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { TextField, SelectField } from "../components/ui/Field";
import { ErrorNote } from "./Dashboard";

const CURRENCIES = ["USD", "PKR", "EUR", "GBP", "INR", "AED", "SAR", "CAD", "AUD"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MAX_LOGO_BYTES = 300_000; // keep the inline logo small

export function Settings() {
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
      setError(`Logo is too large (max ${(MAX_LOGO_BYTES / 1000).toFixed(0)} KB). Pick a smaller image.`);
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
      <PageHeader
        title="Company Settings"
        subtitle="Profile, currency and branding used across the app and on documents"
      />

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Company profile
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField
                label="Company name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>
            <SelectField
              label="Base currency"
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
              label="Fiscal year starts"
              value={form.fiscalYearStartMonth}
              onChange={(e) => set("fiscalYearStartMonth", e.target.value)}
              disabled={!canEdit}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={!canEdit}
              placeholder="billing@company.com"
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              disabled={!canEdit}
              placeholder="+92 300 1234567"
            />
            <div className="sm:col-span-2">
              <TextField
                label="Lock date — postings before this date are blocked (leave empty for none)"
                type="date"
                value={form.booksLockedBefore ?? ""}
                onChange={(e) => set("booksLockedBefore", e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block">
                <span className="label">Address</span>
                <textarea
                  className="input min-h-[80px] resize-y"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  disabled={!canEdit}
                  placeholder="Street, City, Country"
                />
              </label>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Logo</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-slate-500">No logo</span>
              )}
            </div>
            {canEdit && (
              <div className="flex flex-col items-center gap-2">
                <label className="btn-ghost cursor-pointer text-sm">
                  Upload logo
                  <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
                </label>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => set("logoDataUrl", "")}
                    className="text-xs text-slate-500 hover:text-rose-400"
                  >
                    Remove
                  </button>
                )}
                <p className="text-center text-[11px] text-slate-500">PNG/SVG, small (max 300&nbsp;KB)</p>
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
          {ok && <p className="mb-3 text-sm text-emerald-300">✓ Settings saved.</p>}
          {canEdit ? (
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
          ) : (
            <p className="text-sm text-slate-500">Only an admin can change company settings.</p>
          )}
        </div>
      </form>
    </div>
  );
}
