import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { CostCenter } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField } from "../components/ui/Field";
import { ErrorNote } from "./Dashboard";

export function CostCenters() {
  const { data, loading, error, refetch } = useFetch<{ costCenters: CostCenter[] }>("/cost-centers");
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  if (loading) return <Spinner label="Loading cost centers…" />;
  if (error) return <ErrorNote message={error} />;
  const rows = data?.costCenters ?? [];

  return (
    <div>
      <PageHeader
        title="Cost Centers"
        subtitle="Departments/segments you can tag transactions with (e.g. Sales, Admin, Production)"
        action={canEdit && <Button onClick={() => setCreating(true)}>+ New cost center</Button>}
      />

      <div className="glass overflow-hidden rounded-2xl">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No cost centers yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {rows.map((c) => (
              <button
                key={c.id}
                onClick={() => canEdit && setEditing(c)}
                disabled={!canEdit}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 disabled:cursor-default"
              >
                <span className="text-sm text-white">
                  {c.code && <span className="mr-2 text-xs text-slate-500">{c.code}</span>}
                  {c.name}
                  {!c.isActive && <span className="ml-2 text-[10px] uppercase text-amber-400">inactive</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

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
    if (!window.confirm("Delete this cost center?")) return;
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
    <Modal open onClose={onClose} title={isEdit ? "Edit cost center" : "New cost center"}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Sales Department" />
        <TextField label="Code (optional)" value={code ?? ""} onChange={(e) => setCode(e.target.value)} placeholder="CC-SALES" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {isEdit ? (
            <button type="button" onClick={del} disabled={busy} className="text-sm text-rose-400 hover:text-rose-300">
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save" : "Create"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
