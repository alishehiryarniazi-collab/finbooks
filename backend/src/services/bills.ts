import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { D, round2 } from "../utils/money";
import { postEntry, reverseEntry, type PostingLine } from "./posting";
import { SYSTEM_CODES } from "./chartOfAccounts";

type Db = Prisma.TransactionClient;

interface LineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent?: number;
  expenseAccountId: string;
}

function computeTotals(lines: LineInput[]) {
  let subtotal = D(0);
  let taxTotal = D(0);
  const computed = lines.map((l) => {
    const lineTotal = round2(D(l.quantity).times(l.unitPrice));
    const tax = round2(lineTotal.times(D(l.taxRatePercent ?? 0).dividedBy(100)));
    subtotal = subtotal.plus(lineTotal);
    taxTotal = taxTotal.plus(tax);
    return { ...l, lineTotal, tax };
  });
  return { computed, subtotal, taxTotal, total: subtotal.plus(taxTotal) };
}

async function getSystemAccountId(db: Db, orgId: string, code: string) {
  const acc = await db.account.findFirst({ where: { orgId, code }, select: { id: true } });
  if (!acc) throw new HttpError(400, `Required account ${code} is missing from the chart of accounts.`);
  return acc.id;
}

export interface CreateBillInput {
  vendorId: string;
  number: string;
  billDate: Date;
  dueDate: Date;
  notes?: string;
  lines: LineInput[];
}

// Creates a DRAFT bill with computed totals. Drafts do NOT touch the ledger.
export async function createBill(orgId: string, input: CreateBillInput) {
  if (input.lines.length === 0) throw new HttpError(400, "A bill needs at least one line.");
  const { computed, subtotal, taxTotal, total } = computeTotals(input.lines);

  const vendor = await prisma.vendor.findFirst({ where: { id: input.vendorId, orgId } });
  if (!vendor) throw new HttpError(400, "Vendor not found.");

  const dupe = await prisma.bill.findFirst({ where: { orgId, number: input.number } });
  if (dupe) throw new HttpError(409, `Bill number ${input.number} already exists.`);

  return prisma.bill.create({
    data: {
      orgId,
      vendorId: input.vendorId,
      number: input.number,
      billDate: input.billDate,
      dueDate: input.dueDate,
      notes: input.notes,
      status: "DRAFT",
      subtotal,
      taxTotal,
      total,
      lines: {
        create: computed.map((c) => ({
          description: c.description,
          quantity: D(c.quantity),
          unitPrice: D(c.unitPrice),
          taxRatePercent: D(c.taxRatePercent ?? 0),
          lineTotal: c.lineTotal,
          expenseAccountId: c.expenseAccountId,
        })),
      },
    },
    include: { lines: true, vendor: true },
  });
}

// Posts a DRAFT bill: Dr each expense account, Dr input tax (recoverable), Cr A/P.
// Flips status to OPEN. Atomic.
export async function postBill(orgId: string, userId: string, billId: string) {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id: billId, orgId }, include: { lines: true } });
    if (!bill) throw new HttpError(404, "Bill not found.");
    if (bill.status !== "DRAFT") throw new HttpError(400, "Only draft bills can be posted.");

    const apId = await getSystemAccountId(tx, orgId, SYSTEM_CODES.ACCOUNTS_PAYABLE);

    const expenseByAccount = new Map<string, Prisma.Decimal>();
    for (const l of bill.lines) {
      expenseByAccount.set(
        l.expenseAccountId,
        (expenseByAccount.get(l.expenseAccountId) ?? D(0)).plus(l.lineTotal),
      );
    }

    const lines: PostingLine[] = [];
    for (const [accountId, amount] of expenseByAccount) lines.push({ accountId, debit: amount });
    if (bill.taxTotal.gt(0)) {
      // Input tax reduces the net Sales Tax Payable liability (VAT recoverable).
      const taxId = await getSystemAccountId(tx, orgId, SYSTEM_CODES.SALES_TAX_PAYABLE);
      lines.push({ accountId: taxId, debit: bill.taxTotal });
    }
    lines.push({ accountId: apId, credit: bill.total, description: `Bill ${bill.number}` });

    const entry = await postEntry(
      {
        orgId,
        createdById: userId,
        date: bill.billDate,
        memo: `Bill ${bill.number}`,
        reference: bill.number,
        source: "BILL",
        sourceId: bill.id,
        lines,
      },
      tx,
    );

    return tx.bill.update({
      where: { id: bill.id },
      data: { status: "OPEN", journalEntryId: entry.id },
      include: { lines: true, vendor: true },
    });
  });
}

export interface RecordBillPaymentInput {
  date: Date;
  amount: number;
  bankAccountId: string;
  method?: string;
  reference?: string;
}

// Records a payment to a vendor against a bill: Dr A/P, Cr Bank. Atomic.
export async function recordBillPayment(
  orgId: string,
  userId: string,
  billId: string,
  input: RecordBillPaymentInput,
) {
  const amount = round2(input.amount);
  if (amount.lte(0)) throw new HttpError(400, "Payment amount must be greater than zero.");

  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id: billId, orgId } });
    if (!bill) throw new HttpError(404, "Bill not found.");
    if (bill.status === "DRAFT") throw new HttpError(400, "Post the bill before paying it.");
    if (bill.status === "VOID") throw new HttpError(400, "Cannot pay a voided bill.");

    const outstanding = bill.total.minus(bill.amountPaid);
    if (amount.gt(outstanding)) {
      throw new HttpError(400, `Payment ${amount.toFixed(2)} exceeds the outstanding ${outstanding.toFixed(2)}.`);
    }

    const bank = await tx.account.findFirst({ where: { id: input.bankAccountId, orgId, type: "ASSET" } });
    if (!bank) throw new HttpError(400, "Choose a valid asset (cash/bank) account.");
    const apId = await getSystemAccountId(tx, orgId, SYSTEM_CODES.ACCOUNTS_PAYABLE);

    const entry = await postEntry(
      {
        orgId,
        createdById: userId,
        date: input.date,
        memo: `Payment for bill ${bill.number}`,
        reference: input.reference ?? bill.number,
        source: "PAYMENT",
        sourceId: bill.id,
        lines: [
          { accountId: apId, debit: amount, description: `Payment ${bill.number}` },
          { accountId: bank.id, credit: amount },
        ],
      },
      tx,
    );

    await tx.payment.create({
      data: {
        orgId,
        type: "MADE",
        date: input.date,
        amount,
        method: input.method,
        bankAccountId: bank.id,
        partyType: "VENDOR",
        partyId: bill.vendorId,
        reference: input.reference,
        journalEntryId: entry.id,
        allocations: { create: [{ billId: bill.id, amount }] },
      },
    });

    const newPaid = bill.amountPaid.plus(amount);
    const status = newPaid.gte(bill.total) ? "PAID" : "PARTIAL";
    const updated = await tx.bill.update({ where: { id: bill.id }, data: { amountPaid: newPaid, status } });
    return { bill: updated };
  });
}

export async function voidBill(orgId: string, userId: string, billId: string) {
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id: billId, orgId } });
    if (!bill) throw new HttpError(404, "Bill not found.");
    if (bill.status === "VOID") throw new HttpError(400, "Bill is already voided.");
    if (bill.amountPaid.gt(0)) throw new HttpError(400, "Remove payments before voiding.");

    if (bill.journalEntryId) {
      await reverseEntry(orgId, bill.journalEntryId, userId, new Date(), tx);
    }
    return tx.bill.update({ where: { id: bill.id }, data: { status: "VOID" } });
  });
}
