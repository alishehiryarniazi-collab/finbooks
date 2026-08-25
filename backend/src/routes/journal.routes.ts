import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { postEntry, reverseEntry } from "../services/posting";
import { D } from "../utils/money";
import type { VoucherType } from "@prisma/client";

export const journalRouter = Router();
journalRouter.use(requireAuth);

// List journal entries (newest first). Optional ?type=JOURNAL|DEBIT|CREDIT filter.
journalRouter.get("/", async (req, res) => {
  const type = req.query.type;
  const voucherFilter =
    type === "JOURNAL" || type === "DEBIT" || type === "CREDIT" ? { voucherType: type as VoucherType } : {};
  const entries = await prisma.journalEntry.findMany({
    where: { orgId: req.auth!.orgId, ...voucherFilter },
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
  costCenterId: z.string().optional(),
  projectId: z.string().optional(),
});

// Confirmable-guard overrides sent after the user acknowledges a warning.
const overrideFields = {
  allowNegativeCash: z.boolean().optional(),
  allowDuplicateRef: z.boolean().optional(),
};

const createSchema = z.object({
  date: z.coerce.date(),
  memo: z.string().max(200).optional(),
  reference: z.string().max(60).optional(),
  lines: z.array(lineSchema).min(2, "An entry needs at least two lines."),
  ...overrideFields,
});

// Create a manual, balanced JOURNAL VOUCHER. The posting service enforces
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
    voucherType: "JOURNAL",
    lines: data.lines,
    overrides: { allowNegativeCash: data.allowNegativeCash, allowDuplicateRef: data.allowDuplicateRef },
  });
  res.status(201).json({ entry });
});

// --- Cash/Bank vouchers -----------------------------------------------------
// Both take a cash/bank account plus one or more counter lines with a positive amount.
const voucherSchema = z.object({
  date: z.coerce.date(),
  memo: z.string().max(200).optional(),
  reference: z.string().max(60).optional(),
  bankAccountId: z.string().min(1, "Choose the cash/bank account."),
  lines: z
    .array(
      z.object({
        accountId: z.string().min(1),
        amount: z.coerce.number().positive(),
        description: z.string().max(200).optional(),
        costCenterId: z.string().optional(),
        projectId: z.string().optional(),
      }),
    )
    .min(1, "Add at least one line."),
  ...overrideFields,
});

// DEBIT (Payment) Voucher: cash/bank goes OUT. Counter accounts are DEBITED,
// the cash/bank account is CREDITED for the total.
journalRouter.post("/debit-voucher", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = voucherSchema.parse(req.body);
  const total = data.lines.reduce((sum, l) => sum + l.amount, 0);
  const entry = await postEntry({
    orgId: req.auth!.orgId,
    createdById: req.auth!.userId,
    date: data.date,
    memo: data.memo,
    reference: data.reference,
    source: "MANUAL",
    voucherType: "DEBIT",
    lines: [
      ...data.lines.map((l) => ({
        accountId: l.accountId,
        debit: l.amount,
        description: l.description,
        costCenterId: l.costCenterId,
        projectId: l.projectId,
      })),
      { accountId: data.bankAccountId, credit: total, description: "Payment" },
    ],
    overrides: { allowNegativeCash: data.allowNegativeCash, allowDuplicateRef: data.allowDuplicateRef },
  });
  res.status(201).json({ entry });
});

// CREDIT (Receipt) Voucher: cash/bank comes IN. The cash/bank account is DEBITED
// for the total, counter accounts are CREDITED.
journalRouter.post("/credit-voucher", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = voucherSchema.parse(req.body);
  const total = data.lines.reduce((sum, l) => sum + l.amount, 0);
  const entry = await postEntry({
    orgId: req.auth!.orgId,
    createdById: req.auth!.userId,
    date: data.date,
    memo: data.memo,
    reference: data.reference,
    source: "MANUAL",
    voucherType: "CREDIT",
    lines: [
      { accountId: data.bankAccountId, debit: total, description: "Receipt" },
      ...data.lines.map((l) => ({
        accountId: l.accountId,
        credit: l.amount,
        description: l.description,
        costCenterId: l.costCenterId,
        projectId: l.projectId,
      })),
    ],
    overrides: { allowNegativeCash: data.allowNegativeCash, allowDuplicateRef: data.allowDuplicateRef },
  });
  res.status(201).json({ entry });
});

const reverseSchema = z.object({ date: z.coerce.date().optional() });

// Reverse (void) a posted MANUAL voucher by creating a mirror entry. Entries generated by
// an invoice/bill/payment must be undone via that document's own Void flow, otherwise the
// document status (and A/R or A/P) would desync from the ledger.
journalRouter.post("/:id/reverse", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { date } = reverseSchema.parse(req.body ?? {});
  const entry = await prisma.journalEntry.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
    select: { source: true },
  });
  if (!entry) throw new HttpError(404, "Journal entry not found.");
  if (entry.source !== "MANUAL") {
    throw new HttpError(400, "This entry belongs to a document. Void the invoice/bill/payment instead.");
  }
  const reversed = await reverseEntry(req.auth!.orgId, req.params.id, req.auth!.userId, date ?? new Date());
  res.status(201).json({ entry: reversed });
});

// General ledger (account statement) for a single account: every posting in the
// selected date range, with a running balance carried forward from an opening balance.
// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD.
const ledgerRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

journalRouter.get("/ledger/:accountId", async (req, res) => {
  const orgId = req.auth!.orgId;
  const { from, to } = ledgerRangeSchema.parse(req.query);

  const account = await prisma.account.findFirst({ where: { id: req.params.accountId, orgId } });
  if (!account) throw new HttpError(404, "Account not found.");

  // Moves a balance in the account's normal direction.
  type Dec = ReturnType<typeof D>;
  const delta = (debit: Dec, credit: Dec) =>
    account.normalBalance === "DEBIT" ? debit.minus(credit) : credit.minus(debit);

  // Opening balance = net of everything BEFORE the "from" date (0 if no from).
  let opening = D(0);
  if (from) {
    const prior = await prisma.journalLine.aggregate({
      where: { accountId: account.id, entry: { orgId, status: "POSTED", date: { lt: from } } },
      _sum: { debit: true, credit: true },
    });
    opening = delta(prior._sum.debit ?? D(0), prior._sum.credit ?? D(0));
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: account.id,
      entry: { orgId, status: "POSTED", ...(from || to ? { date: dateFilter } : {}) },
    },
    include: { entry: { select: { date: true, memo: true, reference: true, voucherType: true } } },
    orderBy: [{ entry: { date: "asc" } }, { entry: { createdAt: "asc" } }],
  });

  let running = opening;
  const rows = lines.map((l) => {
    running = running.plus(delta(l.debit, l.credit));
    return {
      date: l.entry.date,
      memo: l.entry.memo,
      reference: l.entry.reference,
      voucherType: l.entry.voucherType,
      description: l.description,
      debit: l.debit.toFixed(2),
      credit: l.credit.toFixed(2),
      balance: running.toFixed(2),
    };
  });

  res.json({
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
    },
    opening: opening.toFixed(2),
    rows,
    closing: running.toFixed(2),
  });
});
