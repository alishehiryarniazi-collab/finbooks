import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

// nav.* i18n key per voucher type (labels come from the active language).
const VOUCHER_LABEL_KEY: Record<VoucherType, string> = {
  JOURNAL: "nav.journalVoucher",
  DEBIT: "nav.debitVoucher",
  CREDIT: "nav.creditVoucher",
};

const VOUCHER_STYLE: Record<VoucherType, string> = {
  JOURNAL: "bg-white/8 text-slate-300",
  DEBIT: "bg-rose-500/15 text-rose-300",
  CREDIT: "bg-emerald-500/15 text-emerald-300",
};

type Filter = "ALL" | VoucherType;
const FILTERS: Filter[] = ["ALL", "JOURNAL", "DEBIT", "CREDIT"];

export function JournalList() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<{ entries: JournalEntry[] }>("/journal");
  const { hasRole } = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;

  const all = data?.entries ?? [];
  const entries = filter === "ALL" ? all : all.filter((e) => e.voucherType === filter);
  const canWrite = hasRole("ADMIN", "ACCOUNTANT");

  return (
    <div>
      <PageHeader
        title={t("pages.vouchersTitle")}
        subtitle={t("pages.vouchersSubtitle")}
        action={
          canWrite && (
            <div className="flex flex-wrap gap-2">
              <Link to="/vouchers/credit/new">
                <Button variant="ghost">+ {t("nav.creditVoucher")}</Button>
              </Link>
              <Link to="/vouchers/debit/new">
                <Button variant="ghost">+ {t("nav.debitVoucher")}</Button>
              </Link>
              <Link to="/journal/new">
                <Button>+ {t("nav.journalVoucher")}</Button>
              </Link>
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
            {f === "ALL" ? t("common.all") : t(VOUCHER_LABEL_KEY[f])}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">{t("pages.noVouchers")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const total = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
            const vt = entry.voucherType;
            return (
              <Card key={entry.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-white">{entry.memo ?? t(VOUCHER_LABEL_KEY[vt])}</span>
                    {entry.reference && (
                      <span className="ml-2 text-xs text-slate-500">#{entry.reference}</span>
                    )}
                    <p className="text-xs text-slate-500">
                      {shortDate(entry.date)} · {entry.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${VOUCHER_STYLE[vt]}`}>
                      {t(VOUCHER_LABEL_KEY[vt])}
                    </span>
                    <span className="tabular-nums text-sm text-slate-300">{money(total)}</span>
                    <StatusBadge status={entry.status} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-1 font-medium">{t("fields.account")}</th>
                        <th className="py-1 text-right font-medium">{t("fields.debit")}</th>
                        <th className="py-1 text-right font-medium">{t("fields.credit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((l) => (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="py-1.5 text-slate-300">
                            <span className="text-xs text-slate-500">{l.account?.code}</span>{" "}
                            {l.account?.name}
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
