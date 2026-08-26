import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../Dashboard";

interface PL {
  income: { code: string; name: string; amount: string }[];
  expenses: { code: string; name: string; amount: string }[];
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
}

export function ProfitLoss() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<PL>("/reports/profit-loss");
  if (loading) return <Spinner label={t("reports.building")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const profit = Number(data.netProfit) >= 0;

  function exportCsv() {
    const d = data!;
    const csv = toCsv(
      [t("fields.code"), t("fields.account"), t("fields.amount")],
      [
        ["", t("reports.income"), ""],
        ...d.income.map((r) => [r.code, r.name, r.amount]),
        ["", `${t("reports.totalPrefix")} ${t("reports.income")}`, d.totalIncome],
        ["", t("reports.expenses"), ""],
        ...d.expenses.map((r) => [r.code, r.name, r.amount]),
        ["", `${t("reports.totalPrefix")} ${t("reports.expenses")}`, d.totalExpense],
        ["", t("reports.netProfit"), d.netProfit],
      ],
    );
    downloadCsv("profit-and-loss", csv);
  }

  return (
    <div>
      <PageHeader
        title={t("nav.profitLoss")}
        subtitle={t("reports.plSubtitle")}
        action={
          <Button variant="ghost" onClick={exportCsv}>
            {t("common.exportCsv")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("reports.income")} rows={data.income} total={data.totalIncome} />
        <Section title={t("reports.expenses")} rows={data.expenses} total={data.totalExpense} />
      </div>
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-white">{profit ? t("reports.netProfit") : t("reports.netLoss")}</span>
          <span
            className={`text-2xl font-semibold tabular-nums ${profit ? "text-emerald-300" : "text-rose-300"}`}
          >
            {money(data.netProfit)}
          </span>
        </div>
      </Card>
    </div>
  );
}

function Section({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { code: string; name: string; amount: string }[];
  total: string;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      <div className="flex flex-col divide-y divide-white/5">
        {rows.length === 0 && <p className="py-4 text-sm text-slate-500">{t("reports.nothingRecorded")}</p>}
        {rows.map((r) => (
          <div key={r.code} className="flex justify-between py-2 text-sm">
            <span className="text-slate-300">
              <span className="text-xs text-slate-500">{r.code}</span> {r.name}
            </span>
            <span className="tabular-nums text-slate-300">{money(r.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-semibold text-white">
        <span>{t("reports.totalPrefix")} {title}</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>
    </Card>
  );
}
