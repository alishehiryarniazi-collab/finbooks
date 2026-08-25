import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { inputDate, money } from "../../lib/format";
import type { Account } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

interface LineRow {
  accountId: string;
  amount: string;
  description: string;
}

const emptyLine = (): LineRow => ({ accountId: "", amount: "", description: "" });

// Shared form for cash/bank vouchers.
//   DEBIT  = Payment: cash/bank goes OUT, counter accounts are debited.
//   CREDIT = Receipt: cash/bank comes IN, counter accounts are credited.
export function VoucherForm({ kind }: { kind: "DEBIT" | "CREDIT" }) {
  const navigate = useNavigate();
  const { data, loading } = useFetch<{ accounts: Account[] }>("/accounts");
  const [date, setDate] = useState(inputDate());
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="Loading accounts…" />;
  const accounts = (data?.accounts ?? []).filter((a) => a.isPostable);
  const bankAccounts = accounts.filter((a) => a.type === "ASSET");

  const isPayment = kind === "DEBIT";
  const copy = isPayment
    ? { title: "New Debit Voucher", sub: "Payment — cash/bank goes out", bank: "Paid from (Cash / Bank)", lines: "Accounts debited (expense / party)", cta: "Post payment" }
    : { title: "New Credit Voucher", sub: "Receipt — cash/bank comes in", bank: "Received in (Cash / Bank)", lines: "Accounts credited (income / party)", cta: "Post receipt" };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const ready = !!bankAccountId && total > 0 && lines.some((l) => l.accountId && Number(l.amount) > 0);

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        date,
        memo: memo || undefined,
        reference: reference || undefined,
        bankAccountId,
        lines: lines
          .filter((l) => l.accountId && Number(l.amount) > 0)
          .map((l) => ({ accountId: l.accountId, amount: Number(l.amount), description: l.description || undefined })),
      };
      await api.post(isPayment ? "/journal/debit-voucher" : "/journal/credit-voucher", payload);
      navigate("/journal");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.sub} />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={isPayment ? "PV-001" : "RV-001"} />
            <TextField label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
          </div>

          <SelectField label={copy.bank} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
            <option value="">Select account…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </SelectField>

          <div>
            <p className="label mb-2">{copy.lines}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="px-2 py-1 font-medium">Account</th>
                    <th className="px-2 py-1 font-medium">Description</th>
                    <th className="px-2 py-1 text-right font-medium">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <SelectField
                          value={line.accountId}
                          onChange={(e) => setLine(i, { accountId: e.target.value })}
                        >
                          <option value="">Select account…</option>
                          {accounts
                            .filter((a) => a.id !== bankAccountId)
                            .map((a) => (
                              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                            ))}
                        </SelectField>
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="input" value={line.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Optional" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="input text-right" type="number" min="0" step="0.01" value={line.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-rose-400">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10 font-medium text-white">
                    <td className="px-2 py-2" colSpan={2}>Total {isPayment ? "paid" : "received"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setLines([...lines, emptyLine()])} className="btn-ghost text-sm">+ Add line</button>
            <span className="text-xs text-slate-500">
              {isPayment ? "Cash/Bank will be credited" : "Cash/Bank will be debited"} for {money(total)}
            </span>
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/journal")}>Cancel</Button>
            <Button type="submit" disabled={busy || !ready}>{busy ? "Posting…" : copy.cta}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
