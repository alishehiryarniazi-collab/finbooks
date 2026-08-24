import { useFetch } from "../../hooks/useFetch";
import { money } from "../../lib/format";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorNote } from "../Dashboard";

interface BS {
  assets: { code: string; name: string; amount: string }[];
  liabilities: { code: string; name: string; amount: string }[];
  equity: { code: string; name: string; amount: string }[];
  currentEarnings: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  balanced: boolean;
}

export function BalanceSheet() {
  const { data, loading, error } = useFetch<BS>("/reports/balance-sheet");
  if (loading) return <Spinner label="Building balance sheet…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="Balance Sheet"
        subtitle="What you own vs what you owe"
        action={
          <span className={`rounded-full border px-3 py-1 text-sm ${data.balanced ? "border-emerald-500/30 text-emerald-300" : "border-rose-500/30 text-rose-300"}`}>
            {data.balanced ? "✓ Assets = Liabilities + Equity" : "✗ Out of balance"}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Assets" rows={data.assets} total={data.totalAssets} />
        <div className="flex flex-col gap-6">
          <Section title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} />
          <Section
            title="Equity"
            rows={[...data.equity, { code: "", name: "Current Year Earnings", amount: data.currentEarnings }]}
            total={data.totalEquity}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, rows, total }: { title: string; rows: { code: string; name: string; amount: string }[]; total: string }) {
  return (
    <Card>
      <h3 className="mb-3 text-lg font-semibold text-white">{title}</h3>
      <div className="flex flex-col divide-y divide-white/5">
        {rows.map((r, i) => (
          <div key={r.code || i} className="flex justify-between py-2 text-sm">
            <span className="text-slate-300">{r.code && <span className="text-xs text-slate-500">{r.code} </span>}{r.name}</span>
            <span className="tabular-nums text-slate-300">{money(r.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-semibold text-white">
        <span>Total {title}</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>
    </Card>
  );
}
