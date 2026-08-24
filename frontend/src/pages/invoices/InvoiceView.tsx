import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { inputDate, money, shortDate } from "../../lib/format";
import type { Account, Invoice } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

export function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data, loading, error, refetch } = useFetch<{ invoice: Invoice }>(`/invoices/${id}`);
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");
  const [payOpen, setPayOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="Loading invoice…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const inv = data.invoice;
  const outstanding = Number(inv.total) - Number(inv.amountPaid);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  async function action(path: string) {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/invoices/${id}/${path}`);
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
        title={`Invoice ${inv.number}`}
        subtitle={inv.customer?.name}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/invoices")}>← Back</Button>
            {canEdit && inv.status === "DRAFT" && <Button onClick={() => action("post")} disabled={busy}>Post to ledger</Button>}
            {canEdit && (inv.status === "SENT" || inv.status === "PARTIAL") && outstanding > 0 && (
              <Button onClick={() => setPayOpen(true)}>Record payment</Button>
            )}
            {canEdit && inv.status !== "VOID" && inv.status !== "PAID" && Number(inv.amountPaid) === 0 && (
              <Button variant="ghost" onClick={() => action("void")} disabled={busy}>Void</Button>
            )}
          </div>
        }
      />

      {actionError && <div className="mb-4"><ErrorNote message={actionError} /></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <StatusBadge status={inv.status} />
            <span className="text-sm text-slate-400">Due {shortDate(inv.dueDate)}</span>
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
                {inv.lines?.map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="px-2 py-2">
                      <p className="text-white">{l.description}</p>
                      <p className="text-xs text-slate-500">{l.incomeAccount?.code} · {l.incomeAccount?.name}</p>
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
            <SummaryRow label="Subtotal" value={money(inv.subtotal)} />
            <SummaryRow label="Tax" value={money(inv.taxTotal)} />
            <div className="border-t border-white/10 pt-2"><SummaryRow label="Total" value={money(inv.total)} strong /></div>
            <SummaryRow label="Paid" value={money(inv.amountPaid)} />
            <SummaryRow label="Outstanding" value={money(outstanding)} strong />
          </div>
        </Card>
      </div>

      {payOpen && (
        <PaymentModal
          invoiceId={inv.id}
          outstanding={outstanding}
          bankAccounts={(accountsReq.data?.accounts ?? []).filter((a) => a.type === "ASSET")}
          onClose={() => setPayOpen(false)}
          onSaved={() => { setPayOpen(false); refetch(); }}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-white" : "text-slate-400"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function PaymentModal({
  invoiceId,
  outstanding,
  bankAccounts,
  onClose,
  onSaved,
}: {
  invoiceId: string;
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
      await api.post(`/invoices/${invoiceId}/payments`, { amount: Number(amount), bankAccountId, date });
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Record payment">
      <form onSubmit={save} className="flex flex-col gap-4">
        <SelectField label="Deposit to" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
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
