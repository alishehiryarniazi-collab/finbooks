import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";

// Navigation grouped into sections. Labels are i18n keys under "nav.*".
const NAV = [
  {
    sectionKey: "overview",
    items: [{ to: "/", labelKey: "dashboard", icon: "📊", end: true }],
  },
  {
    sectionKey: "bookkeeping",
    items: [
      { to: "/accounts", labelKey: "chartOfAccounts", icon: "📚" },
      { to: "/ledger", labelKey: "generalLedger", icon: "📓" },
    ],
  },
  {
    sectionKey: "vouchers",
    items: [
      { to: "/journal", labelKey: "allVouchers", icon: "📗" },
      { to: "/vouchers/credit/new", labelKey: "creditVoucher", icon: "🟢" },
      { to: "/vouchers/debit/new", labelKey: "debitVoucher", icon: "🔴" },
      { to: "/journal/new", labelKey: "journalVoucher", icon: "📝" },
    ],
  },
  {
    sectionKey: "salesAr",
    items: [
      { to: "/customers", labelKey: "customers", icon: "🧑‍💼" },
      { to: "/estimates", labelKey: "estimates", icon: "📄" },
      { to: "/invoices", labelKey: "invoices", icon: "🧾" },
      { to: "/recurring", labelKey: "recurring", icon: "🔁" },
    ],
  },
  {
    sectionKey: "purchasesAp",
    items: [
      { to: "/vendors", labelKey: "vendors", icon: "🏭" },
      { to: "/bills", labelKey: "bills", icon: "📄" },
    ],
  },
  {
    sectionKey: "money",
    items: [
      { to: "/payments-due", labelKey: "paymentsDue", icon: "📅" },
      { to: "/payments", labelKey: "payments", icon: "💸" },
    ],
  },
  {
    sectionKey: "costAccounting",
    items: [
      { to: "/cost-centers", labelKey: "costCenters", icon: "🏷️" },
      { to: "/projects", labelKey: "projects", icon: "📁" },
    ],
  },
  {
    sectionKey: "reports",
    items: [
      { to: "/reports/analysis", labelKey: "financialAnalysis", icon: "🔎" },
      { to: "/reports/trial-balance", labelKey: "trialBalance", icon: "⚖️" },
      { to: "/reports/profit-loss", labelKey: "profitLoss", icon: "📈" },
      { to: "/reports/balance-sheet", labelKey: "balanceSheet", icon: "🏦" },
      { to: "/reports/ar-aging", labelKey: "arAging", icon: "⏳" },
      { to: "/reports/ap-aging", labelKey: "apAging", icon: "⌛" },
      { to: "/reports/tax-summary", labelKey: "taxReport", icon: "🧮" },
      { to: "/reports/cost-centers", labelKey: "costCenterReport", icon: "🏷️" },
      { to: "/reports/projects", labelKey: "projectReport", icon: "📁" },
    ],
  },
  {
    sectionKey: "settings",
    items: [
      { to: "/team", labelKey: "team", icon: "👥" },
      { to: "/tax-rates", labelKey: "taxRates", icon: "🧾" },
      { to: "/settings", labelKey: "companySettings", icon: "⚙️" },
    ],
  },
];

// Which section owns the current URL, so we can auto-open it. We pick the item whose
// `to` best matches the path (longest prefix; "/" only matches exactly).
function activeSectionKey(pathname: string): string | null {
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const group of NAV) {
    for (const item of group.items) {
      const matches = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
      if (matches && item.to.length > bestLen) {
        bestLen = item.to.length;
        bestKey = group.sectionKey;
      }
    }
  }
  return bestKey;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const activeKey = useMemo(() => activeSectionKey(pathname), [pathname]);

  // Sections the user has pinned open by clicking. Start with the active section open.
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeKey ? [activeKey] : []));
  // The section currently hovered — expands temporarily without pinning.
  const [hovered, setHovered] = useState<string | null>(null);

  // Whenever the route changes to a new section, make sure that section is open.
  useEffect(() => {
    if (activeKey) setOpen((prev) => (prev.has(activeKey) ? prev : new Set(prev).add(activeKey)));
  }, [activeKey]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-4">
      <div className="mb-2 px-2 py-2">
        <span className="text-xl font-bold gradient-text">{t("app.name")}</span>
      </div>

      {NAV.map((group) => {
        const expanded = open.has(group.sectionKey) || hovered === group.sectionKey;
        const hasActive = group.sectionKey === activeKey;
        return (
          <div
            key={group.sectionKey}
            onMouseEnter={() => setHovered(group.sectionKey)}
            onMouseLeave={() => setHovered((h) => (h === group.sectionKey ? null : h))}
          >
            {/* Section header — click to pin open/closed; hover expands it too. */}
            <button
              type="button"
              onClick={() => toggle(group.sectionKey)}
              aria-expanded={expanded}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/5 ${
                hasActive ? "text-aurora-mint" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{t(`nav.${group.sectionKey}`)}</span>
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                {/* Chevron pointing right; rotates to point down when expanded. */}
                <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Section items — shown when expanded (clicked open or hovered). */}
            {expanded && (
              <div className="mb-1 mt-0.5 flex flex-col gap-0.5 ps-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={"end" in item ? (item.end as boolean) : false}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                        isActive
                          ? "bg-aurora-mint/15 text-white shadow-glow"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    <span className="text-base">{item.icon}</span>
                    {t(`nav.${item.labelKey}`)}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Platform owner only — a standalone link, visually distinct from the tenant nav. */}
      {user?.isSuperAdmin && (
        <NavLink
          to="/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            `mt-2 flex items-center gap-3 rounded-xl border border-violet-500/30 px-3 py-2 text-sm transition ${
              isActive ? "bg-violet-500/20 text-white" : "text-violet-300 hover:bg-violet-500/10 hover:text-white"
            }`
          }
        >
          <span className="text-base">🛡️</span>
          Admin
        </NavLink>
      )}
    </nav>
  );
}
