import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import type { Estimate } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { ErrorNote } from "../Dashboard";

export function EstimateView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data, loading, error, refetch } = useFetch<{ estimate: Estimate }>(`/estimates/${id}`);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const est = data.estimate;
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");
  const isConverted = est.status === "CONVERTED";

  async function setStatus(status: "SENT" | "ACCEPTED" | "DECLINED") {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/estimates/${id}/status`, { status });
      refetch();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    setBusy(true);
    setActionError(null);
    try {
      const { data: res } = await api.post<{ invoice: { id: string } }>(`/estimates/${id}/convert`);
      navigate(`/invoices/${res.invoice.id}`);
    } catch (err) {
      setActionError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t("est.deleteConfirm"))) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/estimates/${id}`);
      navigate("/estimates");
    } catch (err) {
      setActionError(apiError(err));
      setBusy(false);
    }
  }

  const canConvert = canEdit && (est.status === "SENT" || est.status === "ACCEPTED");

  return (
    <div>
      <PageHeader
        title={t("view.estimateTitle", { number: est.number })}
        subtitle={est.customer?.name}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/estimates")}>
              ← {t("view.back")}
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/estimates/${id}/print`)}>
              🖨 {t("actions.printPdf")}
            </Button>
            {canEdit && !isConverted && est.status === "DRAFT" && (
              <Button variant="ghost" onClick={() => setStatus("SENT")} disabled={busy}>
                {t("est.markSent")}
              </Button>
            )}
            {canEdit && est.status === "SENT" && (
              <>
                <Button variant="ghost" onClick={() => setStatus("ACCEPTED")} disabled={busy}>
                  {t("est.accept")}
                </Button>
                <Button variant="ghost" onClick={() => setStatus("DECLINED")} disabled={busy}>
                  {t("est.decline")}
                </Button>
              </>
            )}
            {canConvert && (
              <Button onClick={convert} disabled={busy}>
                {t("est.convert")}
              </Button>
            )}
            {isConverted && est.convertedInvoiceId && (
              <Button onClick={() => navigate(`/invoices/${est.convertedInvoiceId}`)}>
                {t("est.viewInvoice")}
              </Button>
            )}
            {canEdit && !isConverted && est.status === "DRAFT" && (
              <>
                <Button variant="ghost" onClick={() => navigate(`/estimates/${id}/edit`)}>
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
          <div className="mb-4 flex items-center justify-between">
            <StatusBadge status={est.status} />
            <span className="text-sm text-slate-400">
              {t("est.expires", { date: shortDate(est.expiryDate) })}
            </span>
          </div>
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
                {est.lines?.map((l) => (
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
          <h3 className="mb-3 text-lg font-semibold text-white">{t("view.summary")}</h3>
          <div className="space-y-2 text-sm">
            <Row label={t("fields.subtotal")} value={money(est.subtotal)} />
            <Row label={t("fields.tax")} value={money(est.taxTotal)} />
            <div className="border-t border-white/10 pt-2">
              <Row label={t("fields.total")} value={money(est.total)} strong />
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
