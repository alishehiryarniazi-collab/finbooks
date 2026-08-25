import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../Dashboard";

interface AgingRow {
  current: string;
  d1_30: string;
  d31_60: string;
  d61_90: string;
  d90_plus: string;
  total: string;
  [party: string]: string;
}

interface Aging {
  rows: AgingRow[];
  totals: Omit<AgingRow, "customer" | "vendor">;
}

const BUCKETS: { key: keyof AgingRow; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1–30" },
  { key: "d31_60", label: "31–60" },
  { key: "d61_90", label: "61–90" },
  { key: "d90_plus", label: "90+" },
];

// Shared aging table for AR (by customer) and AP (by vendor).
export function AgingReport({ endpoint, title, subtitle, partyKey, partyHeader }: {
  endpoint: string;
  title: string;
  subtitle: string;
  partyKey: "customer" | "vendor";
  partyHeader: string;
}) {
  const { data, loading, error } = useFetch<Aging>(endpoint);
  if (loading) return <Spinner label="Building aging report…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  function exportCsv() {
    const d = data!;
    const csv = toCsv(
      [partyHeader, ...BUCKETS.map((b) => b.label), "Total"],
      [
        ...d.rows.map((r) => [r[partyKey], ...BUCKETS.map((b) => r[b.key]), r.total]),
        ["Totals", ...BUCKETS.map((b) => d.totals[b.key]), d.totals.total],
      ],
    );
    downloadCsv(title.toLowerCase().replace(/\s+/g, "-"), csv);
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={data.rows.length > 0 && <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>}
      />
      <Card>
        {data.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Nothing outstanding. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-3 py-2 font-medium">{partyHeader}</th>
                  {BUCKETS.map((b) => <th key={b.key} className="px-3 py-2 text-right font-medium">{b.label}</th>)}
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{r[partyKey]}</td>
                    {BUCKETS.map((b) => <td key={b.key} className="px-3 py-2 text-right tabular-nums text-slate-300">{Number(r[b.key]) ? money(r[b.key]) : ""}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-white">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold text-white">
                  <td className="px-3 py-2">Totals</td>
                  {BUCKETS.map((b) => <td key={b.key} className="px-3 py-2 text-right tabular-nums">{money(data.totals[b.key])}</td>)}
                  <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
