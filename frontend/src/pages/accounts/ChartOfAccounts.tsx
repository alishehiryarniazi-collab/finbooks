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
  // Which groups are expanded. Empty = everything collapsed, so only the 5 top
  // categories (Assets, Liabilities, Equity, Income, Expense) show by default.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const rows = useMemo(() => buildRows(accounts), [accounts]);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // A row is visible only when every one of its ancestor groups is expanded.
  const isVisible = (account: Account) => {
    let p = account.parentId;
    while (p) {
      if (!openGroups.has(p)) return false;
      p = byId.get(p)?.parentId ?? null;
    }
    return true;
  };

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allGroupIds = useMemo(() => accounts.filter((a) => !a.isPostable).map((a) => a.id), [accounts]);
  const allExpanded = allGroupIds.length > 0 && allGroupIds.every((id) => openGroups.has(id));

  if (loading) return <Spinner label={t("coa.loading")} />;
  if (error) return <ErrorNote message={error} />;

  return (
    <div>
      <PageHeader
        title={t("nav.chartOfAccounts")}
        subtitle={t("coa.subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpenGroups(allExpanded ? new Set() : new Set(allGroupIds))}
            >
              {allExpanded ? t("coa.collapseAll", "Collapse all") : t("coa.expandAll", "Expand all")}
            </Button>
            {hasRole("ADMIN", "ACCOUNTANT") && (
              <>
                <Link to="/accounts/opening-balances">
                  <Button variant="ghost">{t("coa.openingBalances")}</Button>
                </Link>
                <Button onClick={() => setOpen(true)}>{t("coa.newAccount")}</Button>
              </>
            )}
          </div>
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
            if (!isVisible(account)) return null; // hidden inside a collapsed group
            const isGroup = !account.isPostable;
            const expanded = openGroups.has(account.id);
            const rowClass = "flex items-center justify-between gap-3 px-4 py-2";
            const inner = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  {/* Chevron for groups (rotates when open); spacer keeps detail rows aligned. */}
                  {isGroup ? (
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M8 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
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
            // Groups toggle open/closed; detail (postable) accounts link into their ledger.
            return isGroup ? (
              <button
                key={account.id}
                type="button"
                onClick={() => toggleGroup(account.id)}
                aria-expanded={expanded}
                className={`${rowClass} w-full text-left transition hover:bg-white/5`}
                style={style}
              >
                {inner}
              </button>
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
