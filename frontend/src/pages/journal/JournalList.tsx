import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import type { JournalEntry, VoucherType } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { ErrorNote } from "../Dashboard";

const VOUCHER_LABEL: Record<VoucherType, string> = {
  JOURNAL: "Journal Voucher",
  DEBIT: "Debit Voucher",
  CREDIT: "Credit Voucher",
};

const VOUCHER_STYLE: Record<VoucherType, string> = {
  JOURNAL: "bg-white/8 text-slate-300",
  DEBIT: "bg-rose-500/15 text-rose-300",
  CREDIT: "bg-emerald-500/15 text-emerald-300",
};

type Filter = "ALL" | VoucherType;
const FILTERS: Filter[] = ["ALL", "JOURNAL", "DEBIT", "CREDIT"];

export function JournalList() {
  const { data, loading, error } = useFetch<{ entries: JournalEntry[] }>("/journal");
  const { hasRole } = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");

  if (loading) return <Spinner label="Loading vouchers…" />;
  if (error) return <ErrorNote message={error} />;

  const all = data?.entries ?? [];
  const entries = filter === "ALL" ? all : all.filter((e) => e.voucherType === filter);
  const canWrite = hasRole("ADMIN", "ACCOUNTANT");

  return (
    <div>
      <PageHeader
        title="Vouchers & Journal"
        subtitle="Every posting in the general ledger"
        action={
          canWrite && (
            <div className="flex flex-wrap gap-2">
              <Link to="/vouchers/credit/new"><Button variant="ghost">+ Credit Voucher</Button></Link>
              <Link to="/vouchers/debit/new"><Button variant="ghost">+ Debit Voucher</Button></Link>
              <Link to="/journal/new"><Button>+ Journal Voucher</Button></Link>
            </div>
          )
        }
      />

      {/* Voucher-type filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              filter === f ? "bg-aurora-mint/15 text-white" : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {f === "ALL" ? "All" : VOUCHER_LABEL[f]}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-slate-500">No vouchers here yet.</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const total = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
            const vt = entry.voucherType;
            return (
              <Card key={entry.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-white">{entry.memo ?? VOUCHER_LABEL[vt]}</span>
                    {entry.reference && <span className="ml-2 text-xs text-slate-500">#{entry.reference}</span>}
                    <p className="text-xs text-slate-500">{shortDate(entry.date)} · {entry.source}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${VOUCHER_STYLE[vt]}`}>{VOUCHER_LABEL[vt]}</span>
                    <span className="tabular-nums text-sm text-slate-300">{money(total)}</span>
                    <StatusBadge status={entry.status} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-1 font-medium">Account</th>
                        <th className="py-1 text-right font-medium">Debit</th>
                        <th className="py-1 text-right font-medium">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((l) => (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="py-1.5 text-slate-300">
                            <span className="text-xs text-slate-500">{l.account?.code}</span> {l.account?.name}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-400">
                            {Number(l.debit) > 0 ? money(l.debit) : ""}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-400">
                            {Number(l.credit) > 0 ? money(l.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
