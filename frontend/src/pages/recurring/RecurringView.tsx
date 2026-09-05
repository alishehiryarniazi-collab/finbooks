import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import { frequencyLabel } from "../../lib/recurring";
import type { RecurringInvoice } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { ErrorNote } from "../Dashboard";

export function RecurringView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data, loading, error, refetch } = useFetch<{ recurring: RecurringInvoice }>(
    `/recurring-invoices/${id}`,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const r = data.recurring;
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");
  const total = (r.lines ?? []).reduce((s, l) => s + Number(l.lineTotal), 0);

  async function setStatus(status: "ACTIVE" | "PAUSED") {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/recurring-invoices/${id}/status`, { status });
      refetch();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setActionError(null);
    try {
      const { data: res } = await api.post<{ invoice: { id: string } }>(`/recurring-invoices/${id}/run`);
      navigate(`/invoices/${res.invoice.id}`);
    } catch (err) {
      setActionError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t("recur.deleteConfirm"))) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/recurring-invoices/${id}`);
      navigate("/recurring");
    } catch (err) {
      setActionError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={r.customer?.name ?? t("nav.recurring")}
        subtitle={frequencyLabel(t, r.frequency, r.interval)}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/recurring")}>
              ← {t("view.back")}
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                onClick={() => setStatus(r.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                disabled={busy}
              >
                {r.status === "ACTIVE" ? t("recur.pause") : t("recur.resume")}
              </Button>
            )}
            {canEdit && (
              <Button onClick={runNow} disabled={busy}>
                {t("recur.runNow")}
              </Button>
            )}
            {canEdit && (
              <>
                <Button variant="ghost" onClick={() => navigate(`/recurring/${id}/edit`)}>
                  {t("common.edit")}
                </Button>
                <Button variant="ghost" onClick={del} disabled={busy}>
                  {t("common.delete")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="mb-4">
          <ErrorNote message={actionError} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-slate-400">
                  <th className="px-2 py-2 font-medium">{t("fields.description")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("fields.qty")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("view.price")}</th>
                  <th className="px-2 py-2 text-right font-medium">{t("fields.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {r.lines?.map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="px-2 py-2">
                      <p className="text-white">{l.description}</p>
                      <p className="text-xs text-slate-500">
                        {l.incomeAccount?.code} · {l.incomeAccount?.name}
                      </p>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{Number(l.quantity)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(l.unitPrice)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{t("recur.schedule")}</h3>
            <StatusBadge status={r.status} />
          </div>
          <div className="space-y-2 text-sm">
            <Row label={t("recur.frequency")} value={frequencyLabel(t, r.frequency, r.interval)} />
            <Row label={t("recur.nextRun")} value={shortDate(r.nextRunDate)} />
            <Row label={t("recur.endDate")} value={r.endDate ? shortDate(r.endDate) : t("recur.noEnd")} />
            <Row label={t("recur.autoPost")} value={r.autoPost ? t("common.yes") : t("common.no")} />
            <Row label={t("recur.lastRun")} value={r.lastRunAt ? shortDate(r.lastRunAt) : "—"} />
            <div className="border-t border-white/10 pt-2">
              <Row label={t("fields.total")} value={money(total)} strong />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-white" : "text-slate-400"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
