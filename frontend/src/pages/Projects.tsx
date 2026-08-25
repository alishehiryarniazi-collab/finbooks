import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { Project } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField, SelectField } from "../components/ui/Field";
import { ErrorNote } from "./Dashboard";

const STATUSES = ["ACTIVE", "COMPLETED", "ON_HOLD"];

export function Projects() {
  const { data, loading, error, refetch } = useFetch<{ projects: Project[] }>("/projects");
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  if (loading) return <Spinner label="Loading projects…" />;
  if (error) return <ErrorNote message={error} />;
  const rows = data?.projects ?? [];

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Jobs you can tag transactions with to see each one's profit"
        action={canEdit && <Button onClick={() => setCreating(true)}>+ New project</Button>}
      />

      <div className="glass overflow-hidden rounded-2xl">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No projects yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {rows.map((p) => (
              <button
                key={p.id}
                onClick={() => canEdit && setEditing(p)}
                disabled={!canEdit}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/5 disabled:cursor-default"
              >
                <span className="text-sm text-white">
                  {p.code && <span className="mr-2 text-xs text-slate-500">{p.code}</span>}
                  {p.name}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  {p.status.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

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
    if (!window.confirm("Delete this project?")) return;
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
    <Modal open onClose={onClose} title={isEdit ? "Edit project" : "New project"}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Website Revamp" />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Code (optional)" value={code ?? ""} onChange={(e) => setCode(e.target.value)} placeholder="PRJ-01" />
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </SelectField>
        </div>
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
