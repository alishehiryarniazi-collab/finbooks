import { accountBalances, profitAndLoss, balanceSheet, dashboard } from "./reports";

// Financial analysis derived entirely from the ledger (no new data). Ratios use standard
// definitions; everything is all-time on the current books.

const n = (s: string | number) => (typeof s === "string" ? Number(s) : s);
const codeInt = (code: string) => parseInt(code, 10) || 0;

// Ratio helper: returns null when the denominator is zero (shown as "—" in the UI).
const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);
const pct = (a: number, b: number): number | null => (b === 0 ? null : (a / b) * 100);

export async function financialAnalysis(orgId: string) {
  const balances = await accountBalances(orgId);
  const pl = await profitAndLoss(orgId);
  const bs = await balanceSheet(orgId);

  // Bucket account balances by accounting-number convention (matches the default chart).
  let currentAssets = 0;
  let currentLiabilities = 0;
  let totalLiabilities = 0;
  let inventory = 0;
  let cash = 0;
  let ar = 0;
  let ap = 0;
  let cogs = 0;
  for (const a of balances) {
    const bal = n(a.balance);
    const c = codeInt(a.code);
    if (a.type === "ASSET") {
      if (c >= 1000 && c < 1500) currentAssets += bal;
      if (a.code === "1400") inventory += bal;
      if (a.code === "1000" || a.code === "1010") cash += bal;
      if (a.code === "1200") ar += bal;
    } else if (a.type === "LIABILITY") {
      totalLiabilities += bal;
      if (c >= 2000 && c < 2200) currentLiabilities += bal;
      if (a.code === "2000") ap += bal;
    } else if (a.type === "EXPENSE" && c >= 5000 && c < 6000) {
      cogs += bal;
    }
  }

  const revenue = n(pl.totalIncome);
  const expenses = n(pl.totalExpense);
  const netProfit = n(pl.netProfit);
  const grossProfit = revenue - cogs;
  const equity = n(bs.totalEquity);

  const ratios = {
    currentRatio: ratio(currentAssets, currentLiabilities),
    quickRatio: ratio(currentAssets - inventory, currentLiabilities),
    grossMarginPct: pct(grossProfit, revenue),
    netMarginPct: pct(netProfit, revenue),
    returnOnEquityPct: pct(netProfit, equity),
    debtToEquity: ratio(totalLiabilities, equity),
    arDays: revenue > 0 ? (ar / revenue) * 365 : null,
    apDays: expenses > 0 ? (ap / expenses) * 365 : null,
  };

  // 6-month trend + this-vs-last month (reuse the dashboard series).
  const dash = await dashboard(orgId);
  const trend = dash.trend.map((t) => ({
    month: t.month,
    income: t.income,
    expense: t.expense,
    net: (n(t.income) - n(t.expense)).toFixed(2),
  }));
  const monthsCovered = cash > 0 && expenses > 0 ? cash / (expenses / 6) : null; // ~6mo expense run-rate

  // Simple 0–100 health score.
  let health = 0;
  if (netProfit > 0) health += 25;
  if (ratios.netMarginPct !== null && ratios.netMarginPct >= 10) health += 15;
  else if (netProfit > 0) health += 7;
  if (ratios.currentRatio !== null) health += ratios.currentRatio >= 1.5 ? 20 : ratios.currentRatio >= 1 ? 12 : 0;
  if (ratios.debtToEquity !== null) health += ratios.debtToEquity <= 1 ? 20 : ratios.debtToEquity <= 2 ? 10 : 0;
  if (ratios.quickRatio !== null && ratios.quickRatio >= 1) health += 20;
  health = Math.min(100, health);

  // Auto-insights. We emit a translation KEY + params (not an English sentence) so the frontend
  // renders each insight in the user's chosen language — nothing mixes.
  type Tone = "good" | "warn" | "info";
  const insights: { key: string; params: Record<string, string>; tone: Tone }[] = [];
  if (ratios.netMarginPct !== null) {
    const p = { pct: ratios.netMarginPct.toFixed(1) };
    insights.push(
      ratios.netMarginPct >= 10
        ? { key: "analysis.ins.netMarginHealthy", params: p, tone: "good" }
        : ratios.netMarginPct >= 0
          ? { key: "analysis.ins.netMarginThin", params: p, tone: "warn" }
          : { key: "analysis.ins.netMarginLoss", params: p, tone: "warn" },
    );
  }
  if (ratios.currentRatio !== null) {
    const p = { ratio: ratios.currentRatio.toFixed(2) };
    insights.push(
      ratios.currentRatio >= 1.5
        ? { key: "analysis.ins.liquidityStrong", params: p, tone: "good" }
        : ratios.currentRatio >= 1
          ? { key: "analysis.ins.liquidityAdequate", params: p, tone: "info" }
          : { key: "analysis.ins.liquidityTight", params: p, tone: "warn" },
    );
  }
  if (revenue > 0 && ar / revenue > 0.25) {
    insights.push({ key: "analysis.ins.receivablesHigh", params: { pct: ((ar / revenue) * 100).toFixed(0) }, tone: "warn" });
  }
  if (monthsCovered !== null) {
    insights.push({
      key: "analysis.ins.cashMonths",
      params: { months: monthsCovered.toFixed(1) },
      tone: monthsCovered >= 3 ? "good" : "warn",
    });
  }
  if (ratios.debtToEquity !== null) {
    insights.push({
      key: "analysis.ins.debtToEquity",
      params: { ratio: ratios.debtToEquity.toFixed(2) },
      tone: ratios.debtToEquity <= 1 ? "good" : ratios.debtToEquity <= 2 ? "info" : "warn",
    });
  }
  if (trend.length >= 2) {
    const last = n(trend[trend.length - 1].net);
    const prev = n(trend[trend.length - 2].net);
    if (prev !== 0) {
      const change = last - prev;
      insights.push({
        key: change >= 0 ? "analysis.ins.netUp" : "analysis.ins.netDown",
        params: { amount: Math.round(Math.abs(change)).toLocaleString("en-US") },
        tone: change >= 0 ? "good" : "warn",
      });
    }
  }

  return {
    kpis: {
      revenue: revenue.toFixed(2),
      netProfit: netProfit.toFixed(2),
      cash: cash.toFixed(2),
      equity: equity.toFixed(2),
    },
    ratios: Object.fromEntries(
      Object.entries(ratios).map(([k, v]) => [k, v === null ? null : Number(v.toFixed(2))]),
    ),
    healthScore: health,
    trend,
    insights,
  };
}
