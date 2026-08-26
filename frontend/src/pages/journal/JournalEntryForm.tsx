import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  debit: string;
  credit: string;
}

const emptyLine = (): LineRow => ({ accountId: "", debit: "", credit: "" });

export function JournalEntryForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading } = useFetch<{ accounts: Account[] }>("/accounts");
  const ccReq = useFetch<{ costCenters: CostCenter[] }>("/cost-centers");
  const projReq = useFetch<{ projects: Project[] }>("/projects");
  const [date, setDate] = useState(inputDate());
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label={t("coa.loading")} />;
  // Only postable (leaf), ACTIVE accounts can appear as line accounts.
  const accounts = (data?.accounts ?? []).filter((a) => a.isPostable && a.isActive);
  const costCenters = (ccReq.data?.costCenters ?? []).filter((c) => c.isActive);
  const projects = (projReq.data?.projects ?? []).filter((p) => p.isActive);

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
          .map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            costCenterId: costCenterId || undefined,
            projectId: projectId || undefined,
          })),
        ...overrides,
      };
      await api.post("/journal", payload);
      navigate("/journal");
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "NEGATIVE_CASH" && !overrides.allowNegativeCash) {
        setBusy(false);
        if (window.confirm(`${apiError(err)}\n\n${t("actions.proceedAnyway")}`)) return doPost({ ...overrides, allowNegativeCash: true });
        return;
      }
      if (code === "DUPLICATE_REF" && !overrides.allowDuplicateRef) {
        setBusy(false);
        if (window.confirm(`${apiError(err)}\n\n${t("voucher.postAnyway")}`)) return doPost({ ...overrides, allowDuplicateRef: true });
        return;
      }
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (totalDebit > LARGE_AMOUNT && !window.confirm(t("voucher.largeEntryConfirm", { amount: money(totalDebit) }))) return;
    await doPost({});
  }

  return (
    <div>
      <PageHeader
        title={t("voucher.journalTitle")}
        subtitle={t("voucher.journalSub")}
      />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label={t("fields.date")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <TextField
              label={t("fields.reference")}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="JE-001"
            />
            <TextField
              label={t("voucher.memo")}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t("fields.description")}
            />
          </div>

          {(costCenters.length > 0 || projects.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {costCenters.length > 0 && (
                <SelectField label={t("voucher.costCenterOptional")} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
                  <option value="">{t("voucher.none")}</option>
                  {costCenters.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>
                  ))}
                </SelectField>
              )}
              {projects.length > 0 && (
                <SelectField label={t("voucher.projectOptional")} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">{t("voucher.none")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</option>
                  ))}
                </SelectField>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-1 font-medium">{t("fields.account")}</th>
                  <th className="px-2 py-1 text-right font-medium">{t("fields.debit")}</th>
                  <th className="px-2 py-1 text-right font-medium">{t("fields.credit")}</th>
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
                        <option value="">{t("ledger.selectAccount")}</option>
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
                  <td className="px-2 py-2">{t("fields.totals")}</td>
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
                {t("actions.addLine")}
              </button>
              {!balanced && totalDebit + totalCredit > 0 && (
                <button type="button" onClick={autoBalance} className="btn-ghost text-sm">
                  ⚖ {t("actions.autoBalance")}
                </button>
              )}
            </div>
            <span className={`text-sm ${balanced ? "text-emerald-300" : "text-amber-300"}`}>
              {balanced ? t("voucher.balanced") : t("voucher.outOfBalanceBy", { amount: money(Math.abs(totalDebit - totalCredit)) })}
            </span>
          </div>

          {error && <ErrorNote message={error} />}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/journal")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy || !balanced}>
              {busy ? t("actions.posting") : t("voucher.postEntry")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
