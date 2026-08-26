import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import type { Invoice } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { DataTable } from "../../components/ui/DataTable";
import { ListControls } from "../../components/ui/ListControls";
import { ErrorNote } from "../Dashboard";

const STATUSES = ["DRAFT", "SENT", "PARTIAL", "PAID", "VOID"];

export function InvoiceList() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<{ invoices: Invoice[] }>("/invoices");
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  const all = data?.invoices ?? [];
  const needle = q.trim().toLowerCase();
  const invoices = all.filter(
    (i) =>
      (status === "ALL" || i.status === status) &&
      (needle === "" ||
        i.number.toLowerCase().includes(needle) ||
        (i.customer?.name ?? "").toLowerCase().includes(needle)),
  );

  return (
    <div>
      <PageHeader
        title={t("nav.invoices")}
        subtitle={t("pages.invoicesSubtitle")}
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <Link to="/invoices/new">
              <Button>{t("pages.newInvoice")}</Button>
            </Link>
          )
        }
      />
      <ListControls
        query={q}
        onQuery={setQ}
        placeholder={t("pages.searchInvoiceCustomer")}
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
      />
      <Card>
        <DataTable
          rows={invoices}
          keyOf={(r) => r.id}
          onRowClick={(r) => navigate(`/invoices/${r.id}`)}
          empty={t("pages.noInvoices")}
          columns={[
            { header: t("fields.number"), cell: (r) => <span className="text-white">{r.number}</span> },
            { header: t("fields.customer"), cell: (r) => r.customer?.name ?? "—" },
            { header: t("fields.issued"), cell: (r) => shortDate(r.issueDate) },
            { header: t("fields.due"), cell: (r) => shortDate(r.dueDate) },
            { header: t("fields.total"), align: "right", cell: (r) => money(r.total) },
            { header: t("fields.paid"), align: "right", cell: (r) => money(r.amountPaid) },
            { header: t("fields.status"), cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
