import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError, apiErrorCode } from "../../lib/api";
import { inputDate, money } from "../../lib/format";
import type { Account, CostCenter, Project } from "../../lib/types";
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
  const ccReq = useFetch<{ costCenters: CostCenter[] }>("/cost-centers");
  const projReq = useFetch<{ projects: Project[] }>("/projects");
  const [date, setDate] = useState(inputDate());
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label="Loading accounts…" />;
  const accounts = (data?.accounts ?? []).filter((a) => a.isPostable && a.isActive);
  const bankAccounts = accounts.filter((a) => a.type === "ASSET");
  const costCenters = (ccReq.data?.costCenters ?? []).filter((c) => c.isActive);
  const projects = (projReq.data?.projects ?? []).filter((p) => p.isActive);
  const LARGE_AMOUNT = 1_000_000;

  const isPayment = kind === "DEBIT";
  const copy = isPayment
    ? {
        title: "New Debit Voucher",
        sub: "Payment — cash/bank goes out",
        bank: "Paid from (Cash / Bank)",
        lines: "Accounts debited (expense / party)",
        cta: "Post payment",
      }
    : {
        title: "New Credit Voucher",
        sub: "Receipt — cash/bank comes in",
        bank: "Received in (Cash / Bank)",
        lines: "Accounts credited (income / party)",
        cta: "Post receipt",
      };

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const ready = !!bankAccountId && total > 0 && lines.some((l) => l.accountId && Number(l.amount) > 0);

  function setLine(i: number, patch: Partial<LineRow>) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  // Posts the voucher; on a confirmable guard (negative cash / duplicate ref) it asks and retries.
  async function doPost(overrides: { allowNegativeCash?: boolean; allowDuplicateRef?: boolean }) {
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
          .map((l) => ({
            accountId: l.accountId,
            amount: Number(l.amount),
            description: l.description || undefined,
            costCenterId: costCenterId || undefined,
            projectId: projectId || undefined,
          })),
        ...overrides,
      };
      await api.post(isPayment ? "/journal/debit-voucher" : "/journal/credit-voucher", payload);
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
    if (total > LARGE_AMOUNT && !window.confirm(`This voucher is large (${money(total)}). Post it?`)) return;
    await doPost({});
  }

  return (
    <div>
      <PageHeader title={copy.title} subtitle={copy.sub} />
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
              placeholder={isPayment ? "PV-001" : "RV-001"}
            />
            <TextField
              label="Memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Description"
            />
          </div>

          <SelectField
            label={copy.bank}
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            required
          >
            <option value="">Select account…</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </SelectField>

          {(costCenters.length > 0 || projects.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {costCenters.length > 0 && (
                <SelectField label="Cost center (optional)" value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
                  <option value="">— None —</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>
                  ))}
                </SelectField>
              )}
              {projects.length > 0 && (
                <SelectField label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">— None —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</option>
                  ))}
                </SelectField>
              )}
            </div>
          )}

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
                              <option key={a.id} value={a.id}>
                                {a.code} · {a.name}
                              </option>
                            ))}
                        </SelectField>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="input"
                          value={line.description}
                          onChange={(e) => setLine(i, { description: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className="input text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.amount}
                          onChange={(e) => setLine(i, { amount: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {lines.length > 1 && (
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
                    <td className="px-2 py-2" colSpan={2}>
                      Total {isPayment ? "paid" : "received"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setLines([...lines, emptyLine()])}
              className="btn-ghost text-sm"
            >
              + Add line
            </button>
            <span className="text-xs text-slate-500">
              {isPayment ? "Cash/Bank will be credited" : "Cash/Bank will be debited"} for {money(total)}
            </span>
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/journal")}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !ready}>
              {busy ? "Posting…" : copy.cta}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
