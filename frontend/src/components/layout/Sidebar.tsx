import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

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

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="px-2 py-2">
        <span className="text-xl font-bold gradient-text">{t("app.name")}</span>
      </div>
      {NAV.map((group) => (
        <div key={group.sectionKey}>
          <p className="mb-1 px-2 text-xs uppercase tracking-wider text-slate-500">
            {t(`nav.${group.sectionKey}`)}
          </p>
          <div className="flex flex-col gap-0.5">
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
        </div>
      ))}
    </nav>
  );
}
