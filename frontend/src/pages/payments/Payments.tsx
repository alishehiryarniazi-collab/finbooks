import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { money, shortDate } from "../../lib/format";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { DataTable } from "../../components/ui/DataTable";
import { ErrorNote } from "../Dashboard";

interface Payment {
  id: string;
  type: "RECEIVED" | "MADE";
  date: string;
  amount: string;
  method: string | null;
  reference: string | null;
  bankAccount: { code: string; name: string };
  allocations: { invoice?: { number: string } | null; bill?: { number: string } | null; amount: string }[];
}

export function Payments() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<{ payments: Payment[] }>("/payments");
  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  const payments = data?.payments ?? [];

  const docFor = (p: Payment) =>
    p.allocations
      .map((a) => a.invoice?.number ?? a.bill?.number)
      .filter(Boolean)
      .join(", ") || "—";

  return (
    <div>
      <PageHeader title={t("nav.payments")} subtitle={t("pages.paymentsSubtitle")} />
      <Card>
        <DataTable
          rows={payments}
          keyOf={(r) => r.id}
          empty={t("pages.noPayments")}
          columns={[
            { header: t("fields.date"), cell: (r) => shortDate(r.date) },
            {
              header: t("fields.type"),
              cell: (r) => (
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    r.type === "RECEIVED"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-sky-500/30 bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {r.type === "RECEIVED" ? t("pages.received") : t("pages.made")}
                </span>
              ),
            },
            { header: t("fields.document"), cell: (r) => docFor(r) },
            { header: t("fields.account"), cell: (r) => `${r.bankAccount.code} · ${r.bankAccount.name}` },
            { header: t("fields.amount"), align: "right", cell: (r) => money(r.amount) },
          ]}
        />
      </Card>
    </div>
  );
}
