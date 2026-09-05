import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorNote } from "../Dashboard";
import { PrintableDocument } from "../print/PrintableDocument";
import type { DocumentLine } from "../../lib/types";

interface EstimateDetail {
  number: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  customer: { name: string; email: string | null; phone: string | null; address: string | null };
  lines: DocumentLine[];
}

export function EstimatePrint() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = useFetch<{ estimate: EstimateDetail }>(`/estimates/${id}`);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const est = data.estimate;
  return (
    <PrintableDocument
      kind="ESTIMATE"
      orgName={user?.organization?.name ?? t("print.yourCompany")}
      orgAddress={user?.organization?.address}
      orgPhone={user?.organization?.phone}
      orgEmail={user?.organization?.email}
      logoDataUrl={user?.organization?.logoDataUrl}
      number={est.number}
      status={est.status}
      issueDate={est.issueDate}
      dueDate={est.expiryDate}
      party={est.customer}
      lines={est.lines}
      subtotal={est.subtotal}
      taxTotal={est.taxTotal}
      total={est.total}
      notes={est.notes}
      onBack={() => navigate(`/estimates/${id}`)}
    />
  );
}
