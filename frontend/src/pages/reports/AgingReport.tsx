import { useTranslation } from "react-i18next";
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

const BUCKETS: { key: keyof AgingRow; labelKey: string }[] = [
  { key: "current", labelKey: "reports.agingCurrent" },
  { key: "d1_30", labelKey: "reports.aging1_30" },
  { key: "d31_60", labelKey: "reports.aging31_60" },
  { key: "d61_90", labelKey: "reports.aging61_90" },
  { key: "d90_plus", labelKey: "reports.aging90" },
];

// Shared aging table for AR (by customer) and AP (by vendor).
export function AgingReport({ endpoint, party }: { endpoint: string; party: "customer" | "vendor" }) {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<Aging>(endpoint);
  if (loading) return <Spinner label={t("reports.building")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const title = t(party === "customer" ? "nav.arAging" : "nav.apAging");
  const subtitle = t(party === "customer" ? "reports.arAgingSubtitle" : "reports.apAgingSubtitle");
  const partyHeader = t(party === "customer" ? "reports.customer" : "reports.vendor");

  function exportCsv() {
    const d = data!;
    const csv = toCsv(
      [partyHeader, ...BUCKETS.map((b) => t(b.labelKey)), t("fields.total")],
      [
        ...d.rows.map((r) => [r[party], ...BUCKETS.map((b) => r[b.key]), r.total]),
        [t("fields.totals"), ...BUCKETS.map((b) => d.totals[b.key]), d.totals.total],
      ],
    );
    downloadCsv(party === "customer" ? "ar-aging" : "ap-aging", csv);
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          data.rows.length > 0 && (
            <Button variant="ghost" onClick={exportCsv}>
              {t("common.exportCsv")}
            </Button>
          )
        }
      />
      <Card>
        {data.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t("reports.nothingOutstanding")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-3 py-2 font-medium">{partyHeader}</th>
                  {BUCKETS.map((b) => (
                    <th key={b.key} className="px-3 py-2 text-right font-medium">
                      {t(b.labelKey)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">{t("fields.total")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{r[party]}</td>
                    {BUCKETS.map((b) => (
                      <td key={b.key} className="px-3 py-2 text-right tabular-nums text-slate-300">
                        {Number(r[b.key]) ? money(r[b.key]) : ""}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-white">
                      {money(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold text-white">
                  <td className="px-3 py-2">{t("fields.totals")}</td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className="px-3 py-2 text-right tabular-nums">
                      {money(data.totals[b.key])}
                    </td>
                  ))}
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
