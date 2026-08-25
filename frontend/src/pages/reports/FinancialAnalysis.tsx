import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../Dashboard";

interface Analysis {
  kpis: { revenue: string; netProfit: string; cash: string; equity: string };
  ratios: Record<string, number | null>;
  healthScore: number;
  trend: { month: string; income: string; expense: string; net: string }[];
  insights: { text: string; tone: "good" | "warn" | "info" }[];
}

const fmtX = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
const fmtDays = (v: number | null) => (v === null ? "—" : `${Math.round(v)} days`);

const RATIO_GROUPS = [
  { title: "Liquidity", items: [
    { key: "currentRatio", label: "Current ratio", fmt: fmtX },
    { key: "quickRatio", label: "Quick ratio", fmt: fmtX },
  ] },
  { title: "Profitability", items: [
    { key: "grossMarginPct", label: "Gross margin", fmt: fmtPct },
    { key: "netMarginPct", label: "Net margin", fmt: fmtPct },
    { key: "returnOnEquityPct", label: "Return on equity", fmt: fmtPct },
  ] },
  { title: "Leverage & Efficiency", items: [
    { key: "debtToEquity", label: "Debt to equity", fmt: fmtX },
    { key: "arDays", label: "Receivable days", fmt: fmtDays },
    { key: "apDays", label: "Payable days", fmt: fmtDays },
  ] },
];

const TONE = { good: "text-emerald-300", warn: "text-amber-300", info: "text-sky-300" };

export function FinancialAnalysis() {
  const { data, loading, error } = useFetch<Analysis>("/reports/analysis");
  if (loading) return <Spinner label="Analysing your finances…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const chartData = data.trend.map((t) => ({ month: t.month.slice(5), Net: Number(t.net) }));

  function exportCsv() {
    const d = data!;
    const rows: (string | number)[][] = [
      ["Revenue", d.kpis.revenue],
      ["Net profit", d.kpis.netProfit],
      ["Cash", d.kpis.cash],
      ["Equity", d.kpis.equity],
      ["Health score", `${d.healthScore}/100`],
    ];
    for (const g of RATIO_GROUPS) for (const it of g.items) rows.push([it.label, it.fmt(d.ratios[it.key] ?? null)]);
    downloadCsv("financial-analysis", toCsv(["Metric", "Value"], rows));
  }

  return (
    <div>
      <PageHeader
        title="Financial Analysis"
        subtitle="Ratios, trend and insights from your ledger"
        action={<Button variant="ghost" onClick={exportCsv}>Export CSV</Button>}
      />

      {/* Health + KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border border-aurora-mint/30">
          <p className="text-xs uppercase tracking-wider text-slate-500">Health score</p>
          <p className="mt-1 text-3xl font-bold text-aurora-mint">{data.healthScore}<span className="text-lg text-slate-500">/100</span></p>
        </Card>
        <Kpi label="Revenue" value={money(data.kpis.revenue)} />
        <Kpi label="Net profit" value={money(data.kpis.netProfit)} />
        <Kpi label="Cash" value={money(data.kpis.cash)} />
        <Kpi label="Equity" value={money(data.kpis.equity)} />
      </div>

      {/* Ratios */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {RATIO_GROUPS.map((g) => (
          <Card key={g.title}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{g.title}</h3>
            <div className="flex flex-col divide-y divide-white/5">
              {g.items.map((it) => (
                <div key={it.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-300">{it.label}</span>
                  <span className="tabular-nums font-medium text-white">{it.fmt(data.ratios[it.key] ?? null)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Trend + Insights */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-white">Net profit trend (6 months)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#0b0e17", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(v: number) => money(v)}
                />
                <Bar dataKey="Net" fill="#5ff0d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-white">Insights</h3>
          <ul className="flex flex-col gap-3">
            {data.insights.length === 0 && <li className="text-sm text-slate-500">Not enough data yet.</li>}
            {data.insights.map((i, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <span className={TONE[i.tone]}>●</span>
                <span className="text-slate-300">{i.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 tabular-nums text-xl font-semibold text-white">{value}</p>
    </Card>
  );
}
