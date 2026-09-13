import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { shortDate } from "../../lib/format";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { DataTable } from "../../components/ui/DataTable";
import { ErrorNote } from "../Dashboard";

// --- Types (match the /api/admin responses) ---------------------------------
interface PlatformStats {
  organizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  users: number;
  activeUsers: number;
  invoices: number;
  bills: number;
}

interface AdminOrg {
  id: string;
  name: string;
  baseCurrency: string;
  isActive: boolean;
  createdAt: string;
  _count: { memberships: number; invoices: number; bills: number; customers: number };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  _count: { memberships: number };
}

// Small colored pill for active/suspended state.
function StateBadge({ active, activeLabel = "Active", inactiveLabel = "Suspended" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  const style = active
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>{active ? activeLabel : inactiveLabel}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function AdminPanel() {
  const stats = useFetch<{ stats: PlatformStats }>("/admin/stats");
  const orgs = useFetch<{ organizations: AdminOrg[] }>("/admin/organizations");
  const users = useFetch<{ users: AdminUser[] }>("/admin/users");

  const loading = stats.loading || orgs.loading || users.loading;
  const error = stats.error || orgs.error || users.error;

  if (loading) return <Spinner label="Loading platform data…" />;
  if (error) return <ErrorNote message={error} />;

  const s = stats.data?.stats;

  async function setOrgActive(id: string, isActive: boolean) {
    const verb = isActive ? "re-activate" : "suspend";
    if (!confirm(`Are you sure you want to ${verb} this company? ${isActive ? "" : "All its members will be blocked from using the app."}`)) return;
    try {
      await api.patch(`/admin/organizations/${id}/active`, { isActive });
      orgs.refetch();
      stats.refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function setUserActive(id: string, isActive: boolean) {
    const verb = isActive ? "re-activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${verb} this user across all companies?`)) return;
    try {
      await api.patch(`/admin/users/${id}/active`, { isActive });
      users.refetch();
      stats.refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin" subtitle="Platform administration — all companies and users" />

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Companies" value={s?.organizations ?? 0} hint={`${s?.activeOrganizations ?? 0} active · ${s?.suspendedOrganizations ?? 0} suspended`} />
        <StatCard label="Users" value={s?.users ?? 0} hint={`${s?.activeUsers ?? 0} active`} />
        <StatCard label="Invoices" value={s?.invoices ?? 0} />
        <StatCard label="Bills" value={s?.bills ?? 0} />
      </div>

      {/* Organizations */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Companies (tenants)</h2>
        <Card>
          <DataTable
            rows={orgs.data?.organizations ?? []}
            keyOf={(r) => r.id}
            columns={[
              { header: "Company", cell: (r) => <span className="text-white">{r.name}</span> },
              { header: "Currency", cell: (r) => r.baseCurrency },
              { header: "Members", cell: (r) => r._count.memberships },
              { header: "Invoices", cell: (r) => r._count.invoices },
              { header: "Bills", cell: (r) => r._count.bills },
              { header: "Created", cell: (r) => shortDate(r.createdAt) },
              { header: "Status", cell: (r) => <StateBadge active={r.isActive} /> },
              {
                header: "",
                cell: (r) => (
                  <Button variant={r.isActive ? "ghost" : "primary"} onClick={() => setOrgActive(r.id, !r.isActive)}>
                    {r.isActive ? "Suspend" : "Activate"}
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Users */}
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Users</h2>
        <Card>
          <DataTable
            rows={users.data?.users ?? []}
            keyOf={(r) => r.id}
            columns={[
              {
                header: "Name",
                cell: (r) => (
                  <span className="text-white">
                    {r.name}
                    {r.isSuperAdmin && <span className="ml-2 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">SUPER ADMIN</span>}
                  </span>
                ),
              },
              { header: "Email", cell: (r) => r.email },
              { header: "Companies", cell: (r) => r._count.memberships },
              { header: "Joined", cell: (r) => shortDate(r.createdAt) },
              { header: "Status", cell: (r) => <StateBadge active={r.isActive} activeLabel="Active" inactiveLabel="Disabled" /> },
              {
                header: "",
                cell: (r) =>
                  r.isSuperAdmin ? (
                    <span className="text-xs text-slate-500">—</span>
                  ) : (
                    <Button variant={r.isActive ? "ghost" : "primary"} onClick={() => setUserActive(r.id, !r.isActive)}>
                      {r.isActive ? "Disable" : "Enable"}
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
