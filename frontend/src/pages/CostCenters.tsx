import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { CostCenter } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField } from "../components/ui/Field";
import { EntityGrid, EntityCard, AddCard, EmptyState } from "../components/ui/EntityCard";
import { ErrorNote } from "./Dashboard";

export function CostCenters() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<{ costCenters: CostCenter[] }>("/cost-centers");
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  if (loading) return <Spinner label={t("crud.ccLoading")} />;
  if (error) return <ErrorNote message={error} />;
  const rows = data?.costCenters ?? [];

  return (
    <div>
      <PageHeader
        title={t("nav.costCenters")}
        subtitle={t("crud.ccSubtitle")}
        action={canEdit && <Button onClick={() => setCreating(true)}>{t("crud.ccNew")}</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="🏢"
          message={t("crud.ccEmpty")}
          action={canEdit && <Button onClick={() => setCreating(true)}>{t("crud.ccNew")}</Button>}
        />
      ) : (
        <EntityGrid>
          {rows.map((c) => (
            <EntityCard
              key={c.id}
              icon="🏢"
              title={c.name}
              subtitle={c.code || undefined}
              badge={
                !c.isActive && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                    {t("crud.inactive")}
                  </span>
                )
              }
              disabled={!canEdit}
              onClick={() => setEditing(c)}
            />
          ))}
          {canEdit && <AddCard label={t("crud.ccNew")} onClick={() => setCreating(true)} />}
        </EntityGrid>
      )}

      {(creating || editing) && (
        <CostCenterModal
          item={editing}
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

function CostCenterModal({ item, onClose, onSaved }: { item: CostCenter | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { name, code };
      if (isEdit) await api.patch(`/cost-centers/${item!.id}`, payload);
      else await api.post("/cost-centers", payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t("crud.ccDelete"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/cost-centers/${item!.id}`);
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
      icon="🏢"
      title={isEdit ? t("crud.ccEdit") : t("crud.ccAdd")}
      subtitle={t("crud.ccSubtitle")}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label={t("fields.name")} value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("crud.ccNamePlaceholder")} />
        <TextField label={t("crud.codeOptional")} value={code ?? ""} onChange={(e) => setCode(e.target.value)} placeholder="CC-SALES" />
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
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={busy}>{busy ? t("actions.saving") : isEdit ? t("common.save") : t("common.create")}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
