import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { Spinner } from "../ui/Spinner";

// Guards authenticated routes: wait for the session check, then redirect to login if absent.
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <Spinner label={t("common.loading")} />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
