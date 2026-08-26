import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { inputDate, money, shortDate } from "../../lib/format";
import type { Account, Invoice } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

export function InvoiceView() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { data, loading, error, refetch } = useFetch<{ invoice: Invoice }>(`/invoices/${id}`);
  const accountsReq = useFetch<{ accounts: Account[] }>("/accounts");
  const [payOpen, setPayOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const inv = data.invoice;
  const outstanding = Number(inv.total) - Number(inv.amountPaid);
  const canEdit = hasRole("ADMIN", "ACCOUNTANT");

  async function action(path: string) {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/invoices/${id}/${path}`);
      refetch();
    } catch (err) {
      setActionError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t("view.deleteInvoiceConfirm"))) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.delete(`/invoices/${id}`);
      navigate("/invoices");
    } catch (err) {
      setActionError(apiError(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("view.invoiceTitle", { number: inv.number })}
        subtitle={inv.customer?.name}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/invoices")}>
              ← {t("view.back")}
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/invoices/${id}/print`)}>
              🖨 {t("actions.printPdf")}
            </Button>
            {canEdit && inv.status === "DRAFT" && (
              <Button variant="ghost" onClick={() => navigate(`/invoices/${id}/edit`)}>
                {t("common.edit")}
              </Button>
            )}
            {canEdit && inv.status === "DRAFT" && (
              <Button variant="ghost" onClick={del} disabled={busy}>
                {t("common.delete")}
              </Button>
            )}
            {canEdit && inv.status === "DRAFT" && (
              <Button onClick={() => action("post")} disabled={busy}>
                {t("actions.postToLedger")}
              </Button>
            )}
            {canEdit && (inv.status === "SENT" || inv.status === "PARTIAL") && outstanding > 0 && (
              <Button onClick={() => setPayOpen(true)}>{t("actions.recordPayment")}</Button>
            )}
            {canEdit && inv.status !== "VOID" && inv.status !== "PAID" && Number(inv.amountPaid) === 0 && (
              <Button variant="ghost" onClick={() => action("void")} disabled={busy}>
                {t("actions.void")}
              </Button>
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
            <StatusBadge status={inv.status} />
            <span className="text-sm text-slate-400">{t("view.due", { date: shortDate(inv.dueDate) })}</span>
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
                {inv.lines?.map((l) => (
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
            <SummaryRow label={t("fields.subtotal")} value={money(inv.subtotal)} />
            <SummaryRow label={t("fields.tax")} value={money(inv.taxTotal)} />
            <div className="border-t border-white/10 pt-2">
              <SummaryRow label={t("fields.total")} value={money(inv.total)} strong />
            </div>
            <SummaryRow label={t("fields.paid")} value={money(inv.amountPaid)} />
            <SummaryRow label={t("fields.outstanding")} value={money(outstanding)} strong />
          </div>
        </Card>
      </div>

      {payOpen && (
        <PaymentModal
          invoiceId={inv.id}
          outstanding={outstanding}
          bankAccounts={(accountsReq.data?.accounts ?? []).filter((a) => a.type === "ASSET" && a.isPostable)}
          onClose={() => setPayOpen(false)}
          onSaved={() => {
            setPayOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold text-white" : "text-slate-400"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function PaymentModal({
  invoiceId,
  outstanding,
  bankAccounts,
  onClose,
  onSaved,
}: {
  invoiceId: string;
  outstanding: number;
  bankAccounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  const [date, setDate] = useState(inputDate());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/invoices/${invoiceId}/payments`, { amount: Number(amount), bankAccountId, date });
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("actions.recordPayment")} icon="💳">
      <form onSubmit={save} className="flex flex-col gap-4">
        <SelectField
          label={t("view.depositTo")}
          value={bankAccountId}
          onChange={(e) => setBankAccountId(e.target.value)}
          required
        >
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t("fields.amount")}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <TextField
            label={t("fields.date")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("actions.saving") : t("view.savePayment")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
