import { Prisma, type JournalSource, type PrismaClient, type VoucherType } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { D, round2 } from "../utils/money";

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
    select: { id: true, code: true, name: true, isPostable: true },
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
