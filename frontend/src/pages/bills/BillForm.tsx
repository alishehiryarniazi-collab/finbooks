import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { inputDate, money } from "../../lib/format";
import type { Account, Vendor } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

interface Line {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
  expenseAccountId: string;
}

const emptyLine = (): Line => ({ description: "", quantity: "1", unitPrice: "", taxRatePercent: "0", expenseAccountId: "" });

export function BillForm() {
  const navigate = useNavigate();
  const vendorsReq = useFetch<{ vendors: Vendor[] }>("/vendors");
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");

  const [vendorId, setVendorId] = useState("");
  const [number, setNumber] = useState("");
  const [billDate, setBillDate] = useState(inputDate());
  const [dueDate, setDueDate] = useState(inputDate(new Date(Date.now() + 30 * 864e5)));
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (vendorsReq.loading || accountsReq.loading) return <Spinner label="Loading…" />;
  const vendors = vendorsReq.data?.vendors ?? [];
  const expenseAccounts = (accountsReq.data?.accounts ?? []).filter((a) => a.type === "EXPENSE" && a.isPostable);

  function setLine(i: number, patch: Partial<Line>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const totals = lines.reduce(
    (acc, l) => {
      const lineTotal = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      acc.subtotal += lineTotal;
      acc.tax += lineTotal * ((Number(l.taxRatePercent) || 0) / 100);
      return acc;
    },
    { subtotal: 0, tax: 0 },
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        vendorId,
        number,
        billDate,
        dueDate,
        lines: lines
          .filter((l) => l.description && l.expenseAccountId)
          .map((l) => ({
            description: l.description,
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            taxRatePercent: Number(l.taxRatePercent) || 0,
            expenseAccountId: l.expenseAccountId,
          })),
      };
      const { data } = await api.post<{ bill: { id: string } }>("/bills", payload);
      navigate(`/bills/${data.bill.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Bill" subtitle="Saved as a draft — post it to hit the ledger" />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField label="Vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              <option value="">Select…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </SelectField>
            <TextField label="Bill #" value={number} onChange={(e) => setNumber(e.target.value)} required placeholder="BILL-2004" />
            <TextField label="Bill date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required />
            <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-1 font-medium">Description</th>
                  <th className="px-2 py-1 font-medium">Expense account</th>
                  <th className="px-2 py-1 text-right font-medium">Qty</th>
                  <th className="px-2 py-1 text-right font-medium">Unit price</th>
                  <th className="px-2 py-1 text-right font-medium">Tax %</th>
                  <th className="px-2 py-1 text-right font-medium">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5"><input className="input" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                    <td className="px-2 py-1.5">
                      <select className="input [&>option]:bg-aurora-bg2" value={l.expenseAccountId} onChange={(e) => setLine(i, { expenseAccountId: e.target.value })}>
                        <option value="">Select…</option>
                        {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5"><input className="input w-20 text-right" type="number" min="0" step="0.01" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input className="input w-28 text-right" type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} /></td>
                    <td className="px-2 py-1.5"><input className="input w-20 text-right" type="number" min="0" step="0.01" value={l.taxRatePercent} onChange={(e) => setLine(i, { taxRatePercent: e.target.value })} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{money((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}</td>
                    <td className="px-2 py-1.5 text-center">{lines.length > 1 && <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-rose-400">✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <button type="button" onClick={() => setLines([...lines, emptyLine()])} className="btn-ghost text-sm">+ Add line</button>
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
              <div className="flex justify-between text-slate-400"><span>Tax</span><span className="tabular-nums">{money(totals.tax)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1 font-semibold text-white"><span>Total</span><span className="tabular-nums">{money(totals.subtotal + totals.tax)}</span></div>
            </div>
          </div>

          {error && <ErrorNote message={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/bills")}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
