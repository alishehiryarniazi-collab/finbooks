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
  const [open, setOpen] = useState(false);

  if (loading) return <Spinner label={`Loading ${plural.toLowerCase()}…`} />;
  if (error) return <ErrorNote message={error} />;

  const rows = data?.[dataKey] ?? [];

  return (
    <div>
      <PageHeader
        title={plural}
        subtitle={`People and businesses you ${resource === "customers" ? "sell to" : "buy from"}`}
        action={hasRole("ADMIN", "ACCOUNTANT") && <Button onClick={() => setOpen(true)}>+ New {singular.toLowerCase()}</Button>}
      />
      <Card>
        <DataTable
          rows={rows}
          keyOf={(r) => r.id}
          empty={`No ${plural.toLowerCase()} yet.`}
          columns={[
            { header: "Name", cell: (r) => <span className="text-white">{r.name}</span> },
            { header: "Email", cell: (r) => r.email ?? "—" },
            { header: "Phone", cell: (r) => r.phone ?? "—" },
          ]}
        />
      </Card>

      {open && (
        <PartyModal
          resource={resource}
          singular={singular}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}

function PartyModal({
  resource,
  singular,
  onClose,
  onSaved,
}: {
  resource: string;
  singular: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/${resource}`, { ...form, email: form.email || undefined });
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`New ${singular.toLowerCase()}`}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="Name" value={form.name} onChange={set("name")} required />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Email" type="email" value={form.email} onChange={set("email")} />
          <TextField label="Phone" value={form.phone} onChange={set("phone")} />
        </div>
        <TextField label="Address" value={form.address} onChange={set("address")} />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
