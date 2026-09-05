import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { D, round2 } from "../utils/money";
import { postEntry, reverseEntry, type PostingLine } from "./posting";
import { SYSTEM_CODES } from "./chartOfAccounts";
import { nextDocumentNumber } from "./numbering";

type Db = Prisma.TransactionClient;

export interface LineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent?: number;
  incomeAccountId: string;
  costCenterId?: string | null;
  projectId?: string | null;
}

// Computes per-line totals plus document subtotal/tax/total, all exact Decimals.
// Shared by invoices and estimates so the math is identical.
export function computeTotals(lines: LineInput[]) {
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

export interface CreateInvoiceInput {
  customerId: string;
  number?: string; // optional — auto-generated (INV-0001) when omitted
  issueDate: Date;
  dueDate: Date;
  notes?: string;
  lines: LineInput[];
}

// Creates a DRAFT invoice with computed totals. Drafts do NOT touch the ledger.
export async function createInvoice(orgId: string, input: CreateInvoiceInput) {
  if (input.lines.length === 0) throw new HttpError(400, "An invoice needs at least one line.");
  const { computed, subtotal, taxTotal, total } = computeTotals(input.lines);

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, orgId } });
  if (!customer) throw new HttpError(400, "Customer not found.");

  // Auto-number when the user leaves it blank; otherwise enforce uniqueness.
  const number = input.number?.trim() || (await nextDocumentNumber(orgId, "INVOICE"));
  const dupe = await prisma.invoice.findFirst({ where: { orgId, number } });
  if (dupe) throw new HttpError(409, `Invoice number ${number} already exists.`);

  return prisma.invoice.create({
    data: {
      orgId,
      customerId: input.customerId,
      number,
      issueDate: input.issueDate,
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
          incomeAccountId: c.incomeAccountId,
          costCenterId: c.costCenterId || null,
          projectId: c.projectId || null,
        })),
      },
    },
    include: { lines: true, customer: true },
  });
}

// Updates a DRAFT invoice (fields + lines). Posted invoices are immutable.
export async function updateInvoice(orgId: string, id: string, input: CreateInvoiceInput) {
  if (input.lines.length === 0) throw new HttpError(400, "An invoice needs at least one line.");
  const { computed, subtotal, taxTotal, total } = computeTotals(input.lines);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findFirst({ where: { id, orgId } });
    if (!existing) throw new HttpError(404, "Invoice not found.");
    if (existing.status !== "DRAFT") throw new HttpError(400, "Only draft invoices can be edited.");

    const customer = await tx.customer.findFirst({ where: { id: input.customerId, orgId } });
    if (!customer) throw new HttpError(400, "Customer not found.");

    const number = input.number?.trim() || existing.number;
    if (number !== existing.number) {
      const dupe = await tx.invoice.findFirst({ where: { orgId, number, NOT: { id } } });
      if (dupe) throw new HttpError(409, `Invoice number ${number} already exists.`);
    }

    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    return tx.invoice.update({
      where: { id },
      data: {
        customerId: input.customerId,
        number,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        notes: input.notes,
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
            incomeAccountId: c.incomeAccountId,
            costCenterId: c.costCenterId || null,
            projectId: c.projectId || null,
          })),
        },
      },
      include: { lines: true, customer: true },
    });
  });
}

// Deletes a DRAFT invoice. Posted invoices must be voided (reversed), never deleted.
export async function deleteInvoice(orgId: string, id: string) {
  const existing = await prisma.invoice.findFirst({ where: { id, orgId } });
  if (!existing) throw new HttpError(404, "Invoice not found.");
  if (existing.status !== "DRAFT")
    throw new HttpError(400, "Only draft invoices can be deleted. Void a posted invoice instead.");
  await prisma.invoice.delete({ where: { id } });
}

