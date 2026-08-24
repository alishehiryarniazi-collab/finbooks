import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { postEntry, reverseEntry } from "../services/posting";
import { D } from "../utils/money";

export const journalRouter = Router();
journalRouter.use(requireAuth);

// List journal entries (newest first) with their lines and account names.
journalRouter.get("/", async (req, res) => {
  const entries = await prisma.journalEntry.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      lines: { include: { account: { select: { code: true, name: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  res.json({ entries });
});

journalRouter.get("/:id", async (req, res) => {
  const entry = await prisma.journalEntry.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
    include: { lines: { include: { account: true } }, createdBy: { select: { name: true } } },
  });
  if (!entry) throw new HttpError(404, "Journal entry not found.");
  res.json({ entry });
});

const lineSchema = z.object({
  accountId: z.string().min(1),
  debit: z.coerce.number().min(0).optional(),
  credit: z.coerce.number().min(0).optional(),
  description: z.string().max(200).optional(),
});

const createSchema = z.object({
  date: z.coerce.date(),
  memo: z.string().max(200).optional(),
  reference: z.string().max(60).optional(),
  lines: z.array(lineSchema).min(2, "An entry needs at least two lines."),
});

// Create a manual, balanced journal entry. The posting service enforces
// debits === credits inside a transaction (throws 400 if not balanced).
journalRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const entry = await postEntry({
    orgId: req.auth!.orgId,
    createdById: req.auth!.userId,
    date: data.date,
    memo: data.memo,
    reference: data.reference,
    source: "MANUAL",
    lines: data.lines,
  });
  res.status(201).json({ entry });
});

const reverseSchema = z.object({ date: z.coerce.date().optional() });

// Reverse (void) a posted entry by creating a mirror entry. Posted entries are immutable.
journalRouter.post("/:id/reverse", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { date } = reverseSchema.parse(req.body ?? {});
  const reversed = await reverseEntry(
    req.auth!.orgId,
    req.params.id,
    req.auth!.userId,
    date ?? new Date(),
  );
  res.status(201).json({ entry: reversed });
});

// General ledger for a single account: every line, with a running balance.
journalRouter.get("/ledger/:accountId", async (req, res) => {
  const orgId = req.auth!.orgId;
  const account = await prisma.account.findFirst({ where: { id: req.params.accountId, orgId } });
  if (!account) throw new HttpError(404, "Account not found.");

  const lines = await prisma.journalLine.findMany({
    where: { accountId: account.id, entry: { orgId, status: "POSTED" } },
    include: { entry: { select: { date: true, memo: true, reference: true } } },
    orderBy: [{ entry: { date: "asc" } }],
  });

  let running = D(0);
  const rows = lines.map((l) => {
    // Running balance moves in the account's normal direction.
    const delta =
      account.normalBalance === "DEBIT" ? l.debit.minus(l.credit) : l.credit.minus(l.debit);
    running = running.plus(delta);
    return {
      date: l.entry.date,
      memo: l.entry.memo,
      reference: l.entry.reference,
      description: l.description,
      debit: l.debit.toFixed(2),
      credit: l.credit.toFixed(2),
      balance: running.toFixed(2),
    };
  });

  res.json({
    account: { id: account.id, code: account.code, name: account.name, type: account.type },
    rows,
    balance: running.toFixed(2),
  });
});
