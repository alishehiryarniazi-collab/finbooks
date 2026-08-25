import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError, apiErrorCode } from "../../lib/api";
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
  // Only postable (leaf), ACTIVE accounts can appear as line accounts.
  const accounts = (data?.accounts ?? []).filter((a) => a.isPostable && a.isActive);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;
  const LARGE_AMOUNT = 1_000_000; // ask to confirm unusually large entries

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  // Fill the difference onto a line so debits === credits (smart helper).
  function autoBalance() {
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
    if (diff === 0) return;
    // Prefer a line that has an account but no amount yet; else the last line.
    let target = lines.findIndex((l) => l.accountId && !Number(l.debit) && !Number(l.credit));
    if (target === -1) target = lines.length - 1;
    const patch = diff > 0 ? { credit: String(diff), debit: "" } : { debit: String(-diff), credit: "" };
    setLines(lines.map((l, idx) => (idx === target ? { ...l, ...patch } : l)));
  }

  // Posts the entry; on a confirmable guard (negative cash / duplicate ref) it asks and retries.
  async function doPost(overrides: { allowNegativeCash?: boolean; allowDuplicateRef?: boolean }) {
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
        ...overrides,
      };
      await api.post("/journal", payload);
      navigate("/journal");
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "NEGATIVE_CASH" && !overrides.allowNegativeCash) {
        setBusy(false);
        if (window.confirm(`${apiError(err)}\n\nProceed anyway?`)) return doPost({ ...overrides, allowNegativeCash: true });
        return;
      }
      if (code === "DUPLICATE_REF" && !overrides.allowDuplicateRef) {
        setBusy(false);
        if (window.confirm(`${apiError(err)}\n\nPost it anyway?`)) return doPost({ ...overrides, allowDuplicateRef: true });
        return;
      }
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (totalDebit > LARGE_AMOUNT && !window.confirm(`This entry is large (${money(totalDebit)}). Post it?`)) return;
    await doPost({});
  }

  return (
    <div>
      <PageHeader
        title="New Journal Voucher"
        subtitle="Non-cash adjusting entry — debits must equal credits"
      />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <TextField
              label="Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="JE-001"
            />
            <TextField
              label="Memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Description"
            />
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
                      <SelectField
                        value={line.accountId}
                        onChange={(e) => setLine(i, { accountId: e.target.value })}
                      >
                        <option value="">Select account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </SelectField>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          ✕
                        </button>
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLines([...lines, emptyLine()])}
                className="btn-ghost text-sm"
              >
                + Add line
              </button>
              {!balanced && totalDebit + totalCredit > 0 && (
                <button type="button" onClick={autoBalance} className="btn-ghost text-sm">
                  ⚖ Auto-balance
                </button>
              )}
            </div>
            <span className={`text-sm ${balanced ? "text-emerald-300" : "text-amber-300"}`}>
              {balanced ? "✓ Balanced" : `Out of balance by ${money(Math.abs(totalDebit - totalCredit))}`}
            </span>
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/journal")}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !balanced}>
              {busy ? "Posting…" : "Post entry"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
