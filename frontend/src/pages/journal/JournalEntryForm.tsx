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
import { TextField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

interface LineRow {
  accountId: string;
  debit: string;
  credit: string;
}

const emptyLine = (): LineRow => ({ accountId: "", debit: "", credit: "" });

export function JournalEntryForm() {
  const navigate = useNavigate();
  const { data, loading } = useFetch<{ accounts: Account[] }>("/accounts");
  const [date, setDate] = useState(inputDate());
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="Loading accounts…" />;
  // Only postable (leaf) accounts can appear as line accounts.
  const accounts = (data?.accounts ?? []).filter((a) => a.isPostable);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

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
        lines: lines
          .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
          .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
      };
      await api.post("/journal", payload);
      navigate("/journal");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Journal Voucher" subtitle="Non-cash adjusting entry — debits must equal credits" />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="JE-001" />
            <TextField label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Description" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-1 font-medium">Account</th>
                  <th className="px-2 py-1 text-right font-medium">Debit</th>
                  <th className="px-2 py-1 text-right font-medium">Credit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <select
                        className="input [&>option]:bg-aurora-bg2"
                        value={line.accountId}
                        onChange={(e) => setLine(i, { accountId: e.target.value })}
                      >
                        <option value="">Select account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input text-right"
                        type="number" min="0" step="0.01"
                        value={line.debit}
                        onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input text-right"
                        type="number" min="0" step="0.01"
                        value={line.credit}
                        onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {lines.length > 2 && (
                        <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-slate-500 hover:text-rose-400">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-medium text-white">
                  <td className="px-2 py-2">Totals</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(totalDebit)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setLines([...lines, emptyLine()])} className="btn-ghost text-sm">
              + Add line
            </button>
            <span className={`text-sm ${balanced ? "text-emerald-300" : "text-amber-300"}`}>
              {balanced ? "✓ Balanced" : `Out of balance by ${money(Math.abs(totalDebit - totalCredit))}`}
            </span>
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/journal")}>Cancel</Button>
            <Button type="submit" disabled={busy || !balanced}>{busy ? "Posting…" : "Post entry"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
