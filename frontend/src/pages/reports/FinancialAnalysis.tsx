import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
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
  insights: { key: string; params?: Record<string, string>; tone: "good" | "warn" | "info" }[];
}

const TONE = { good: "text-emerald-300", warn: "text-amber-300", info: "text-sky-300" };

// Ratio metadata: dataKey (from the API), labelKey (analysis.*), and how to format the value.
const RATIO_GROUPS = [
  {
    titleKey: "analysis.liquidity",
    items: [
      { key: "currentRatio", labelKey: "analysis.currentRatio", fmt: "x" },
      { key: "quickRatio", labelKey: "analysis.quickRatio", fmt: "x" },
    ],
  },
  {
    titleKey: "analysis.profitability",
    items: [
      { key: "grossMarginPct", labelKey: "analysis.grossMargin", fmt: "pct" },
      { key: "netMarginPct", labelKey: "analysis.netMargin", fmt: "pct" },
      { key: "returnOnEquityPct", labelKey: "analysis.returnOnEquity", fmt: "pct" },
    ],
  },
  {
    titleKey: "analysis.leverageEfficiency",
    items: [
      { key: "debtToEquity", labelKey: "analysis.debtToEquity", fmt: "x" },
      { key: "arDays", labelKey: "analysis.receivableDays", fmt: "days" },
      { key: "apDays", labelKey: "analysis.payableDays", fmt: "days" },
    ],
  },
] as const;

export function FinancialAnalysis() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<Analysis>("/reports/analysis");
  if (loading) return <Spinner label={t("analysis.analysing")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const fmt = (v: number | null, type: string) =>
    v === null ? "—" : type === "pct" ? `${v.toFixed(1)}%` : type === "days" ? `${Math.round(v)} ${t("analysis.days")}` : `${v.toFixed(2)}×`;

  const chartData = data.trend.map((tr) => ({ month: tr.month.slice(5), Net: Number(tr.net) }));

  function exportCsv() {
    const d = data!;
    const rows: (string | number)[][] = [
      [t("analysis.revenue"), d.kpis.revenue],
      [t("analysis.netProfit"), d.kpis.netProfit],
      [t("analysis.cash"), d.kpis.cash],
      [t("analysis.equity"), d.kpis.equity],
      [t("analysis.healthScore"), `${d.healthScore}/100`],
    ];
    for (const g of RATIO_GROUPS) for (const it of g.items) rows.push([t(it.labelKey), fmt(d.ratios[it.key] ?? null, it.fmt)]);
    downloadCsv("financial-analysis", toCsv([t("fields.type"), t("fields.amount")], rows));
  }

  return (
    <div>
      <PageHeader
        title={t("nav.financialAnalysis")}
        subtitle={t("analysis.subtitle")}
        action={<Button variant="ghost" onClick={exportCsv}>{t("common.exportCsv")}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border border-aurora-mint/30">
          <p className="text-xs uppercase tracking-wider text-slate-500">{t("analysis.healthScore")}</p>
          <p className="mt-1 text-3xl font-bold text-aurora-mint">{data.healthScore}<span className="text-lg text-slate-500">/100</span></p>
        </Card>
        <Kpi label={t("analysis.revenue")} value={money(data.kpis.revenue)} />
        <Kpi label={t("analysis.netProfit")} value={money(data.kpis.netProfit)} />
        <Kpi label={t("analysis.cash")} value={money(data.kpis.cash)} />
        <Kpi label={t("analysis.equity")} value={money(data.kpis.equity)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {RATIO_GROUPS.map((g) => (
          <Card key={g.titleKey}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{t(g.titleKey)}</h3>
            <div className="flex flex-col divide-y divide-white/5">
              {g.items.map((it) => (
                <div key={it.key} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-300">{t(it.labelKey)}</span>
                  <span className="tabular-nums font-medium text-white">{fmt(data.ratios[it.key] ?? null, it.fmt)}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-white">{t("analysis.netTrend")}</h3>
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
                <Bar dataKey="Net" name={t("reports.net")} fill="#5ff0d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-white">{t("analysis.insights")}</h3>
          <ul className="flex flex-col gap-3">
            {data.insights.length === 0 && <li className="text-sm text-slate-500">{t("analysis.notEnough")}</li>}
            {data.insights.map((i, idx) => (
              <li key={idx} className="flex gap-2 text-sm">
                <span className={TONE[i.tone]}>●</span>
                <span className="text-slate-300">{t(i.key, i.params)}</span>
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
