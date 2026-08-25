import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { Customer } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { ListControls } from "../components/ui/ListControls";
import { ErrorNote } from "./Dashboard";

// Shared CRUD screen for customers and vendors (same shape, different endpoint/label).
export function PartyManager({
  resource,
  singular,
  plural,
  dataKey,
}: {
  resource: "customers" | "vendors";
  singular: string;
  plural: string;
  dataKey: "customers" | "vendors";
}) {
  const { data, loading, error, refetch } = useFetch<Record<string, Customer[]>>(`/${resource}`);
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [q, setQ] = useState("");

  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  if (loading) return <Spinner label={`Loading ${plural.toLowerCase()}…`} />;
  if (error) return <ErrorNote message={error} />;

  const all = data?.[dataKey] ?? [];
  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      needle === "" ||
      r.name.toLowerCase().includes(needle) ||
      (r.email ?? "").toLowerCase().includes(needle) ||
      (r.phone ?? "").toLowerCase().includes(needle),
  );

  return (
    <div>
      <PageHeader
        title={plural}
        subtitle={`People and businesses you ${resource === "customers" ? "sell to" : "buy from"}`}
        action={canEdit && <Button onClick={() => setCreating(true)}>+ New {singular.toLowerCase()}</Button>}
      />
      <ListControls query={q} onQuery={setQ} placeholder={`Search ${plural.toLowerCase()}…`} />
      <Card>
        <DataTable
          rows={rows}
          keyOf={(r) => r.id}
          onRowClick={canEdit ? (r) => setEditing(r) : undefined}
          empty={`No ${plural.toLowerCase()} yet.`}
          columns={[
            { header: "Name", cell: (r) => <span className="text-white">{r.name}</span> },
            { header: "Email", cell: (r) => r.email ?? "—" },
            { header: "Phone", cell: (r) => r.phone ?? "—" },
          ]}
        />
      </Card>

      {(creating || editing) && (
        <PartyModal
          resource={resource}
          singular={singular}
          party={editing}
          canDelete={hasRole("ADMIN")}
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

function PartyModal({
  resource,
  singular,
  party,
  canDelete,
  onClose,
  onSaved,
}: {
  resource: string;
  singular: string;
  party: Customer | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!party;
  const [form, setForm] = useState({
    name: party?.name ?? "",
    email: party?.email ?? "",
    phone: party?.phone ?? "",
    address: party?.address ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, email: form.email || undefined };
      if (isEdit) await api.patch(`/${resource}/${party!.id}`, payload);
      else await api.post(`/${resource}`, payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/${resource}/${party!.id}`);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Name" value={form.name} onChange={set("name")} required />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Email" type="email" value={form.email} onChange={set("email")} />
          <TextField label="Phone" value={form.phone} onChange={set("phone")} />
        </div>
        <TextField label="Address" value={form.address} onChange={set("address")} />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {isEdit && canDelete ? (
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
