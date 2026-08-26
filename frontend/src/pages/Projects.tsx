import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { Project } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField, SelectField } from "../components/ui/Field";
import { EntityGrid, EntityCard, AddCard, EmptyState } from "../components/ui/EntityCard";
import { ErrorNote } from "./Dashboard";

const STATUSES = ["ACTIVE", "COMPLETED", "ON_HOLD"];

// Colour per project status so the board reads at a glance.
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  COMPLETED: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  ON_HOLD: "border-amber-500/30 bg-amber-500/15 text-amber-300",
};

function StatusPill({ status, label }: { status: string; label: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.ACTIVE;
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${style}`}>{label}</span>
  );
}

export function Projects() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<{ projects: Project[] }>("/projects");
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  if (loading) return <Spinner label={t("crud.projLoading")} />;
  if (error) return <ErrorNote message={error} />;
  const rows = data?.projects ?? [];

  return (
    <div>
      <PageHeader
        title={t("nav.projects")}
        subtitle={t("crud.projSubtitle")}
        action={canEdit && <Button onClick={() => setCreating(true)}>{t("crud.projNew")}</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="🚀"
          message={t("crud.projEmpty")}
          action={canEdit && <Button onClick={() => setCreating(true)}>{t("crud.projNew")}</Button>}
        />
      ) : (
        <EntityGrid>
          {rows.map((p) => (
            <EntityCard
              key={p.id}
              icon="🚀"
              title={p.name}
              subtitle={p.code || undefined}
              badge={<StatusPill status={p.status} label={t(`status.${p.status}`, p.status.replace("_", " "))} />}
              disabled={!canEdit}
              onClick={() => setEditing(p)}
            />
          ))}
          {canEdit && <AddCard label={t("crud.projNew")} onClick={() => setCreating(true)} />}
        </EntityGrid>
      )}

      {(creating || editing) && (
        <ProjectModal
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

function ProjectModal({ item, onClose, onSaved }: { item: Project | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [code, setCode] = useState(item?.code ?? "");
  const [status, setStatus] = useState(item?.status ?? "ACTIVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { name, code, status };
      if (isEdit) await api.patch(`/projects/${item!.id}`, payload);
      else await api.post("/projects", payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t("crud.projDelete"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/projects/${item!.id}`);
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
      icon="🚀"
      title={isEdit ? t("crud.projEdit") : t("crud.projAdd")}
      subtitle={t("crud.projSubtitle")}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label={t("fields.name")} value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("crud.projNamePlaceholder")} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t("crud.codeOptional")} value={code ?? ""} onChange={(e) => setCode(e.target.value)} placeholder="PRJ-01" />
          <SelectField label={t("fields.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`, s.replace("_", " "))}
              </option>
            ))}
          </SelectField>
        </div>
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
