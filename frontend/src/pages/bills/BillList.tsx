import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import type { Bill } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { DataTable } from "../../components/ui/DataTable";
import { ListControls } from "../../components/ui/ListControls";
import { ErrorNote } from "../Dashboard";

const STATUSES = ["DRAFT", "OPEN", "PARTIAL", "PAID", "VOID"];

export function BillList() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<{ bills: Bill[] }>("/bills");
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  const all = data?.bills ?? [];
  const needle = q.trim().toLowerCase();
  const bills = all.filter(
    (b) =>
      (status === "ALL" || b.status === status) &&
      (needle === "" ||
        b.number.toLowerCase().includes(needle) ||
        (b.vendor?.name ?? "").toLowerCase().includes(needle)),
  );

  return (
    <div>
      <PageHeader
        title={t("nav.bills")}
        subtitle={t("pages.billsSubtitle")}
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <Link to="/bills/new">
              <Button>{t("pages.newBill")}</Button>
            </Link>
          )
        }
      />
      <ListControls
        query={q}
        onQuery={setQ}
        placeholder={t("pages.searchBillVendor")}
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
      />
      <Card>
        <DataTable
          rows={bills}
          keyOf={(r) => r.id}
          onRowClick={(r) => navigate(`/bills/${r.id}`)}
          empty={t("pages.noBills")}
          columns={[
            { header: t("fields.number"), cell: (r) => <span className="text-white">{r.number}</span> },
            { header: t("fields.vendor"), cell: (r) => r.vendor?.name ?? "—" },
            { header: t("fields.date"), cell: (r) => shortDate(r.billDate) },
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
