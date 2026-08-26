import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { shortDate } from "../lib/format";
import type { Role } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField, SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { ErrorNote } from "./Dashboard";

interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "VIEWER"];

export function Team() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<{ users: Member[] }>("/users");
  const { user, hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <Spinner label={t("common.loading")} />;
  if (error) return <ErrorNote message={error} />;
  const members = data?.users ?? [];
  const isAdmin = hasRole("ADMIN");

  async function changeRole(id: string, role: Role) {
    try {
      await api.patch(`/users/${id}`, { role });
      refetch();
    } catch (err) {
      alert(apiError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={t("nav.team")}
        subtitle={t("team.subtitle")}
        action={isAdmin && <Button onClick={() => setOpen(true)}>{t("team.invite")}</Button>}
      />
      <Card>
        <DataTable
          rows={members}
          keyOf={(r) => r.id}
          columns={[
            {
              header: t("fields.name"),
              cell: (r) => (
                <span className="text-white">
                  {r.name}
                  {r.id === user?.id && <span className="ml-2 text-xs text-slate-500">{t("team.you")}</span>}
                </span>
              ),
            },
            { header: t("fields.email"), cell: (r) => r.email },
            {
              header: t("team.role"),
              cell: (r) =>
                isAdmin && r.id !== user?.id ? (
                  <select
                    className="input [&>option]:bg-aurora-bg2 max-w-[10rem]"
                    value={r.role}
                    onChange={(e) => changeRole(r.id, e.target.value as Role)}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t(`roles.${role}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  t(`roles.${r.role}`)
                ),
            },
            {
              header: t("fields.status"),
              cell: (r) => (
                <span
                  className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    r.isActive
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-slate-500/30 bg-slate-500/15 text-slate-300"
                  }`}
                >
                  {r.isActive ? t("team.active") : t("team.inactive")}
                </span>
              ),
            },
            { header: t("team.joined"), cell: (r) => shortDate(r.createdAt) },
          ]}
        />
      </Card>

      {open && (
        <InviteModal
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "VIEWER" as Role });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/users", form);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("team.inviteTitle")}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField
          label={t("fields.name")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <TextField
          label={t("fields.email")}
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t("team.tempPassword")}
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <SelectField
            label={t("team.role")}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </SelectField>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("actions.saving") : t("team.addUser")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
