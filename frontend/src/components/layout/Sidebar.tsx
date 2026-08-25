import { NavLink } from "react-router-dom";

// Navigation grouped into sections. Icons are simple emoji to stay dependency-free.
const NAV = [
  {
    section: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: "📊", end: true }],
  },
  {
    section: "Bookkeeping",
    items: [{ to: "/accounts", label: "Chart of Accounts", icon: "📚" }],
  },
  {
    section: "Vouchers",
    items: [
      { to: "/journal", label: "All Vouchers", icon: "📗" },
      { to: "/vouchers/credit/new", label: "Credit Voucher", icon: "🟢" },
      { to: "/vouchers/debit/new", label: "Debit Voucher", icon: "🔴" },
      { to: "/journal/new", label: "Journal Voucher", icon: "📝" },
    ],
  },
  {
    section: "Sales (AR)",
    items: [
      { to: "/customers", label: "Customers", icon: "🧑‍💼" },
      { to: "/invoices", label: "Invoices", icon: "🧾" },
    ],
  },
  {
    section: "Purchases (AP)",
    items: [
      { to: "/vendors", label: "Vendors", icon: "🏭" },
      { to: "/bills", label: "Bills", icon: "📄" },
    ],
  },
  {
    section: "Money",
    items: [{ to: "/payments", label: "Payments", icon: "💸" }],
  },
  {
    section: "Reports",
    items: [
      { to: "/reports/trial-balance", label: "Trial Balance", icon: "⚖️" },
      { to: "/reports/profit-loss", label: "Profit & Loss", icon: "📈" },
      { to: "/reports/balance-sheet", label: "Balance Sheet", icon: "🏦" },
      { to: "/reports/ar-aging", label: "AR Aging", icon: "⏳" },
      { to: "/reports/ap-aging", label: "AP Aging", icon: "⌛" },
    ],
  },
  {
    section: "Settings",
    items: [{ to: "/team", label: "Team", icon: "👥" }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <div className="px-2 py-2">
        <span className="text-xl font-bold gradient-text">FinBooks</span>
      </div>
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="mb-1 px-2 text-xs uppercase tracking-wider text-slate-500">{group.section}</p>
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
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
