import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { ErrorNote } from "../Dashboard";

interface BS {
  assets: { code: string; name: string; amount: string }[];
  liabilities: { code: string; name: string; amount: string }[];
  equity: { code: string; name: string; amount: string }[];
  currentEarnings: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  balanced: boolean;
}

export function BalanceSheet() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<BS>("/reports/balance-sheet");
  if (loading) return <Spinner label={t("reports.building")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  function exportCsv() {
    const d = data!;
    const csv = toCsv(
      [t("fields.type"), t("fields.code"), t("fields.account"), t("fields.amount")],
      [
        ...d.assets.map((r) => [t("reports.assets"), r.code, r.name, r.amount]),
        ["", "", `${t("reports.totalPrefix")} ${t("reports.assets")}`, d.totalAssets],
        ...d.liabilities.map((r) => [t("reports.liabilities"), r.code, r.name, r.amount]),
        ["", "", `${t("reports.totalPrefix")} ${t("reports.liabilities")}`, d.totalLiabilities],
        ...d.equity.map((r) => [t("reports.equity"), r.code, r.name, r.amount]),
        [t("reports.equity"), "", t("reports.currentYearEarnings"), d.currentEarnings],
        ["", "", `${t("reports.totalPrefix")} ${t("reports.equity")}`, d.totalEquity],
      ],
    );
    downloadCsv("balance-sheet", csv);
  }

  return (
    <div>
      <PageHeader
        title={t("nav.balanceSheet")}
        subtitle={t("reports.bsSubtitle")}
        action={
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-sm ${data.balanced ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"}`}
            >
              {data.balanced ? `✓ ${t("reports.assetsEq")}` : `✗ ${t("reports.outOfBalance")}`}
            </span>
            <Button variant="ghost" onClick={exportCsv}>
              {t("common.exportCsv")}
            </Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("reports.assets")} rows={data.assets} total={data.totalAssets} />
        <div className="flex flex-col gap-6">
          <Section title={t("reports.liabilities")} rows={data.liabilities} total={data.totalLiabilities} />
          <Section
            title={t("reports.equity")}
            rows={[...data.equity, { code: "", name: t("reports.currentYearEarnings"), amount: data.currentEarnings }]}
            total={data.totalEquity}
          />
        </div>
      </div>
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
        {rows.map((r, i) => (
          <div key={r.code || i} className="flex justify-between py-2 text-sm">
            <span className="text-slate-300">
              {r.code && <span className="text-xs text-slate-500">{r.code} </span>}
              {r.name}
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
