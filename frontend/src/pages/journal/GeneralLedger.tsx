import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { money, shortDate } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import type { Account, AccountType, VoucherType } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { SelectField, TextField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

interface LedgerRow {
  date: string;
  memo: string | null;
  reference: string | null;
  voucherType: VoucherType;
  description: string | null;
  debit: string;
  credit: string;
  balance: string;
}

interface LedgerData {
  account: { id: string; code: string; name: string; type: AccountType; normalBalance: "DEBIT" | "CREDIT" };
  opening: string;
  rows: LedgerRow[];
  closing: string;
}

const VT_SHORT: Record<VoucherType, string> = { JOURNAL: "JV", DEBIT: "DV", CREDIT: "CV" };

const TYPE_ORDER: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export function GeneralLedger() {
  const { accountId: paramId } = useParams();
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");

  const postable = useMemo(
    () => (accountsReq.data?.accounts ?? []).filter((a) => a.isPostable),
    [accountsReq.data],
  );

  const [accountId, setAccountId] = useState(paramId ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the param account (if valid) or the first postable account.
  useEffect(() => {
    if (accountId || postable.length === 0) return;
    const valid = paramId && postable.some((a) => a.id === paramId) ? paramId : postable[0].id;
    setAccountId(valid);
  }, [postable, paramId, accountId]);

  // Load the statement whenever the account or date range changes.
  useEffect(() => {
    if (!accountId) return;
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (from) qs.set("from", from);
        if (to) qs.set("to", to);
        const res = await api.get<LedgerData>(`/journal/ledger/${accountId}${qs.toString() ? `?${qs}` : ""}`);
        if (!ignore) setLedger(res.data);
      } catch (err) {
        if (!ignore) setError(apiError(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [accountId, from, to]);

  // Group the account picker by type for a tidy dropdown.
  const grouped = useMemo(() => {
    const map = new Map<AccountType, Account[]>();
    for (const a of postable) {
      if (!map.has(a.type)) map.set(a.type, []);
      map.get(a.type)!.push(a);
    }
    return TYPE_ORDER.filter((t) => map.has(t)).map((t) => ({ type: t, accounts: map.get(t)! }));
  }, [postable]);

  return (
    <div>
      <PageHeader title="General Ledger" subtitle="Account statement with a running balance" />

      {/* Controls */}
      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <SelectField label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select account…</option>
              {grouped.map((g) => (
                <optgroup key={g.type} label={g.type}>
                  {g.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>
          </div>
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost mt-3 text-xs">
            Clear dates
          </button>
        )}
      </Card>

      {loading && <Spinner label="Loading ledger…" />}
      {error && !loading && <ErrorNote message={error} />}

      {!loading && !error && ledger && (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div>
              <span className="text-xs text-slate-500">{ledger.account.code}</span>
              <span className="ml-2 text-sm font-semibold text-white">{ledger.account.name}</span>
              <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                {ledger.account.type}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-500">Closing balance</p>
                <p className="tabular-nums text-sm font-semibold text-white">{money(ledger.closing)}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  const csv = toCsv(
                    ["Date", "Type", "Ref", "Details", "Debit", "Credit", "Balance"],
                    [
                      ["", "", "", "Opening balance", "", "", ledger.opening],
                      ...ledger.rows.map((r) => [shortDate(r.date), r.voucherType, r.reference ?? "", r.description ?? r.memo ?? "", r.debit, r.credit, r.balance]),
                      ["", "", "", "Closing balance", "", "", ledger.closing],
                    ],
                  );
                  downloadCsv(`ledger-${ledger.account.code}`, csv);
                }}
              >
                Export CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Ref</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="px-3 py-2 text-right font-medium">Debit</th>
                  <th className="px-3 py-2 text-right font-medium">Credit</th>
                  <th className="px-3 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr className="border-b border-white/5 text-slate-400">
                  <td className="px-3 py-2" colSpan={4}>Opening balance</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">{money(ledger.opening)}</td>
                </tr>

                {ledger.rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-3 py-2 text-slate-400">{shortDate(r.date)}</td>
                    <td className="px-3 py-2 text-slate-500">{VT_SHORT[r.voucherType]}</td>
                    <td className="px-3 py-2 text-slate-500">{r.reference ?? ""}</td>
                    <td className="px-3 py-2 text-slate-300">{r.description ?? r.memo ?? ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">{Number(r.debit) ? money(r.debit) : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">{Number(r.credit) ? money(r.credit) : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white">{money(r.balance)}</td>
                  </tr>
                ))}

                {ledger.rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                      No transactions in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold text-white">
                  <td className="px-3 py-2" colSpan={6}>Closing balance</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(ledger.closing)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
