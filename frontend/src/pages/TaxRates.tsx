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
import { EntityGrid, EntityCard, AddCard, EmptyState } from "../components/ui/EntityCard";
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

      {rates.length === 0 ? (
        <EmptyState
          icon="🧾"
          message={t("crud.taxEmpty")}
          action={canEdit && <Button onClick={() => setCreating(true)}>{t("crud.taxNew")}</Button>}
        />
      ) : (
        <EntityGrid>
          {rates.map((r) => (
            <EntityCard
              key={r.id}
              icon="🧾"
              title={r.name}
              subtitle={t("crud.rate")}
              badge={
                !r.isActive && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {t("crud.inactive")}
                  </span>
                )
              }
              footer={
                <p className="tabular-nums text-2xl font-semibold text-aurora-mint">{Number(r.ratePercent)}%</p>
              }
              disabled={!canEdit}
              onClick={() => setEditing(r)}
            />
          ))}
          {canEdit && <AddCard label={t("crud.taxNew")} onClick={() => setCreating(true)} />}
        </EntityGrid>
      )}

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
    <Modal
      open
      onClose={onClose}
      icon="🧾"
      title={isEdit ? t("crud.taxEdit") : t("crud.taxAdd")}
      subtitle={t("crud.taxSubtitle")}
    >
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
