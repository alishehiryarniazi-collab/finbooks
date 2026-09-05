import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import type { Estimate } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { DataTable } from "../../components/ui/DataTable";
import { ListControls } from "../../components/ui/ListControls";
import { ErrorNote } from "../Dashboard";

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED", "CONVERTED"];

export function EstimateList() {
  const { t } = useTranslation();
  const { data, loading, error } = useFetch<{ estimates: Estimate[] }>("/estimates");
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  const all = data?.estimates ?? [];
  const needle = q.trim().toLowerCase();
  const estimates = all.filter(
    (e) =>
      (status === "ALL" || e.status === status) &&
      (needle === "" ||
        e.number.toLowerCase().includes(needle) ||
        (e.customer?.name ?? "").toLowerCase().includes(needle)),
  );

  return (
    <div>
      <PageHeader
        title={t("nav.estimates")}
        subtitle={t("pages.estimatesSubtitle")}
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <Link to="/estimates/new">
              <Button>{t("pages.newEstimate")}</Button>
            </Link>
          )
        }
      />
      <ListControls
        query={q}
        onQuery={setQ}
        placeholder={t("pages.searchEstimateCustomer")}
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
      />
      <Card>
        <DataTable
          rows={estimates}
          keyOf={(r) => r.id}
          onRowClick={(r) => navigate(`/estimates/${r.id}`)}
          empty={t("pages.noEstimates")}
          columns={[
            { header: t("fields.number"), cell: (r) => <span className="text-white">{r.number}</span> },
            { header: t("fields.customer"), cell: (r) => r.customer?.name ?? "—" },
            { header: t("fields.issued"), cell: (r) => shortDate(r.issueDate) },
            { header: t("fields.expiry"), cell: (r) => shortDate(r.expiryDate) },
            { header: t("fields.total"), align: "right", cell: (r) => money(r.total) },
            { header: t("fields.status"), cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
