import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { accountBalances } from "../services/reports";
import { postEntry, type PostingLine } from "../services/posting";
import { SYSTEM_CODES } from "../services/chartOfAccounts";
import { D, round2 } from "../utils/money";

export const accountsRouter = Router();

// Everything here requires a logged-in user; org comes from the token.
accountsRouter.use(requireAuth);

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;

// Normal balance is implied by the account type, so callers don't have to send it.
const NORMAL_BY_TYPE: Record<(typeof ACCOUNT_TYPES)[number], "DEBIT" | "CREDIT"> = {
  ASSET: "DEBIT",
  EXPENSE: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  INCOME: "CREDIT",
};

// List the chart of accounts with each account's current balance.
accountsRouter.get("/", async (req, res) => {
  const rows = await accountBalances(req.auth!.orgId);
  res.json({ accounts: rows });
});

const createSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  // Type is required for a top-level account, but inherited from the parent otherwise.
  type: z.enum(ACCOUNT_TYPES).optional(),
  subtype: z.string().max(60).optional(),
  parentId: z.string().min(1).optional(),
});

// Walks up the parent chain to find an account's depth (level 1 = top of the tree).
async function accountLevel(orgId: string, accountId: string): Promise<number> {
  let level = 1;
  let current = await prisma.account.findFirst({
    where: { id: accountId, orgId },
    select: { parentId: true },
  });
  // Cap the walk at the 3-level design to avoid any accidental infinite loop.
  while (current?.parentId && level < 5) {
    level++;
    current = await prisma.account.findFirst({
      where: { id: current.parentId, orgId },
      select: { parentId: true },
    });
  }
  return level;
}

// Create requires ACCOUNTANT or ADMIN (VIEWER is read-only).
// Only leaf (level-3) accounts are postable; levels 1 & 2 are groups. Max depth is 3.
accountsRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const orgId = req.auth!.orgId;

  const dupe = await prisma.account.findFirst({ where: { orgId, code: data.code } });
  if (dupe) throw new HttpError(409, `Account code ${data.code} already exists.`);

  let level = 1;
  let type = data.type;

  if (data.parentId) {
    const parent = await prisma.account.findFirst({ where: { id: data.parentId, orgId } });
    if (!parent) throw new HttpError(400, "Parent account not found.");
    const parentLevel = await accountLevel(orgId, parent.id);
    if (parentLevel >= 3) {
      throw new HttpError(
        400,
        "Accounts can be at most 3 levels deep. Pick a level-1 or level-2 group as the parent.",
      );
    }
    level = parentLevel + 1;
    type = parent.type; // children inherit their parent's category
  } else if (!type) {
    throw new HttpError(400, "Choose an account type for a top-level account.");
  }

  const account = await prisma.account.create({
    data: {
      orgId,
      code: data.code,
      name: data.name,
      type: type!,
      subtype: data.subtype,
      normalBalance: NORMAL_BY_TYPE[type!],
      parentId: data.parentId ?? null,
      isPostable: level === 3, // only detail (level-3) accounts can receive postings
    },
  });
  res.status(201).json({ account });
});

// Finds (or creates) the Opening Balance Equity account used to offset opening balances.
async function ensureOpeningBalanceEquity(orgId: string) {
  const existing = await prisma.account.findFirst({
    where: { orgId, code: SYSTEM_CODES.OPENING_BALANCE_EQUITY },
  });
  if (existing) return existing;

  // Prefer nesting under an equity sub-group; fall back to any equity group.
  const parent =
    (await prisma.account.findFirst({
      where: { orgId, type: "EQUITY", isPostable: false, parentId: { not: null } },
    })) ?? (await prisma.account.findFirst({ where: { orgId, type: "EQUITY", isPostable: false } }));

  return prisma.account.create({
    data: {
      orgId,
      code: SYSTEM_CODES.OPENING_BALANCE_EQUITY,
      name: "Opening Balance Equity",
      type: "EQUITY",
      normalBalance: "CREDIT",
      parentId: parent?.id ?? null,
      isPostable: true,
    },
  });
}

