import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { money, shortDate } from "../../lib/format";
import type { JournalEntry } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { ErrorNote } from "../Dashboard";

export function JournalList() {
  const { data, loading, error } = useFetch<{ entries: JournalEntry[] }>("/journal");
  const { hasRole } = useAuth();

  if (loading) return <Spinner label="Loading journal…" />;
  if (error) return <ErrorNote message={error} />;

  const entries = data?.entries ?? [];

  return (
    <div>
      <PageHeader
        title="Journal"
        subtitle="Every posting in the general ledger"
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <Link to="/journal/new">
              <Button>+ New entry</Button>
            </Link>
          )
        }
      />

      {entries.length === 0 ? (
        <Card><p className="py-8 text-center text-sm text-slate-500">No journal entries yet.</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const total = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
            return (
              <Card key={entry.id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-white">{entry.memo ?? "Journal entry"}</span>
                    {entry.reference && <span className="ml-2 text-xs text-slate-500">#{entry.reference}</span>}
                    <p className="text-xs text-slate-500">{shortDate(entry.date)} · {entry.source}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm text-slate-300">{money(total)}</span>
                    <StatusBadge status={entry.status} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <tbody>
                      {entry.lines.map((l) => (
                        <tr key={l.id} className="border-t border-white/5">
                          <td className="py-1.5 text-slate-300">
                            <span className="text-xs text-slate-500">{l.account?.code}</span> {l.account?.name}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-400">
                            {Number(l.debit) > 0 ? money(l.debit) : ""}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-400">
                            {Number(l.credit) > 0 ? money(l.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
