import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const customersReq = useFetch<{ customers: Customer[] }>("/customers");
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");
  const taxRatesReq = useFetch<{ taxRates: TaxRate[] }>("/tax-rates");

  const [customerId, setCustomerId] = useState("");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(inputDate());
  const [dueDate, setDueDate] = useState(() => inputDate(new Date(Date.now() + 30 * 864e5)));
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(isEdit);

  // In edit mode, load the draft invoice and prefill the form.
  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;
    (async () => {
      try {
        const { data } = await api.get<{
          invoice: {
            customerId: string;
            number: string;
            issueDate: string;
            dueDate: string;
            lines: {
              description: string;
              quantity: string;
              unitPrice: string;
              taxRatePercent: string;
              incomeAccountId: string;
            }[];
          };
        }>(`/invoices/${id}`);
        if (ignore) return;
        const inv = data.invoice;
        setCustomerId(inv.customerId);
        setNumber(inv.number);
        setIssueDate(inputDate(inv.issueDate));
        setDueDate(inputDate(inv.dueDate));
        setLines(
          inv.lines.map((l) => ({
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
    return <Spinner label="Loading…" />;
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
      const tax = lineTotal * ((Number(l.taxRatePercent) || 0) / 100);
      acc.subtotal += lineTotal;
      acc.tax += tax;
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
        number: number.trim() || undefined, // blank -> server auto-numbers (INV-0001)
        issueDate,
        dueDate,
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
        ? await api.patch<{ invoice: { id: string } }>(`/invoices/${id}`, payload)
        : await api.post<{ invoice: { id: string } }>("/invoices", payload);
      navigate(`/invoices/${data.invoice.id}`);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Invoice" : "New Invoice"}
        subtitle="Saved as a draft — post it to hit the ledger"
      />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Invoice # (optional)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Auto (INV-0001)"
            />
            <TextField
              label="Issue date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
            />
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-1 font-medium">Description</th>
                  <th className="px-2 py-1 font-medium">Income account</th>
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
                        <option value="">Select…</option>
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
                          <option value="0">No tax</option>
                          {!["0", ...taxRates.map((r) => String(Number(r.ratePercent)))].includes(l.taxRatePercent) && (
                            <option value={l.taxRatePercent}>{Number(l.taxRatePercent)}% (custom)</option>
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
              + Add line
            </button>
            <div className="w-full max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" value={money(totals.subtotal)} />
              <Row label="Tax" value={money(totals.tax)} />
              <div className="border-t border-white/10 pt-1">
                <Row label="Total" value={money(totals.subtotal + totals.tax)} strong />
              </div>
            </div>
          </div>

          {error && <ErrorNote message={error} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate("/invoices")}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
            </Button>
          </div>
        </form>
      </Card>
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