const openingSchema = z.object({
  date: z.coerce.date(),
  lines: z.array(z.object({ accountId: z.string().min(1), amount: z.coerce.number() })).min(1),
});

// Posts an opening-balance journal entry. Each amount is the account's starting balance
// in its NORMAL direction; the difference is offset to Opening Balance Equity so the
// entry balances. Standard bookkeeping technique for going-live / migration.
accountsRouter.post("/opening-balances", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = openingSchema.parse(req.body);
  const orgId = req.auth!.orgId;

  const nonZero = data.lines.filter((l) => Math.abs(l.amount) > 0.005);
  if (nonZero.length === 0) throw new HttpError(400, "Enter at least one opening balance.");

  const ids = [...new Set(nonZero.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({ where: { id: { in: ids }, orgId } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const l of nonZero) {
    const a = byId.get(l.accountId);
    if (!a) throw new HttpError(400, "One or more accounts do not exist.");
    if (!a.isPostable)
      throw new HttpError(400, `Account ${a.code} ${a.name} is a group; pick a detail account.`);
    if (a.code === SYSTEM_CODES.OPENING_BALANCE_EQUITY) {
      throw new HttpError(400, "Opening Balance Equity is filled automatically.");
    }
  }

  const obe = await ensureOpeningBalanceEquity(orgId);

  const lines: PostingLine[] = [];
  let totalDebit = D(0);
  let totalCredit = D(0);
  for (const l of nonZero) {
    const a = byId.get(l.accountId)!;
    // Convert the normal-direction amount into a debit-positive figure.
    const signedDebit = a.normalBalance === "DEBIT" ? l.amount : -l.amount;
    const v = round2(Math.abs(signedDebit));
    if (v.lte(0)) continue;
    if (signedDebit > 0) {
      lines.push({ accountId: a.id, debit: v, description: "Opening balance" });
      totalDebit = totalDebit.plus(v);
    } else {
      lines.push({ accountId: a.id, credit: v, description: "Opening balance" });
      totalCredit = totalCredit.plus(v);
    }
  }

  // Offset the net to Opening Balance Equity so debits === credits.
  const diff = totalDebit.minus(totalCredit);
  if (!diff.isZero()) {
    if (diff.gt(0))
      lines.push({ accountId: obe.id, credit: diff.abs(), description: "Opening balance offset" });
    else lines.push({ accountId: obe.id, debit: diff.abs(), description: "Opening balance offset" });
  }
  if (lines.length < 2) throw new HttpError(400, "Opening balances must affect at least two accounts.");

  const entry = await postEntry({
    orgId,
    createdById: req.auth!.userId,
    date: data.date,
    memo: "Opening balances",
    reference: "OPENING",
    source: "MANUAL",
    voucherType: "JOURNAL",
    lines,
  });
  res.status(201).json({ entry });
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  subtype: z.string().max(60).optional(),
  isActive: z.boolean().optional(),
});

// Update name/subtype/active flag. Type & code are intentionally immutable once
// an account may have transactions — changing them would corrupt historical reports.
accountsRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const orgId = req.auth!.orgId;

  const existing = await prisma.account.findFirst({ where: { id: req.params.id, orgId } });
  if (!existing) throw new HttpError(404, "Account not found.");

  const account = await prisma.account.update({ where: { id: existing.id }, data });
  res.json({ account });
});

// Delete only if the account has never been used; otherwise deactivate instead.
accountsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const orgId = req.auth!.orgId;
  const existing = await prisma.account.findFirst({ where: { id: req.params.id, orgId } });
  if (!existing) throw new HttpError(404, "Account not found.");

  const childCount = await prisma.account.count({ where: { parentId: existing.id } });
  if (childCount > 0) {
    throw new HttpError(409, "This group has sub-accounts. Delete or move them first.");
  }

  const usage = await prisma.journalLine.count({ where: { accountId: existing.id } });
  if (usage > 0) {
    throw new HttpError(409, "This account has transactions and cannot be deleted. Deactivate it instead.");
  }

  await prisma.account.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
