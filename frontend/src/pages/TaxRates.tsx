import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { TaxRate } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField } from "../components/ui/Field";
import { ErrorNote } from "./Dashboard";

export function TaxRates() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<{ taxRates: TaxRate[] }>("/tax-rates");
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  if (loading) return <Spinner label={t("crud.taxLoading")} />;
  if (error) return <ErrorNote message={error} />;
  const rates = data?.taxRates ?? [];

  return (
    <div>
      <PageHeader
        title={t("nav.taxRates")}
        subtitle={t("crud.taxSubtitle")}
        action={canEdit && <Button onClick={() => setCreating(true)}>{t("crud.taxNew")}</Button>}
      />

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500">
          <span>{t("fields.name")}</span>
          <span>{t("crud.rate")}</span>
        </div>
        {rates.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t("crud.taxEmpty")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {rates.map((r) => (
              <button
                key={r.id}
                onClick={() => canEdit && setEditing(r)}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 disabled:cursor-default"
                disabled={!canEdit}
              >
                <span className="text-sm text-white">
                  {r.name} {!r.isActive && <span className="ml-1 text-[10px] uppercase text-amber-400">{t("crud.inactive")}</span>}
                </span>
                <span className="tabular-nums text-sm text-slate-300">{Number(r.ratePercent)}%</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <TaxRateModal
          rate={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function TaxRateModal({ rate, onClose, onSaved }: { rate: TaxRate | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!rate;
  const [name, setName] = useState(rate?.name ?? "");
  const [percent, setPercent] = useState(rate ? String(Number(rate.ratePercent)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { name, ratePercent: Number(percent) };
      if (isEdit) await api.patch(`/tax-rates/${rate!.id}`, payload);
      else await api.post("/tax-rates", payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t("crud.taxDelete"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/tax-rates/${rate!.id}`);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? t("crud.taxEdit") : t("crud.taxAdd")}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label={t("fields.name")} value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("crud.taxNamePlaceholder")} />
        <TextField
          label={t("crud.rateLabel")}
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          required
          placeholder="17"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {isEdit ? (
            <button type="button" onClick={del} disabled={busy} className="text-sm text-rose-400 hover:text-rose-300">
              {t("common.delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("actions.saving") : isEdit ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
