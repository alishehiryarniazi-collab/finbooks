import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { inputDate, money } from "../../lib/format";
import type { Account, Customer, TaxRate } from "../../lib/types";
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
  incomeAccountId: string;
}
const emptyLine = (): Line => ({
  description: "",
  quantity: "1",
  unitPrice: "",
  taxRatePercent: "0",
  incomeAccountId: "",
});
const FREQUENCIES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;

export function RecurringForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const customersReq = useFetch<{ customers: Customer[] }>("/customers");
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");
  const taxRatesReq = useFetch<{ taxRates: TaxRate[] }>("/tax-rates");

  const [customerId, setCustomerId] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [interval, setInterval] = useState("1");
  const [startDate, setStartDate] = useState(inputDate());
  const [endDate, setEndDate] = useState("");
  const [autoPost, setAutoPost] = useState(false);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;
    (async () => {
      try {
        const { data } = await api.get<{
          recurring: {
            customerId: string;
            frequency: string;
            interval: number;
            startDate: string;
            endDate: string | null;
            autoPost: boolean;
            lines: {
              description: string;
              quantity: string;
              unitPrice: string;
              taxRatePercent: string;
              incomeAccountId: string;
            }[];
          };
        }>(`/recurring-invoices/${id}`);
        if (ignore) return;
        const r = data.recurring;
        setCustomerId(r.customerId);
        setFrequency(r.frequency);
        setInterval(String(r.interval));
        setStartDate(inputDate(r.startDate));
        setEndDate(r.endDate ? inputDate(r.endDate) : "");
        setAutoPost(r.autoPost);
        setLines(
          r.lines.map((l) => ({
            description: l.description,
            quantity: String(Number(l.quantity)),
            unitPrice: String(Number(l.unitPrice)),
            taxRatePercent: String(Number(l.taxRatePercent)),
            incomeAccountId: l.incomeAccountId,
          })),
        );
      } catch (err) {
        if (!ignore) setError(apiError(err));
      } finally {
        if (!ignore) setLoadingDoc(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, isEdit]);

  if (customersReq.loading || accountsReq.loading || taxRatesReq.loading || loadingDoc)
    return <Spinner label={t("common.loading")} />;
  const customers = customersReq.data?.customers ?? [];
  const incomeAccounts = (accountsReq.data?.accounts ?? []).filter(
    (a) => a.type === "INCOME" && a.isPostable,
  );
  const taxRates = (taxRatesReq.data?.taxRates ?? []).filter((r) => r.isActive);

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
        customerId,
        frequency,
        interval: Number(interval) || 1,
        startDate,
        endDate: endDate || undefined,
        autoPost,
        lines: lines
          .filter((l) => l.description && l.incomeAccountId)
          .map((l) => ({
            description: l.description,
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            taxRatePercent: Number(l.taxRatePercent) || 0,
            incomeAccountId: l.incomeAccountId,
          })),
      };
      const { data } = isEdit
        ? await api.patch<{ recurring: { id: string } }>(`/recurring-invoices/${id}`, payload)
        : await api.post<{ recurring: { id: string } }>("/recurring-invoices", payload);
      navigate(`/recurring/${data.recurring.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? t("recur.editTitle") : t("recur.newTitle")}
        subtitle={t("recur.subtitle")}
      />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label={t("fields.customer")}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">{t("forms.select")}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t("recur.frequency")}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`recur.simple.${f}`)}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t("recur.interval")}
              type="number"
              min="1"
              max="52"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
            <TextField
              label={t("recur.startDate")}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <TextField
              label={t("recur.endDate")}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={autoPost}
                onChange={(e) => setAutoPost(e.target.checked)}
                className="h-4 w-4 accent-aurora-mint"
              />
              <span className="text-sm text-slate-300">{t("recur.autoPost")}</span>
            </label>
          </div>
          <p className="-mt-2 text-xs text-slate-500">{t("recur.autoPostHint")}</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-1 font-medium">{t("fields.description")}</th>
                  <th className="px-2 py-1 font-medium">{t("fields.incomeAccount")}</th>
                  <th className="px-2 py-1 text-right font-medium">{t("fields.qty")}</th>
                  <th className="px-2 py-1 text-right font-medium">{t("fields.unitPrice")}</th>
                  <th className="px-2 py-1 text-right font-medium">{t("fields.taxPct")}</th>
                  <th className="px-2 py-1 text-right font-medium">{t("fields.amount")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <input
                        className="input"
                        value={l.description}
                        onChange={(e) => setLine(i, { description: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <SelectField
                        value={l.incomeAccountId}
                        onChange={(e) => setLine(i, { incomeAccountId: e.target.value })}
                      >
                        <option value="">{t("forms.select")}</option>
                        {incomeAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </SelectField>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input w-20 text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.quantity}
                        onChange={(e) => setLine(i, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="input w-28 text-right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {taxRates.length > 0 ? (
                        <SelectField
                          value={l.taxRatePercent}
                          onChange={(e) => setLine(i, { taxRatePercent: e.target.value })}
                        >
                          <option value="0">{t("forms.noTax")}</option>
                          {!["0", ...taxRates.map((r) => String(Number(r.ratePercent)))].includes(
                            l.taxRatePercent,
                          ) && (
                            <option value={l.taxRatePercent}>
                              {t("forms.custom", { pct: Number(l.taxRatePercent) })}
                            </option>
                          )}
                          {taxRates.map((r) => (
                            <option key={r.id} value={String(Number(r.ratePercent))}>
                              {r.name}
                            </option>
                          ))}
                        </SelectField>
                      ) : (
                        <input
                          className="input w-20 text-right"
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.taxRatePercent}
                          onChange={(e) => setLine(i, { taxRatePercent: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">
                      {money((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}
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
            </table>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => setLines([...lines, emptyLine()])}
              className="btn-ghost text-sm"
            >
              {t("actions.addLine")}
            </button>
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>{t("fields.subtotal")}</span>
                <span className="tabular-nums">{money(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{t("fields.tax")}</span>
                <span className="tabular-nums">{money(totals.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1 font-semibold text-white">
                <span>{t("fields.total")}</span>
                <span className="tabular-nums">{money(totals.subtotal + totals.tax)}</span>
              </div>
            </div>
          </div>

          {error && <ErrorNote message={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/recurring")}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("actions.saving") : isEdit ? t("actions.saveChanges") : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
