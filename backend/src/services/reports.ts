import { Prisma, type AccountType } from "@prisma/client";
import { prisma } from "../prisma";
import { D } from "../utils/money";
import { SYSTEM_CODES } from "./chartOfAccounts";

interface DateRange {
  from?: Date;
  to?: Date;
}

// Raw debit/credit totals per account, computed ONLY from POSTED journal lines.
// This is the foundation every report is built on.
async function rawTotals(orgId: string, range?: DateRange) {
  const dateFilter: Prisma.DateTimeFilter = {};
  if (range?.from) dateFilter.gte = range.from;
  if (range?.to) dateFilter.lte = range.to;

  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      entry: {
        orgId,
        status: "POSTED",
        ...(range?.from || range?.to ? { date: dateFilter } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const map = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
  for (const g of grouped) {
    map.set(g.accountId, { debit: g._sum.debit ?? D(0), credit: g._sum.credit ?? D(0) });
  }
  return map;
}

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  normalBalance: "DEBIT" | "CREDIT";
  isActive: boolean;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal; // positive in the account's normal direction
}

// Signed balance for every account, positive in its NORMAL direction.
// Debit-normal (assets/expenses): debit - credit. Credit-normal: credit - debit.
async function balancesByAccount(orgId: string, range?: DateRange): Promise<AccountBalance[]> {
  const totals = await rawTotals(orgId, range);
  const accounts = await prisma.account.findMany({ where: { orgId }, orderBy: { code: "asc" } });

  return accounts.map((acc) => {
    const t = totals.get(acc.id) ?? { debit: D(0), credit: D(0) };
    const balance =
      acc.normalBalance === "DEBIT" ? t.debit.minus(t.credit) : t.credit.minus(t.debit);
    return { ...acc, debit: t.debit, credit: t.credit, balance };
  });
}

// Public: chart of accounts with balances as strings (for the accounts list UI).
export async function accountBalances(orgId: string, range?: DateRange) {
  const rows = await balancesByAccount(orgId, range);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    subtype: r.subtype,
    normalBalance: r.normalBalance,
    isActive: r.isActive,
    debit: r.debit.toFixed(2),
    credit: r.credit.toFixed(2),
    balance: r.balance.toFixed(2),
  }));
}

// Classic trial balance: each account's net balance in the debit OR credit column.
export async function trialBalance(orgId: string, range?: DateRange) {
  const rows = await balancesByAccount(orgId, range);

  let totalDebit = D(0);
  let totalCredit = D(0);
  const out: { code: string; name: string; type: string; debit: string; credit: string }[] = [];

  for (const acc of rows) {
    const net = acc.debit.minus(acc.credit); // signed, debit-positive
    if (net.isZero()) continue;
    const debitCol = net.gt(0) ? net : D(0);
    const creditCol = net.lt(0) ? net.abs() : D(0);
    totalDebit = totalDebit.plus(debitCol);
    totalCredit = totalCredit.plus(creditCol);
    out.push({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: debitCol.toFixed(2),
      credit: creditCol.toFixed(2),
    });
  }

  return {
    rows: out,
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2),
    balanced: totalDebit.equals(totalCredit),
  };
}

// Profit & Loss: income minus expenses over a period.
export async function profitAndLoss(orgId: string, range?: DateRange) {
  const rows = await balancesByAccount(orgId, range);
  const income = rows.filter((r) => r.type === "INCOME" && !r.balance.isZero());
  const expense = rows.filter((r) => r.type === "EXPENSE" && !r.balance.isZero());

  const totalIncome = income.reduce((a, r) => a.plus(r.balance), D(0));
  const totalExpense = expense.reduce((a, r) => a.plus(r.balance), D(0));
  const netProfit = totalIncome.minus(totalExpense);

  const fmt = (list: AccountBalance[]) =>
    list.map((r) => ({ code: r.code, name: r.name, amount: r.balance.toFixed(2) }));

  return {
    income: fmt(income),
    expenses: fmt(expense),
    totalIncome: totalIncome.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netProfit: netProfit.toFixed(2),
  };
}

// Balance Sheet as of a date. Current-period net income is folded into equity so
// the sheet balances (Assets = Liabilities + Equity) without formal closing entries.
export async function balanceSheet(orgId: string, asOf?: Date) {
  const range: DateRange = asOf ? { to: asOf } : {};
  const rows = await balancesByAccount(orgId, range);

  const pick = (t: AccountType) =>
    rows
      .filter((r) => r.type === t && !r.balance.isZero())
      .map((r) => ({ code: r.code, name: r.name, amount: r.balance.toFixed(2) }));

  const sumType = (t: AccountType) =>
    rows.filter((r) => r.type === t).reduce((a, r) => a.plus(r.balance), D(0));

  const assets = sumType("ASSET");
  const liabilities = sumType("LIABILITY");
  const equityAccounts = sumType("EQUITY");
  const netIncome = sumType("INCOME").minus(sumType("EXPENSE"));
  const totalEquity = equityAccounts.plus(netIncome);

  return {
    assets: pick("ASSET"),
    liabilities: pick("LIABILITY"),
    equity: pick("EQUITY"),
    currentEarnings: netIncome.toFixed(2),
    totalAssets: assets.toFixed(2),
    totalLiabilities: liabilities.toFixed(2),
    totalEquity: totalEquity.toFixed(2),
    balanced: assets.equals(liabilities.plus(totalEquity)),
  };
}

// Buckets an outstanding amount by how overdue it is relative to `today`.
function bucketFor(dueDate: Date, today: Date) {
  const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90_plus";
}

const EMPTY_BUCKETS = () => ({
  current: D(0),
  d1_30: D(0),
  d31_60: D(0),
  d61_90: D(0),
  d90_plus: D(0),
});

