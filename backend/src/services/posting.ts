import { Prisma, type JournalSource, type PrismaClient, type VoucherType } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { D, round2 } from "../utils/money";
import { SYSTEM_CODES } from "./chartOfAccounts";

// One side of a journal entry, as provided by callers (manual entry, invoice, bill...).
export interface PostingLine {
  accountId: string;
  debit?: Prisma.Decimal.Value;
  credit?: Prisma.Decimal.Value;
  description?: string;
}

export interface PostEntryInput {
  orgId: string;
  createdById: string;
  date: Date;
  memo?: string;
  reference?: string;
  source?: JournalSource;
  voucherType?: VoucherType;
  sourceId?: string;
  lines: PostingLine[];
  // Smart-voucher guard overrides (set after the user confirms a warning).
  overrides?: { allowNegativeCash?: boolean; allowDuplicateRef?: boolean };
}

// A Prisma transaction client OR the base client — lets callers post inside a larger
// transaction (e.g. create an invoice AND its journal entry as one atomic unit).
type Db = PrismaClient | Prisma.TransactionClient;

// Validates a set of lines is a legal double-entry posting.
// Rules: at least 2 lines, each line has exactly ONE of debit/credit > 0,
// and total debits === total credits. Throws HttpError(400) otherwise.
export function validateBalanced(lines: PostingLine[]) {
  if (!lines || lines.length < 2) {
    throw new HttpError(400, "A journal entry needs at least two lines.");
  }

  let totalDebit = D(0);
  let totalCredit = D(0);

  for (const [i, line] of lines.entries()) {
    const debit = round2(line.debit ?? 0);
    const credit = round2(line.credit ?? 0);

    if (debit.lt(0) || credit.lt(0)) {
      throw new HttpError(400, `Line ${i + 1}: amounts cannot be negative.`);
    }
    if (debit.gt(0) && credit.gt(0)) {
      throw new HttpError(400, `Line ${i + 1}: a line cannot have both a debit and a credit.`);
    }
    if (debit.eq(0) && credit.eq(0)) {
      throw new HttpError(400, `Line ${i + 1}: enter a debit or a credit amount.`);
    }

    totalDebit = totalDebit.plus(debit);
    totalCredit = totalCredit.plus(credit);
  }

  if (!totalDebit.equals(totalCredit)) {
    throw new HttpError(
      400,
      `Entry is not balanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}.`,
    );
  }

  return { totalDebit, totalCredit };
}

// Creates a POSTED, balanced journal entry with its lines. If `db` is a transaction
// client the write joins that transaction; otherwise it runs in its own.
export async function postEntry(input: PostEntryInput, db: Db = prisma) {
  validateBalanced(input.lines);

  // Guard: every referenced account must belong to this org (prevents cross-tenant posting).
  const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
  const accounts = await db.account.findMany({
    where: { id: { in: accountIds }, orgId: input.orgId },
    select: { id: true, code: true, name: true, isPostable: true, type: true, subtype: true },
  });
  if (accounts.length !== accountIds.length) {
    throw new HttpError(400, "One or more accounts do not exist in this organization.");
  }

  // Guard: you can only post to leaf (detail) accounts, never to a group/header account.
  const group = accounts.find((a) => !a.isPostable);
  if (group) {
    throw new HttpError(
      400,
      `Account ${group.code} ${group.name} is a group and cannot be posted to. Choose a detail account.`,
    );
  }

  // Guard: period lock — no postings dated before the org's lock date (applies to everything).
  const org = await db.organization.findUnique({
    where: { id: input.orgId },
    select: { booksLockedBefore: true },
  });
  if (org?.booksLockedBefore && input.date < org.booksLockedBefore) {
    throw new HttpError(
      400,
      `Books are locked before ${org.booksLockedBefore.toISOString().slice(0, 10)}. Pick a later date.`,
    );
  }

  // The following confirmable guards apply to MANUAL vouchers only — system-generated entries
  // (invoices/bills/payments) legitimately reuse references and move cash.
  const isManual = (input.source ?? "MANUAL") === "MANUAL";

  // Guard: duplicate reference (confirmable).
  if (isManual && input.reference && !input.overrides?.allowDuplicateRef) {
    const dup = await db.journalEntry.findFirst({
      where: { orgId: input.orgId, reference: input.reference, status: "POSTED" },
      select: { id: true },
    });
    if (dup) {
      throw new HttpError(409, `A voucher with reference "${input.reference}" already exists.`, "DUPLICATE_REF");
    }
  }

  // Guard: a cash/bank account would go negative (confirmable).
  if (isManual && !input.overrides?.allowNegativeCash) {
    const cashAccounts = accounts.filter(
      (a) =>
        a.type === "ASSET" &&
        (a.subtype === "Cash" || a.subtype === "Bank" || a.code === SYSTEM_CODES.CASH || a.code === SYSTEM_CODES.BANK),
    );
    for (const acc of cashAccounts) {
      let delta = D(0);
      for (const l of input.lines.filter((l) => l.accountId === acc.id)) {
        delta = delta.plus(round2(l.debit ?? 0)).minus(round2(l.credit ?? 0));
      }
      if (delta.gte(0)) continue; // only a decrease can push it below zero
      const agg = await db.journalLine.aggregate({
        where: { accountId: acc.id, entry: { orgId: input.orgId, status: "POSTED" } },
        _sum: { debit: true, credit: true },
      });
      const current = (agg._sum.debit ?? D(0)).minus(agg._sum.credit ?? D(0));
      if (current.plus(delta).lt(0)) {
        throw new HttpError(
          409,
          `${acc.code} ${acc.name} would go negative (${current.plus(delta).toFixed(2)}). Confirm to proceed.`,
          "NEGATIVE_CASH",
        );
      }
    }
  }

  return db.journalEntry.create({
    data: {
      orgId: input.orgId,
      date: input.date,
      memo: input.memo,
      reference: input.reference,
      status: "POSTED",
      source: input.source ?? "MANUAL",
      voucherType: input.voucherType ?? "JOURNAL",
      sourceId: input.sourceId,
      createdById: input.createdById,
      lines: {
        create: input.lines.map((l) => ({
          accountId: l.accountId,
          debit: round2(l.debit ?? 0),
          credit: round2(l.credit ?? 0),
          description: l.description,
        })),
      },
    },
    include: { lines: true },
  });
}

// Reverses a posted entry by creating a mirror entry (debits<->credits) dated `date`.
// Posted entries are immutable, so corrections are always new reversing entries.
export async function reverseEntry(
  orgId: string,
  entryId: string,
  createdById: string,
  date: Date,
  db: Db = prisma,
) {
  const original = await db.journalEntry.findFirst({
    where: { id: entryId, orgId },
    include: { lines: true },
  });
  if (!original) throw new HttpError(404, "Journal entry not found.");
  if (original.status === "VOID") throw new HttpError(400, "Entry is already voided.");

  const reversed = await postEntry(
    {
      orgId,
      createdById,
      date,
      memo: `Reversal of ${original.reference ?? original.id}`,
      reference: original.reference ?? undefined,
      source: original.source,
      sourceId: original.sourceId ?? undefined,
      overrides: { allowNegativeCash: true, allowDuplicateRef: true },
      lines: original.lines.map((l) => ({
        accountId: l.accountId,
        // swap sides to cancel the original
        debit: l.credit,
        credit: l.debit,
        description: l.description ?? undefined,
      })),
    },
    db,
  );

  await db.journalEntry.update({ where: { id: entryId }, data: { status: "VOID" } });
  return reversed;
}
