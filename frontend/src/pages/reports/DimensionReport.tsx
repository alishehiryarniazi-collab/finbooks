import { useState } from "react";
import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

interface DimRow {
  id: string;
  name: string;
  income: string;
  expense: string;
  net: string;
}
interface DimData {
  rows: DimRow[];
  totals: { income: string; expense: string; net: string };
}

// Shared "profit by dimension" report (cost centre / project): income − expense per row.
function DimensionReport({
  endpoint,
  title,
  subtitle,
  header,
  filename,
}: {
  endpoint: string;
  title: string;
  subtitle: string;
  header: string;
  filename: string;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const { data, loading, error } = useFetch<DimData>(`${endpoint}${qs.toString() ? `?${qs}` : ""}`);

  function exportCsv() {
    if (!data) return;
    const csv = toCsv(
      [header, "Income", "Expense", "Net"],
      [
        ...data.rows.map((r) => [r.name, r.income, r.expense, r.net]),
        ["Total", data.totals.income, data.totals.expense, data.totals.net],
      ],
    );
    downloadCsv(filename, csv);
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={data && data.rows.length > 0 && <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44"><TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-44"><TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs">Clear</button>
          )}
        </div>
      </Card>

      {loading && <Spinner label="Building report…" />}
      {error && !loading && <ErrorNote message={error} />}

      {!loading && !error && data && (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-4 py-2 font-medium">{header}</th>
                  <th className="px-4 py-2 text-right font-medium">Income</th>
                  <th className="px-4 py-2 text-right font-medium">Expense</th>
                  <th className="px-4 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>Nothing recorded yet.</td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-white">{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-300">{money(r.income)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-300">{money(r.expense)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${Number(r.net) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {money(r.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold text-white">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(data.totals.income)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(data.totals.expense)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(data.totals.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function CostCenterReport() {
  return (
    <DimensionReport
      endpoint="/reports/cost-centers"
      title="Profit by Cost Center"
      subtitle="Income minus expense for each department/segment"
      header="Cost Center"
      filename="profit-by-cost-center"
    />
  );
}

export function ProjectReport() {
  return (
    <DimensionReport
      endpoint="/reports/projects"
      title="Project P&L"
      subtitle="Income minus expense for each project"
      header="Project"
      filename="project-pnl"
    />
  );
}
