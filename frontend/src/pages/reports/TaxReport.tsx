import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { toCsv, downloadCsv } from "../../lib/csv";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

interface TaxData {
  outputTax: string;
  inputTax: string;
  netPayable: string;
}

export function TaxReport() {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const url = `/reports/tax-summary${qs.toString() ? `?${qs}` : ""}`;
  const { data, loading, error } = useFetch<TaxData>(url);

  const net = data ? Number(data.netPayable) : 0;

  function exportCsv() {
    if (!data) return;
    const csv = toCsv(
      ["", t("fields.amount")],
      [
        [t("reports.outputTax"), data.outputTax],
        [t("reports.inputTax"), data.inputTax],
        [t("reports.netPayable"), data.netPayable],
      ],
    );
    downloadCsv("tax-summary", csv);
  }

  return (
    <div>
      <PageHeader
        title={t("nav.taxReport")}
        subtitle={t("reports.taxSubtitle")}
        action={data && <Button variant="ghost" onClick={exportCsv}>{t("common.exportCsv")}</Button>}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44"><TextField label={t("fields.from")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="w-44"><TextField label={t("fields.to")} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="btn-ghost text-xs">{t("fields.clear")}</button>
          )}
        </div>
      </Card>

      {loading && <Spinner label={t("reports.building")} />}
      {error && !loading && <ErrorNote message={error} />}

      {!loading && !error && data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t("reports.outputTax")} value={money(data.outputTax)} hint={t("reports.outputHint")} />
          <StatCard label={t("reports.inputTax")} value={money(data.inputTax)} hint={t("reports.inputHint")} />
          <StatCard
            label={t("reports.netPayable")}
            value={money(data.netPayable)}
            hint={net >= 0 ? t("reports.netHintOwed") : t("reports.netHintRefund")}
            strong
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, strong }: { label: string; value: string; hint: string; strong?: boolean }) {
  return (
    <Card className={strong ? "border border-aurora-mint/30" : ""}>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 tabular-nums text-2xl font-semibold ${strong ? "text-aurora-mint" : "text-white"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Card>
  );
}
