import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { D } from "../utils/money";
import { nextDocumentNumber } from "./numbering";
import { computeTotals, createInvoice, type LineInput } from "./invoices";

export interface EstimateInput {
  customerId: string;
  number?: string; // optional — auto-generated (EST-0001) when omitted
  issueDate: Date;
  expiryDate: Date;
  notes?: string;
  lines: LineInput[];
}

const includeFull = {
  lines: { include: { incomeAccount: { select: { code: true, name: true } } } },
  customer: true,
};

// Creates a DRAFT estimate with computed totals. Estimates never touch the ledger.
export async function createEstimate(orgId: string, input: EstimateInput) {
  if (input.lines.length === 0) throw new HttpError(400, "An estimate needs at least one line.");
  const { computed, subtotal, taxTotal, total } = computeTotals(input.lines);

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, orgId } });
  if (!customer) throw new HttpError(400, "Customer not found.");

  const number = input.number?.trim() || (await nextDocumentNumber(orgId, "ESTIMATE"));
  const dupe = await prisma.estimate.findFirst({ where: { orgId, number } });
  if (dupe) throw new HttpError(409, `Estimate number ${number} already exists.`);

  return prisma.estimate.create({
    data: {
      orgId,
      customerId: input.customerId,
      number,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
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
        })),
      },
    },
    include: includeFull,
  });
}

// Edits an estimate (only before it's been converted). Replaces the line set.
export async function updateEstimate(orgId: string, id: string, input: EstimateInput) {
  const existing = await prisma.estimate.findFirst({ where: { id, orgId } });
  if (!existing) throw new HttpError(404, "Estimate not found.");
  if (existing.status === "CONVERTED") throw new HttpError(409, "A converted estimate can't be edited.");
  if (input.lines.length === 0) throw new HttpError(400, "An estimate needs at least one line.");

  const { computed, subtotal, taxTotal, total } = computeTotals(input.lines);

  return prisma.$transaction(async (tx) => {
    await tx.estimateLine.deleteMany({ where: { estimateId: id } });
    return tx.estimate.update({
      where: { id },
      data: {
        customerId: input.customerId,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
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
          })),
        },
      },
      include: includeFull,
    });
  });
}

// Turns an accepted estimate into a DRAFT invoice (copying the lines), then marks it CONVERTED.
export async function convertEstimateToInvoice(orgId: string, id: string) {
  const estimate = await prisma.estimate.findFirst({ where: { id, orgId }, include: { lines: true } });
  if (!estimate) throw new HttpError(404, "Estimate not found.");
  if (estimate.status === "CONVERTED" || estimate.convertedInvoiceId) {
    throw new HttpError(409, "This estimate has already been converted to an invoice.");
  }
  if (estimate.status === "DECLINED") throw new HttpError(409, "A declined estimate can't be converted.");

  const now = new Date();
  const invoice = await createInvoice(orgId, {
    customerId: estimate.customerId,
    issueDate: now,
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // net-30 by default
    notes: estimate.notes ?? undefined,
    lines: estimate.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      taxRatePercent: Number(l.taxRatePercent),
      incomeAccountId: l.incomeAccountId,
    })),
  });

  await prisma.estimate.update({
    where: { id },
    data: { status: "CONVERTED", convertedInvoiceId: invoice.id },
  });

  return invoice;
}
