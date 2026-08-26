import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorNote } from "../Dashboard";
import { PrintableDocument } from "../print/PrintableDocument";
import type { DocumentLine } from "../../lib/types";

// Full customer comes back from GET /invoices/:id (not just the name in the list view).
interface InvoiceDetail {
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  customer: { name: string; email: string | null; phone: string | null; address: string | null };
  lines: DocumentLine[];
}

export function InvoicePrint() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useFetch<{ invoice: InvoiceDetail }>(`/invoices/${id}`);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const inv = data.invoice;
  return (
    <PrintableDocument
      kind="INVOICE"
      orgName={user?.organization?.name ?? t("print.yourCompany")}
      orgAddress={user?.organization?.address}
      orgPhone={user?.organization?.phone}
      orgEmail={user?.organization?.email}
      logoDataUrl={user?.organization?.logoDataUrl}
      number={inv.number}
      status={inv.status}
      issueDate={inv.issueDate}
      dueDate={inv.dueDate}
      party={inv.customer}
      lines={inv.lines}
      subtotal={inv.subtotal}
      taxTotal={inv.taxTotal}
      total={inv.total}
      amountPaid={inv.amountPaid}
      notes={inv.notes}
      onBack={() => navigate(`/invoices/${id}`)}
    />
  );
}
