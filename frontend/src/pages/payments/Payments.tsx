import { useFetch } from "../../hooks/useFetch";
import { money, shortDate } from "../../lib/format";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { DataTable } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/Badge";
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
  const { data, loading, error } = useFetch<{ payments: Payment[] }>("/payments");
  if (loading) return <Spinner label="Loading payments…" />;
  if (error) return <ErrorNote message={error} />;
  const payments = data?.payments ?? [];

  const docFor = (p: Payment) =>
    p.allocations.map((a) => a.invoice?.number ?? a.bill?.number).filter(Boolean).join(", ") || "—";

  return (
    <div>
      <PageHeader title="Payments" subtitle="Money received and paid out" />
      <Card>
        <DataTable
          rows={payments}
          keyOf={(r) => r.id}
          empty="No payments yet."
          columns={[
            { header: "Date", cell: (r) => shortDate(r.date) },
            { header: "Type", cell: (r) => <StatusBadge status={r.type === "RECEIVED" ? "PAID" : "PARTIAL"} /> },
            { header: "Document", cell: (r) => docFor(r) },
            { header: "Account", cell: (r) => `${r.bankAccount.code} · ${r.bankAccount.name}` },
            { header: "Amount", align: "right", cell: (r) => money(r.amount) },
          ]}
        />
      </Card>
    </div>
  );
}