// AR aging: open invoices grouped by customer and overdue bucket.
export async function arAging(orgId: string, today = new Date()) {
  const invoices = await prisma.invoice.findMany({
    where: { orgId, status: { in: ["SENT", "PARTIAL"] } },
    include: { customer: { select: { name: true } } },
  });

  const byCustomer = new Map<string, { name: string; buckets: ReturnType<typeof EMPTY_BUCKETS>; total: Prisma.Decimal }>();
  for (const inv of invoices) {
    const outstanding = inv.total.minus(inv.amountPaid);
    if (outstanding.lte(0)) continue;
    const key = inv.customerId;
    if (!byCustomer.has(key)) byCustomer.set(key, { name: inv.customer.name, buckets: EMPTY_BUCKETS(), total: D(0) });
    const row = byCustomer.get(key)!;
    const bucket = bucketFor(inv.dueDate, today);
    row.buckets[bucket] = row.buckets[bucket].plus(outstanding);
    row.total = row.total.plus(outstanding);
  }

  return serializeAging([...byCustomer.values()], "customer");
}

// AP aging: open bills grouped by vendor and overdue bucket.
export async function apAging(orgId: string, today = new Date()) {
  const bills = await prisma.bill.findMany({
    where: { orgId, status: { in: ["OPEN", "PARTIAL"] } },
    include: { vendor: { select: { name: true } } },
  });

  const byVendor = new Map<string, { name: string; buckets: ReturnType<typeof EMPTY_BUCKETS>; total: Prisma.Decimal }>();
  for (const bill of bills) {
    const outstanding = bill.total.minus(bill.amountPaid);
    if (outstanding.lte(0)) continue;
    const key = bill.vendorId;
    if (!byVendor.has(key)) byVendor.set(key, { name: bill.vendor.name, buckets: EMPTY_BUCKETS(), total: D(0) });
    const row = byVendor.get(key)!;
    const bucket = bucketFor(bill.dueDate, today);
    row.buckets[bucket] = row.buckets[bucket].plus(outstanding);
    row.total = row.total.plus(outstanding);
  }

  return serializeAging([...byVendor.values()], "vendor");
}

function serializeAging(
  rows: { name: string; buckets: ReturnType<typeof EMPTY_BUCKETS>; total: Prisma.Decimal }[],
  partyLabel: "customer" | "vendor",
) {
  const totals = EMPTY_BUCKETS();
  let grandTotal = D(0);
  const out = rows.map((r) => {
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] = totals[k].plus(r.buckets[k]);
    grandTotal = grandTotal.plus(r.total);
    return {
      [partyLabel]: r.name,
      current: r.buckets.current.toFixed(2),
      d1_30: r.buckets.d1_30.toFixed(2),
      d31_60: r.buckets.d31_60.toFixed(2),
      d61_90: r.buckets.d61_90.toFixed(2),
      d90_plus: r.buckets.d90_plus.toFixed(2),
      total: r.total.toFixed(2),
    };
  });
  return {
    rows: out,
    totals: {
      current: totals.current.toFixed(2),
      d1_30: totals.d1_30.toFixed(2),
      d31_60: totals.d31_60.toFixed(2),
      d61_90: totals.d61_90.toFixed(2),
      d90_plus: totals.d90_plus.toFixed(2),
      total: grandTotal.toFixed(2),
    },
  };
}

// Dashboard KPIs + a 6-month income/expense trend for the charts.
export async function dashboard(orgId: string, today = new Date()) {
  const all = await balancesByAccount(orgId);
  const byCode = new Map(all.map((a) => [a.code, a]));

  const cash = (byCode.get(SYSTEM_CODES.CASH)?.balance ?? D(0)).plus(
    byCode.get(SYSTEM_CODES.BANK)?.balance ?? D(0),
  );
  const receivable = byCode.get(SYSTEM_CODES.ACCOUNTS_RECEIVABLE)?.balance ?? D(0);
  const payable = byCode.get(SYSTEM_CODES.ACCOUNTS_PAYABLE)?.balance ?? D(0);

  // This month's P&L
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const pl = await profitAndLoss(orgId, { from: monthStart, to: today });

  // 6-month trend
  const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId, status: "POSTED", date: { gte: start } }, account: { type: { in: ["INCOME", "EXPENSE"] } } },
    include: { entry: { select: { date: true } }, account: { select: { type: true } } },
  });

  const trend = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    trend.set(monthKey(d), { income: D(0), expense: D(0) });
  }
  for (const l of lines) {
    const key = monthKey(l.entry.date);
    const slot = trend.get(key);
    if (!slot) continue;
    if (l.account.type === "INCOME") slot.income = slot.income.plus(l.credit.minus(l.debit));
    else slot.expense = slot.expense.plus(l.debit.minus(l.credit));
  }

  const recent = await prisma.journalEntry.findMany({
    where: { orgId, status: "POSTED" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 6,
    include: { lines: true },
  });

  return {
    kpis: {
      cash: cash.toFixed(2),
      receivable: receivable.toFixed(2),
      payable: payable.toFixed(2),
      netProfitThisMonth: pl.netProfit,
      incomeThisMonth: pl.totalIncome,
      expenseThisMonth: pl.totalExpense,
    },
    trend: [...trend.entries()].map(([month, v]) => ({
      month,
      income: v.income.toFixed(2),
      expense: v.expense.toFixed(2),
    })),
    recent: recent.map((e) => ({
      id: e.id,
      date: e.date,
      memo: e.memo,
      reference: e.reference,
      amount: e.lines.reduce((a, l) => a.plus(l.debit), D(0)).toFixed(2),
    })),
  };
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
