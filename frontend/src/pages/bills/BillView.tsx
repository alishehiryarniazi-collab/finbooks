import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { inputDate, money, shortDate } from "../../lib/format";
import type { Account, Bill } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

export function BillView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data, loading, error, refetch } = useFetch<{ bill: Bill }>(`/bills/${id}`);
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");
  const [payOpen, setPayOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="Loading bill…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const bill = data.bill;
  const outstanding = Number(bill.total) - Number(bill.amountPaid);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  async function action(path: string) {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/bills/${id}/${path}`);
      refetch();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={`Bill ${bill.number}`}
        subtitle={bill.vendor?.name}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/bills")}>← Back</Button>
            <Button variant="ghost" onClick={() => navigate(`/bills/${id}/print`)}>🖨 Print / PDF</Button>
            {canEdit && bill.status === "DRAFT" && <Button onClick={() => action("post")} disabled={busy}>Post to ledger</Button>}
            {canEdit && (bill.status === "OPEN" || bill.status === "PARTIAL") && outstanding > 0 && (
              <Button onClick={() => setPayOpen(true)}>Pay bill</Button>
            )}
            {canEdit && bill.status !== "VOID" && bill.status !== "PAID" && Number(bill.amountPaid) === 0 && (
              <Button variant="ghost" onClick={() => action("void")} disabled={busy}>Void</Button>
            )}
          </div>
        }
      />

      {actionError && <div className="mb-4"><ErrorNote message={actionError} /></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <StatusBadge status={bill.status} />
            <span className="text-sm text-slate-400">Due {shortDate(bill.dueDate)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 text-right font-medium">Qty</th>
                  <th className="px-2 py-2 text-right font-medium">Price</th>
                  <th className="px-2 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines?.map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="px-2 py-2">
                      <p className="text-white">{l.description}</p>
                      <p className="text-xs text-slate-500">{l.expenseAccount?.code} · {l.expenseAccount?.name}</p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{Number(l.quantity)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-semibold text-white">Summary</h3>
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={money(bill.subtotal)} />
            <Row label="Tax" value={money(bill.taxTotal)} />
            <div className="border-t border-white/10 pt-2"><Row label="Total" value={money(bill.total)} strong /></div>
            <Row label="Paid" value={money(bill.amountPaid)} />
            <Row label="Outstanding" value={money(outstanding)} strong />
          </div>
        </Card>
      </div>

      {payOpen && (
        <PayModal
          billId={bill.id}
          outstanding={outstanding}
          bankAccounts={(accountsReq.data?.accounts ?? []).filter((a) => a.type === "ASSET" && a.isPostable)}
          onClose={() => setPayOpen(false)}
          onSaved={() => { setPayOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-white" : "text-slate-400"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function PayModal({
  billId,
  outstanding,
  bankAccounts,
  onClose,
  onSaved,
}: {
  billId: string;
  outstanding: number;
  bankAccounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [date, setDate] = useState(inputDate());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/bills/${billId}/payments`, { amount: Number(amount), bankAccountId, date });
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Pay bill">
      <form onSubmit={save} className="flex flex-col gap-4">
        <SelectField label="Pay from" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
          {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save payment"}</Button>
        </div>
      </form>
    </Modal>
  );
}
