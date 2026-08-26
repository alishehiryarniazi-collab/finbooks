import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFetch } from "../../hooks/useFetch";
import { api, apiError } from "../../lib/api";
import { inputDate, money } from "../../lib/format";
import type { Account, AccountType } from "../../lib/types";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { ErrorNote } from "../Dashboard";

const TYPE_ORDER: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export function OpeningBalances() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading } = useFetch<{ accounts: Account[] }>("/accounts");
  const [date, setDate] = useState(inputDate());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Postable accounts, excluding the auto-managed Opening Balance Equity (code 3200).
  const accounts = useMemo(
    () => (data?.accounts ?? []).filter((a) => a.isPostable && a.code !== "3200"),
    [data],
  );

  const grouped = useMemo(() => {
    const map = new Map<AccountType, Account[]>();
    for (const a of accounts) {
      if (!map.has(a.type)) map.set(a.type, []);
      map.get(a.type)!.push(a);
    }
    return TYPE_ORDER.filter((ty) => map.has(ty)).map((ty) => ({ type: ty, rows: map.get(ty)! }));
  }, [accounts]);

  // Net (debit-positive) of all entered balances; the offset goes to Opening Balance Equity.
  const netDebit = useMemo(() => {
    let net = 0;
    for (const a of accounts) {
      const amt = Number(amounts[a.id]) || 0;
      net += a.normalBalance === "DEBIT" ? amt : -amt;
    }
    return net;
  }, [accounts, amounts]);

  if (loading) return <Spinner label={t("coa.loading")} />;

  async function post() {
    setBusy(true);
    setError(null);
    try {
      const lines = accounts
        .map((a) => ({ accountId: a.id, amount: Number(amounts[a.id]) || 0 }))
        .filter((l) => Math.abs(l.amount) > 0);
      if (lines.length === 0) {
        setError(t("opening.enterAtLeastOne"));
        setBusy(false);
        return;
      }
      await api.post("/accounts/opening-balances", { date, lines });
      navigate("/accounts");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("opening.title")}
        subtitle={t("opening.subtitle")}
        action={
          <Button variant="ghost" onClick={() => navigate("/accounts")}>
            ← {t("view.back")}
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <TextField
              label={t("opening.asOfDate")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-500">{t("opening.obEquityAuto")}</p>
            <p className="tabular-nums text-sm font-semibold text-white">
              {money(Math.abs(netDebit))} {netDebit > 0 ? "Cr" : netDebit < 0 ? "Dr" : ""}
            </p>
          </div>
        </div>
      </Card>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs uppercase tracking-wider text-slate-500">
          <span>{t("fields.account")}</span>
          <span>{t("opening.openingBalance")}</span>
        </div>
        <div className="flex flex-col divide-y divide-white/5">
          {grouped.map((g) => (
            <div key={g.type}>
              <p className="bg-white/[0.02] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t(`acctType.${g.type}`)}
              </p>
              {g.rows.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-600">{a.code}</span>
                    <span className="ml-2 text-sm text-slate-300">{a.name}</span>
                  </div>
                  <input
                    className="input w-40 text-right"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amounts[a.id] ?? ""}
                    onChange={(e) => setAmounts((m) => ({ ...m, [a.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={post} disabled={busy}>
          {busy ? t("actions.posting") : t("opening.postButton")}
        </Button>
        <p className="text-xs text-slate-500">
          {t("opening.hint")}
        </p>
      </div>
    </div>
  );
}
