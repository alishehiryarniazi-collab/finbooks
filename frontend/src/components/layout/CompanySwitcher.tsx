import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { apiError } from "../../lib/api";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/Field";
import { Button } from "../ui/Button";

// Topbar dropdown to switch between the companies a user belongs to, and to create a new one.
export function CompanySwitcher() {
  const { t } = useTranslation();
  const { user, switchCompany, createCompany } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
      >
        <span className="max-w-[160px] truncate">{user.organization?.name ?? "—"}</span>
        <svg className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-1 w-64 rounded-xl border border-white/10 bg-aurora-bg2 p-1 shadow-2xl">
          <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">{t("common.yourCompanies")}</p>
          {user.companies.map((c) => {
            const isActive = c.orgId === user.orgId;
            return (
              <button
                key={c.orgId}
                onClick={() => (isActive ? setOpen(false) : switchCompany(c.orgId))}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive ? "bg-aurora-mint/15 text-white" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-[10px] text-slate-500">{isActive ? "✓ " : ""}{t(`roles.${c.role}`, c.role)}</span>
              </button>
            );
          })}
          <div className="my-1 border-t border-white/10" />
          <button
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-aurora-mint transition hover:bg-white/10"
          >
            ＋ {t("common.newCompany")}
          </button>
        </div>
      )}

      {creating && <NewCompanyModal onClose={() => setCreating(false)} onCreate={createCompany} />}
    </div>
  );
}

function NewCompanyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate(name); // on success the app hard-reloads into the new company
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("common.newCompany")}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField
          label={t("settings.companyName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder={t("company.namePlaceholder")}
        />
        <p className="text-xs text-slate-500">{t("company.createHint")}</p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("auth.creating") : t("company.createSwitch")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
