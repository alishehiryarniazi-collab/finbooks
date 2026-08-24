import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useFetch } from "../hooks/useFetch";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { money, shortDate } from "../lib/format";

interface DashboardData {
  kpis: {
    cash: string;
    receivable: string;
    payable: string;
    netProfitThisMonth: string;
    incomeThisMonth: string;
    expenseThisMonth: string;
  };
  trend: { month: string; income: string; expense: string }[];
  recent: { id: string; date: string; memo: string | null; reference: string | null; amount: string }[];
}

const KPIS = [
  { key: "cash", label: "Cash & Bank", accent: "text-aurora-mint" },
  { key: "receivable", label: "Accounts Receivable", accent: "text-sky-300" },
  { key: "payable", label: "Accounts Payable", accent: "text-amber-300" },
  { key: "netProfitThisMonth", label: "Net Profit (This Month)", accent: "text-emerald-300" },
] as const;

export function Dashboard() {
  const { data, loading, error } = useFetch<DashboardData>("/reports/dashboard");

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const chartData = data.trend.map((t) => ({
    month: t.month.slice(5), // MM
    Income: Number(t.income),
    Expense: Number(t.expense),
  }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="A live snapshot of your finances" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.key}>
            <p className="text-sm text-slate-400">{k.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${k.accent}`}>{money(data.kpis[k.key])}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-white">Income vs Expense (6 months)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#0b0e17", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(v: number) => money(v)}
                />
                <Legend />
                <Bar dataKey="Income" fill="#5ff0d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expense" fill="#7b5cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-white">Recent activity</h3>
          <div className="flex flex-col divide-y divide-white/5">
            {data.recent.length === 0 && <p className="py-6 text-sm text-slate-500">No transactions yet.</p>}
            {data.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{r.memo ?? r.reference ?? "Journal entry"}</p>
                  <p className="text-xs text-slate-500">{shortDate(r.date)}</p>
                </div>
                <span className="tabular-nums text-sm text-slate-300">{money(r.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="glass border-rose-500/30 p-4 text-sm text-rose-300">
      {message}
    </div>
  );
}
