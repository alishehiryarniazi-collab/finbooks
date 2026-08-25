import { useNavigate, useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorNote } from "../Dashboard";
import { PrintableDocument } from "../print/PrintableDocument";
import type { DocumentLine } from "../../lib/types";

// Full vendor comes back from GET /bills/:id.
interface BillDetail {
  number: string;
  status: string;
  billDate: string;
  dueDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  vendor: { name: string; email: string | null; phone: string | null; address: string | null };
  lines: DocumentLine[];
}

export function BillPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useFetch<{ bill: BillDetail }>(`/bills/${id}`);

  if (loading) return <Spinner label="Preparing bill…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const bill = data.bill;
  return (
    <PrintableDocument
      kind="BILL"
      orgName={user?.organization?.name ?? "Your Company"}
      number={bill.number}
      status={bill.status}
      issueLabel="Bill date"
      issueDate={bill.billDate}
      dueDate={bill.dueDate}
      partyHeading="Bill from"
      party={bill.vendor}
      lines={bill.lines}
      subtotal={bill.subtotal}
      taxTotal={bill.taxTotal}
      total={bill.total}
      amountPaid={bill.amountPaid}
      notes={bill.notes}
      onBack={() => navigate(`/bills/${id}`)}
    />
  );
}
