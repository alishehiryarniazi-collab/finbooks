import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../Dashboard";

interface TB {
  rows: { code: string; name: string; type: string; debit: string; credit: string }[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

export function TrialBalance() {
  const { data, loading, error } = useFetch<TB>("/reports/trial-balance");
  if (loading) return <Spinner label="Building trial balance…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  function exportCsv() {
    const d = data!;
    const csv = toCsv(
      ["Code", "Account", "Type", "Debit", "Credit"],
      [
        ...d.rows.map((r) => [r.code, r.name, r.type, r.debit, r.credit]),
        ["", "Totals", "", d.totalDebit, d.totalCredit],
      ],
    );
    downloadCsv("trial-balance", csv);
  }

  return (
    <div>
      <PageHeader
        title="Trial Balance"
        subtitle="Every account's balance — debits must equal credits"
        action={
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-sm ${data.balanced ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"}`}>
              {data.balanced ? "✓ Balanced" : "✗ Not balanced"}
            </span>
            <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
          </div>
        }
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-3 py-2 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.code} className="border-b border-white/5">
                  <td className="px-3 py-2 text-slate-500">{r.code}</td>
                  <td className="px-3 py-2 text-white">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">{Number(r.debit) ? money(r.debit) : ""}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">{Number(r.credit) ? money(r.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 font-semibold text-white">
                <td className="px-3 py-2" colSpan={2}>Totals</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(data.totalDebit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(data.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
