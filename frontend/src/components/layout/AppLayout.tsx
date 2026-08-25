import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";

// Shell around every authenticated page: fixed sidebar + top bar + routed content.
export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Animated aurora background blobs */}
      <div className="aurora-bg-blobs">
        <span />
        <span />
        <span />
      </div>

      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-aurora-bg2/70 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-aurora-bg2">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-aurora-bg/70 px-4 py-3 backdrop-blur-xl sm:px-6">
          <button className="btn-ghost lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
            ☰
          </button>
          <div className="hidden text-sm text-slate-400 sm:block">{user?.organization?.name}</div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button onClick={logout} className="btn-ghost text-sm">
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
