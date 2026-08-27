import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetch } from "../hooks/useFetch";
import { api, apiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { Customer } from "../lib/types";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { TextField, SelectField } from "../components/ui/Field";
import { DataTable } from "../components/ui/DataTable";
import { ListControls } from "../components/ui/ListControls";
import { ErrorNote } from "./Dashboard";

// Shared CRUD screen for customers and vendors (same shape, different endpoint/labels).
// All labels are derived from `kind` so nothing mixes across languages.
export function PartyManager({
  resource,
  kind,
  dataKey,
}: {
  resource: "customers" | "vendors";
  kind: "customer" | "vendor";
  dataKey: "customers" | "vendors";
}) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<Record<string, Customer[]>>(`/${resource}`);
  const { hasRole } = useAuth();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [q, setQ] = useState("");

  const canEdit = hasRole("ADMIN", "ACCOUNTANT");
  const isCustomer = kind === "customer";

  if (loading) return <Spinner label={t(isCustomer ? "pages.loadingCustomers" : "pages.loadingVendors")} />;
  if (error) return <ErrorNote message={error} />;

  const all = data?.[dataKey] ?? [];
  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      needle === "" ||
      r.name.toLowerCase().includes(needle) ||
      (r.email ?? "").toLowerCase().includes(needle) ||
      (r.phone ?? "").toLowerCase().includes(needle),
  );

  return (
    <div>
      <PageHeader
        title={t(isCustomer ? "nav.customers" : "nav.vendors")}
        subtitle={t(isCustomer ? "pages.customersSubtitle" : "pages.vendorsSubtitle")}
        action={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              {t(isCustomer ? "pages.newCustomer" : "pages.newVendor")}
            </Button>
          )
        }
      />
      <ListControls
        query={q}
        onQuery={setQ}
        placeholder={t(isCustomer ? "pages.searchCustomers" : "pages.searchVendors")}
      />
      <Card>
        <DataTable
          rows={rows}
          keyOf={(r) => r.id}
          onRowClick={canEdit ? (r) => setEditing(r) : undefined}
          empty={t(isCustomer ? "pages.noCustomers" : "pages.noVendors")}
          columns={[
            { header: t("fields.name"), cell: (r) => <span className="text-white">{r.name}</span> },
            { header: t("fields.email"), cell: (r) => r.email ?? "—" },
            { header: t("fields.phone"), cell: (r) => r.phone ?? "—" },
          ]}
        />
      </Card>

      {(creating || editing) && (
        <PartyModal
          resource={resource}
          kind={kind}
          party={editing}
          canDelete={hasRole("ADMIN")}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function PartyModal({
  resource,
  kind,
  party,
  canDelete,
  onClose,
  onSaved,
}: {
  resource: string;
  kind: "customer" | "vendor";
  party: Customer | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const isEdit = !!party;
  const isCustomer = kind === "customer";
  const [form, setForm] = useState({
    name: party?.name ?? "",
    email: party?.email ?? "",
    phone: party?.phone ?? "",
    address: party?.address ?? "",
    paymentMethod: party?.paymentMethod ?? "",
    bankName: party?.bankName ?? "",
    accountTitle: party?.accountTitle ?? "",
    accountNumber: party?.accountNumber ?? "",
    iban: party?.iban ?? "",
    raastId: party?.raastId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Works for both text inputs and the themed SelectField (both give {target:{value}}).
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  const method = form.paymentMethod;
  const isBank = method === "BANK";
  const isWallet = method === "JAZZCASH" || method === "EASYPAISA";
  const needsAccount = isBank || isWallet || method === "CHEQUE";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Send empty fields as undefined so we don't store blank strings.
      const payload: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(form)) payload[k] = v === "" ? undefined : v;
      payload.name = form.name;
      if (isEdit) await api.patch(`/${resource}/${party!.id}`, payload);
      else await api.post(`/${resource}`, payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm(t(isCustomer ? "pages.deleteCustomerConfirm" : "pages.deleteVendorConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/${resource}/${party!.id}`);
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setBusy(false);
    }
  }

  const title = isEdit
    ? t(isCustomer ? "pages.editCustomer" : "pages.editVendor")
    : t(isCustomer ? "pages.addCustomer" : "pages.addVendor");

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      icon={isCustomer ? "👤" : "🏭"}
      subtitle={t(isCustomer ? "pages.customersSubtitle" : "pages.vendorsSubtitle")}
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label={t("fields.name")} value={form.name} onChange={set("name")} required />
        <div className="grid grid-cols-2 gap-4">
          <TextField label={t("fields.email")} type="email" value={form.email} onChange={set("email")} />
          <TextField label={t("fields.phone")} value={form.phone} onChange={set("phone")} />
        </div>
        <TextField label={t("fields.address")} value={form.address} onChange={set("address")} />

        {/* Payment / beneficiary details — where money goes at pay-time. */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-sm font-medium text-slate-300">{t("party.paymentDetails")}</p>
          <div className="flex flex-col gap-4">
            <SelectField label={t("party.method")} value={form.paymentMethod} onChange={set("paymentMethod")}>
              <option value="">{t("party.methodNone")}</option>
              <option value="BANK">{t("party.bank")}</option>
              <option value="JAZZCASH">{t("party.jazzcash")}</option>
              <option value="EASYPAISA">{t("party.easypaisa")}</option>
              <option value="CASH">{t("party.cash")}</option>
              <option value="CHEQUE">{t("party.cheque")}</option>
            </SelectField>

            {isBank && (
              <TextField label={t("party.bankName")} value={form.bankName} onChange={set("bankName")} placeholder="Meezan Bank" />
            )}
            {needsAccount && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label={t("party.accountTitle")} value={form.accountTitle} onChange={set("accountTitle")} />
                <TextField
                  label={isWallet ? t("party.mobileNumber") : t("party.accountNumber")}
                  value={form.accountNumber}
                  onChange={set("accountNumber")}
                  placeholder={isWallet ? "03001234567" : ""}
                />
              </div>
            )}
            {isBank && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label={t("party.iban")} value={form.iban} onChange={set("iban")} placeholder="PK00MEZN0000000000000000" />
                <TextField label={t("party.raastId")} value={form.raastId} onChange={set("raastId")} placeholder="03001234567" />
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {isEdit && canDelete ? (
            <button
              type="button"
              onClick={del}
              disabled={busy}
              className="text-sm text-rose-400 hover:text-rose-300"
            >
              {t("common.delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("actions.saving") : isEdit ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
