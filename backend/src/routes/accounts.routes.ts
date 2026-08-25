import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { accountBalances } from "../services/reports";

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
      throw new HttpError(400, "Accounts can be at most 3 levels deep. Pick a level-1 or level-2 group as the parent.");
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
    throw new HttpError(
      409,
      "This account has transactions and cannot be deleted. Deactivate it instead.",
    );
  }

  await prisma.account.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
