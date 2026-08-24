import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/format";
import type { Account, AccountType } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

const TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export function ChartOfAccounts() {
  const { data, loading, error, refetch } = useFetch<{ accounts: Account[] }>("/accounts");
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <Spinner label="Loading accounts…" />;
  if (error) return <ErrorNote message={error} />;

  const accounts = data?.accounts ?? [];

  return (
    <div>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Every account your books are built on"
        action={
          hasRole("ADMIN", "ACCOUNTANT") && <Button onClick={() => setOpen(true)}>+ New account</Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {TYPES.map((type) => {
          const rows = accounts.filter((a) => a.type === type);
          if (rows.length === 0) return null;
          return (
            <Card key={type}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{type}</h3>
              <div className="flex flex-col divide-y divide-white/5">
                {rows.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <span className="text-xs text-slate-500">{a.code}</span>
                      <span className="ml-2 text-sm text-white">{a.name}</span>
                    </div>
                    <span className="tabular-nums text-sm text-slate-300">{money(a.balance)}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {open && <NewAccountModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refetch(); }} />}
    </div>
  );
}

function NewAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", type: "EXPENSE" as AccountType });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/accounts", form);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New account">
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="6500" />
          <SelectField label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </SelectField>
        </div>
        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Software Subscriptions" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}
