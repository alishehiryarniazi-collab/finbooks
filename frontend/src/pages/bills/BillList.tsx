import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const { data, loading, error } = useFetch<{ bills: Bill[] }>("/bills");
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  if (loading) return <Spinner label="Loading bills…" />;
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
        title="Bills"
        subtitle="Money you owe your vendors"
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <Link to="/bills/new">
              <Button>+ New bill</Button>
            </Link>
          )
        }
      />
      <ListControls
        query={q}
        onQuery={setQ}
        placeholder="Search number or vendor…"
        statuses={STATUSES}
        status={status}
        onStatus={setStatus}
      />
      <Card>
        <DataTable
          rows={bills}
          keyOf={(r) => r.id}
          onRowClick={(r) => navigate(`/bills/${r.id}`)}
          empty="No bills yet."
          columns={[
            { header: "Number", cell: (r) => <span className="text-white">{r.number}</span> },
            { header: "Vendor", cell: (r) => r.vendor?.name ?? "—" },
            { header: "Date", cell: (r) => shortDate(r.billDate) },
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