// Posts a DRAFT invoice to the ledger: Dr A/R (total), Cr each income account,
// Cr Sales Tax Payable (if any). Flips status to SENT. Atomic.
export async function postInvoice(orgId: string, userId: string, invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, orgId },
      include: { lines: true },
    });
    if (!invoice) throw new HttpError(404, "Invoice not found.");
    if (invoice.status !== "DRAFT") throw new HttpError(400, "Only draft invoices can be posted.");

    const arId = await getSystemAccountId(tx, orgId, SYSTEM_CODES.ACCOUNTS_RECEIVABLE);

    // Credit income grouped by account + cost centre + project (so the dimensions survive).
    const incomeGroups = new Map<
      string,
      { accountId: string; costCenterId: string | null; projectId: string | null; amount: Prisma.Decimal }
    >();
    for (const l of invoice.lines) {
      const key = `${l.incomeAccountId}|${l.costCenterId ?? ""}|${l.projectId ?? ""}`;
      const g = incomeGroups.get(key) ?? {
        accountId: l.incomeAccountId,
        costCenterId: l.costCenterId,
        projectId: l.projectId,
        amount: D(0),
      };
      g.amount = g.amount.plus(l.lineTotal);
      incomeGroups.set(key, g);
    }

    const lines: PostingLine[] = [
      { accountId: arId, debit: invoice.total, description: `Invoice ${invoice.number}` },
    ];
    for (const g of incomeGroups.values())
      lines.push({
        accountId: g.accountId,
        credit: g.amount,
        costCenterId: g.costCenterId,
        projectId: g.projectId,
      });
    if (invoice.taxTotal.gt(0)) {
      const taxId = await getSystemAccountId(tx, orgId, SYSTEM_CODES.SALES_TAX_PAYABLE);
      lines.push({ accountId: taxId, credit: invoice.taxTotal });
    }

    const entry = await postEntry(
      {
        orgId,
        createdById: userId,
        date: invoice.issueDate,
        memo: `Invoice ${invoice.number}`,
        reference: invoice.number,
        source: "INVOICE",
        sourceId: invoice.id,
        lines,
      },
      tx,
    );

    return tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "SENT", journalEntryId: entry.id },
      include: { lines: true, customer: true },
    });
  });
}

export interface RecordPaymentInput {
  date: Date;
  amount: number;
  bankAccountId: string;
  method?: string;
  reference?: string;
}

// Records a customer payment against an invoice: Dr Bank, Cr A/R. Updates amountPaid
// and status (PARTIAL/PAID). Atomic.
export async function recordInvoicePayment(
  orgId: string,
  userId: string,
  invoiceId: string,
  input: RecordPaymentInput,
) {
  const amount = round2(input.amount);
  if (amount.lte(0)) throw new HttpError(400, "Payment amount must be greater than zero.");

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, orgId } });
    if (!invoice) throw new HttpError(404, "Invoice not found.");
    if (invoice.status === "DRAFT") throw new HttpError(400, "Post the invoice before recording a payment.");
    if (invoice.status === "VOID") throw new HttpError(400, "Cannot pay a voided invoice.");

    const outstanding = invoice.total.minus(invoice.amountPaid);
    if (amount.gt(outstanding)) {
      throw new HttpError(
        400,
        `Payment ${amount.toFixed(2)} exceeds the outstanding ${outstanding.toFixed(2)}.`,
      );
    }

    const bank = await tx.account.findFirst({ where: { id: input.bankAccountId, orgId, type: "ASSET" } });
    if (!bank) throw new HttpError(400, "Choose a valid asset (cash/bank) account.");
    const arId = await getSystemAccountId(tx, orgId, SYSTEM_CODES.ACCOUNTS_RECEIVABLE);

    const entry = await postEntry(
      {
        orgId,
        createdById: userId,
        date: input.date,
        memo: `Payment for invoice ${invoice.number}`,
        reference: input.reference ?? invoice.number,
        source: "PAYMENT",
        voucherType: "CREDIT", // money received = Credit (Receipt) Voucher
        sourceId: invoice.id,
        lines: [
          { accountId: bank.id, debit: amount, description: `Payment ${invoice.number}` },
          { accountId: arId, credit: amount },
        ],
      },
      tx,
    );

    const payment = await tx.payment.create({
      data: {
        orgId,
        type: "RECEIVED",
        date: input.date,
        amount,
        method: input.method,
        bankAccountId: bank.id,
        partyType: "CUSTOMER",
        partyId: invoice.customerId,
        reference: input.reference,
        journalEntryId: entry.id,
        allocations: { create: [{ invoiceId: invoice.id, amount }] },
      },
    });

    const newPaid = invoice.amountPaid.plus(amount);
    const status = newPaid.gte(invoice.total) ? "PAID" : "PARTIAL";
    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, status },
    });

    return { invoice: updated, payment };
  });
}

// Voids a posted invoice by reversing its journal entry. Blocked if payments exist.
export async function voidInvoice(orgId: string, userId: string, invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, orgId } });
    if (!invoice) throw new HttpError(404, "Invoice not found.");
    if (invoice.status === "VOID") throw new HttpError(400, "Invoice is already voided.");
    if (invoice.amountPaid.gt(0)) throw new HttpError(400, "Refund/remove payments before voiding.");

    if (invoice.journalEntryId) {
      await reverseEntry(orgId, invoice.journalEntryId, userId, new Date(), tx);
    }
    return tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
  });
}
