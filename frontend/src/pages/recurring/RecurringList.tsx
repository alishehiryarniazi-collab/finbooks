import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { shortDate } from "../../lib/format";
import { frequencyLabel } from "../../lib/recurring";
import type { RecurringInvoice } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { DataTable } from "../../components/ui/DataTable";
import { ListControls } from "../../components/ui/ListControls";
import { ErrorNote } from "../Dashboard";

export function RecurringList() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<{ recurring: RecurringInvoice[] }>("/recurring-invoices");
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  const all = data?.recurring ?? [];
  const needle = q.trim().toLowerCase();
  const rows = all.filter((r) => needle === "" || (r.customer?.name ?? "").toLowerCase().includes(needle));

  return (
    <div>
      <PageHeader
        title={t("nav.recurring")}
        subtitle={t("pages.recurringSubtitle")}
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <Link to="/recurring/new">
              <Button>{t("pages.newRecurring")}</Button>
            </Link>
          )
        }
      />
      <ListControls query={q} onQuery={setQ} placeholder={t("pages.searchRecurringCustomer")} />
      <Card>
        <DataTable
          rows={rows}
          keyOf={(r) => r.id}
          onRowClick={(r) => navigate(`/recurring/${r.id}`)}
          empty={t("pages.noRecurring")}
          columns={[
            {
              header: t("fields.customer"),
              cell: (r) => <span className="text-white">{r.customer?.name ?? "—"}</span>,
            },
            { header: t("recur.frequency"), cell: (r) => frequencyLabel(t, r.frequency, r.interval) },
            { header: t("recur.nextRun"), cell: (r) => shortDate(r.nextRunDate) },
            { header: t("recur.autoPost"), cell: (r) => (r.autoPost ? t("common.yes") : t("common.no")) },
            { header: t("fields.status"), cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
