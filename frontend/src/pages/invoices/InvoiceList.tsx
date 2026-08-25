import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const { data, loading, error } = useFetch<{ invoices: Invoice[] }>("/invoices");
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  if (loading) return <Spinner label="Loading invoices…" />;
  if (error) return <ErrorNote message={error} />;
  const all = data?.invoices ?? [];
  const needle = q.trim().toLowerCase();
  const invoices = all.filter(
    (i) =>
      (status === "ALL" || i.status === status) &&
      (needle === "" || i.number.toLowerCase().includes(needle) || (i.customer?.name ?? "").toLowerCase().includes(needle)),
  );

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Money your customers owe you"
        action={hasRole("ADMIN", "ACCOUNTANT") && <Link to="/invoices/new"><Button>+ New invoice</Button></Link>}
      />
      <ListControls
        query={q}
        onQuery={setQ}
        placeholder="Search number or customer…"
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
      />
      <Card>
        <DataTable
          rows={invoices}
          keyOf={(r) => r.id}
          onRowClick={(r) => navigate(`/invoices/${r.id}`)}
          empty="No invoices yet."
          columns={[
            { header: "Number", cell: (r) => <span className="text-white">{r.number}</span> },
            { header: "Customer", cell: (r) => r.customer?.name ?? "—" },
            { header: "Issued", cell: (r) => shortDate(r.issueDate) },
            { header: "Due", cell: (r) => shortDate(r.dueDate) },
            { header: "Total", align: "right", cell: (r) => money(r.total) },
            { header: "Paid", align: "right", cell: (r) => money(r.amountPaid) },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
