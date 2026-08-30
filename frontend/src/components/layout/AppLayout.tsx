import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { CompanySwitcher } from "./CompanySwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

// Shell around every authenticated page: fixed sidebar + top bar + routed content.
export function AppLayout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Animated aurora background blobs */}
      <div className="aurora-bg-blobs">
        <span />
        <span />
        <span />
      </div>

      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-white/10 bg-aurora-bg2/70 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 border-e border-white/10 bg-aurora-bg2">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-aurora-bg/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="btn-ghost lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
            ☰
          </button>
          <CompanySwitcher />
          <div className="ms-auto flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-end">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button onClick={() => setConfirmingLogout(true)} className="btn-ghost text-sm">
              {t("common.logout")}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Ask before logging out so an accidental click doesn't drop the session. */}
      {confirmingLogout && (
        <Modal
          open
          onClose={() => setConfirmingLogout(false)}
          icon="🚪"
          title={t("common.logoutTitle")}
          subtitle={t("common.logoutConfirm")}
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmingLogout(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={logout}>{t("common.logout")}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
