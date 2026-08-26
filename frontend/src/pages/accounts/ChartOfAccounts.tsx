import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { money } from "../../lib/format";
import type { Account, AccountType } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextField, SelectField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

const TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

// A flattened tree row: the account plus its depth and rolled-up balance.
interface Row {
  account: Account;
  level: number;
  rolled: number; // own balance for leaves; sum of descendants for groups
}

// Turns the flat account list into an ordered, indented list (depth-first by code),
// with each group's balance rolled up from its descendant detail accounts.
function buildRows(accounts: Account[]): Row[] {
  const childrenOf = new Map<string | null, Account[]>();
  for (const a of accounts) {
    const key = a.parentId ?? null;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(a);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.code.localeCompare(b.code));

  const rows: Row[] = [];

  // Returns the rolled-up balance of a node while appending rows in tree order.
  function walk(account: Account, level: number): number {
    const kids = childrenOf.get(account.id) ?? [];
    const row: Row = { account, level, rolled: 0 };
    rows.push(row); // push now to keep parent-before-children order; fill rolled after
    let total = account.isPostable ? Number(account.balance) : 0;
    for (const kid of kids) total += walk(kid, level + 1);
    row.rolled = total;
    return total;
  }

  for (const root of childrenOf.get(null) ?? []) walk(root, 0);
  return rows;
}

export function ChartOfAccounts() {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useFetch<{ accounts: Account[] }>("/accounts");
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const rows = useMemo(() => buildRows(accounts), [accounts]);

  if (loading) return <Spinner label={t("coa.loading")} />;
  if (error) return <ErrorNote message={error} />;

  return (
    <div>
      <PageHeader
        title={t("nav.chartOfAccounts")}
        subtitle={t("coa.subtitle")}
        action={
          hasRole("ADMIN", "ACCOUNTANT") && (
            <div className="flex flex-wrap gap-2">
              <Link to="/accounts/opening-balances">
                <Button variant="ghost">{t("coa.openingBalances")}</Button>
              </Link>
              <Button onClick={() => setOpen(true)}>{t("coa.newAccount")}</Button>
            </div>
          )
        }
      />

      <div className="glass overflow-hidden rounded-2xl">
        {/* Column header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500">
          <span>{t("fields.account")}</span>
          <span>{t("fields.balance")}</span>
        </div>

        <div className="flex flex-col divide-y divide-white/5">
          {rows.map(({ account, level, rolled }) => {
            const isGroup = !account.isPostable;
            const rowClass = "flex items-center justify-between gap-3 px-4 py-2";
            const inner = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs tabular-nums ${isGroup ? "text-slate-500" : "text-slate-600"}`}>
                    {account.code}
                  </span>
                  <span
                    className={`truncate ${isGroup ? "text-sm font-semibold text-white" : "text-sm text-slate-300"}`}
                  >
                    {account.name}
                  </span>
                  {level === 0 && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      {t(`acctType.${account.type}`)}
                    </span>
                  )}
                  {!isGroup && !account.isActive && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-400">{t("crud.inactive")}</span>
                  )}
                </div>
                <span
                  className={`tabular-nums text-sm ${isGroup ? "font-semibold text-white" : "text-slate-300"}`}
                >
                  {money(rolled)}
                </span>
              </>
            );

            const style = { paddingLeft: 16 + level * 22 };
            // Detail (postable) accounts link into their ledger; groups are static.
            return isGroup ? (
              <div key={account.id} className={rowClass} style={style}>
                {inner}
              </div>
            ) : (
              <Link
                key={account.id}
                to={`/ledger/${account.id}`}
                className={`${rowClass} transition hover:bg-white/5`}
                style={style}
                title={t("coa.viewLedger")}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>

      {open && (
        <NewAccountModal
          groups={accounts.filter((a) => !a.isPostable)}
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

function NewAccountModal({
  groups,
  onClose,
  onSaved,
}: {
  groups: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ parentId: "", code: "", name: "", type: "EXPENSE" as AccountType });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parent = groups.find((g) => g.id === form.parentId);
  const isTopLevel = !form.parentId;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { code: form.code, name: form.name };
      if (isTopLevel) payload.type = form.type;
      else payload.parentId = form.parentId;
      await api.post("/accounts", payload);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t("coa.newAccountTitle")} icon="📒" subtitle={t("coa.subtitle")}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <SelectField
          label={t("coa.parentGroup")}
          value={form.parentId}
          onChange={(e) => setForm({ ...form, parentId: e.target.value })}
        >
          <option value="">{t("coa.topLevelOption")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} · {g.name}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-4">
          <TextField
            label={t("fields.code")}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
            placeholder="6500"
          />
          {isTopLevel ? (
            <SelectField
              label={t("fields.type")}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
            >
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`acctType.${ty}`)}
                </option>
              ))}
            </SelectField>
          ) : (
            <SelectField label={t("coa.typeInherited")} value={parent?.type ?? ""} disabled>
              <option>{parent ? t(`acctType.${parent.type}`) : ""}</option>
            </SelectField>
          )}
        </div>

        <TextField
          label={t("fields.name")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          placeholder={t("coa.namePlaceholder")}
        />

        <p className="text-xs text-slate-500">
          {isTopLevel
            ? t("coa.hintTop")
            : parent && groups.some((g) => g.id === parent.parentId)
              ? t("coa.hintLevel3")
              : t("coa.hintLevel2")}
        </p>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t("actions.saving") : t("common.create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
