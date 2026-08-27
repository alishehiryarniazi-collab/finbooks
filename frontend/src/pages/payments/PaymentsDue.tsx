import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useFetch } from "../../hooks/useFetch";
import { money, shortDate } from "../../lib/format";
import type { Bill } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState } from "../../components/ui/EntityCard";
import { ErrorNote } from "../Dashboard";

const METHOD_KEY: Record<string, string> = {
  BANK: "party.bank",
  JAZZCASH: "party.jazzcash",
  EASYPAISA: "party.easypaisa",
  CASH: "party.cash",
  CHEQUE: "party.cheque",
};

const DAY = 86_400_000;

interface DueBill {
  bill: Bill;
  outstanding: number;
  diff: number; // whole days until due (negative = overdue)
}

// Whole-day difference between the due date and today (both at local midnight).
function daysUntil(dueISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueISO);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / DAY);
}

// Coloured relative-time label for a due date.
function whenLabel(t: TFunction, diff: number): { text: string; cls: string } {
  if (diff < 0) return { text: t("due.daysOverdue", { n: Math.abs(diff) }), cls: "text-rose-300" };
  if (diff === 0) return { text: t("due.dueToday"), cls: "text-amber-300" };
  return { text: t("due.inDays", { n: diff }), cls: diff <= 7 ? "text-amber-300" : "text-slate-400" };
}

// One coloured group of due bills (overdue / this week / upcoming).
function DueSection({
  titleKey,
  dot,
  rows,
  t,
  onOpen,
}: {
  titleKey: string;
  dot: string;
  rows: DueBill[];
  t: TFunction;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  const subtotal = rows.reduce((s, d) => s + d.outstanding, 0);
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {t(titleKey)}
          <span className="text-xs font-normal text-slate-500">({rows.length})</span>
        </span>
        <span className="tabular-nums text-sm text-slate-400">{money(subtotal)}</span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map(({ bill, outstanding, diff }) => {
          const when = whenLabel(t, diff);
          const method = bill.vendor?.paymentMethod;
          return (
            <button
              key={bill.id}
              onClick={() => onOpen(bill.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{bill.vendor?.name ?? "—"}</p>
                <p className="text-xs text-slate-500">
                  {bill.number} · {shortDate(bill.dueDate)}
                </p>
              </div>
              {method && (
                <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300 sm:inline">
                  {t(METHOD_KEY[method] ?? method)}
                </span>
              )}
              <span className={`shrink-0 text-xs font-medium ${when.cls}`}>{when.text}</span>
              <span className="w-24 shrink-0 text-right tabular-nums text-sm font-semibold text-white">
                {money(outstanding)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PaymentsDue() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading, error } = useFetch<{ bills: Bill[] }>("/bills");

  const groups = useMemo(() => {
    const payable: DueBill[] = (data?.bills ?? [])
      .filter((b) => (b.status === "OPEN" || b.status === "PARTIAL") && Number(b.total) - Number(b.amountPaid) > 0.005)
      .map((b) => ({ bill: b, outstanding: Number(b.total) - Number(b.amountPaid), diff: daysUntil(b.dueDate) }))
      .sort((a, b) => a.diff - b.diff);

    return {
      overdue: payable.filter((d) => d.diff < 0),
      dueSoon: payable.filter((d) => d.diff >= 0 && d.diff <= 7),
      upcoming: payable.filter((d) => d.diff > 7),
      total: payable.reduce((s, d) => s + d.outstanding, 0),
    };
  }, [data]);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;

  const isEmpty = groups.overdue.length + groups.dueSoon.length + groups.upcoming.length === 0;
  const open = (id: string) => navigate(`/bills/${id}`);

  return (
    <div>
      <PageHeader
        title={t("nav.paymentsDue")}
        subtitle={t("due.subtitle")}
        action={
          !isEmpty && (
            <div className="text-right">
              <p className="text-xs text-slate-500">{t("due.totalDue")}</p>
              <p className="tabular-nums text-lg font-semibold text-aurora-mint">{money(groups.total)}</p>
            </div>
          )
        }
      />

      {isEmpty ? (
        <EmptyState icon="✅" message={t("due.nothingDue")} />
      ) : (
        <div className="flex flex-col gap-4">
          <DueSection titleKey="due.overdue" dot="bg-rose-400" rows={groups.overdue} t={t} onOpen={open} />
          <DueSection titleKey="due.dueSoon" dot="bg-amber-400" rows={groups.dueSoon} t={t} onOpen={open} />
          <DueSection titleKey="due.upcoming" dot="bg-slate-400" rows={groups.upcoming} t={t} onOpen={open} />
        </div>
      )}
    </div>
  );
}
