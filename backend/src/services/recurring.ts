import cron from "node-cron";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { D } from "../utils/money";
import { createInvoice, postInvoice, type LineInput } from "./invoices";

type Frequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringInput {
  customerId: string;
  frequency: Frequency;
  interval: number;
  startDate: Date;
  endDate?: Date | null;
  autoPost?: boolean;
  notes?: string;
  lines: LineInput[];
}

const includeFull = {
  lines: { include: { incomeAccount: { select: { code: true, name: true } } } },
  customer: true,
};

// Returns the next run date one period on from `d`.
function advanceDate(d: Date, freq: Frequency, interval: number): Date {
  const nd = new Date(d);
  const n = Math.max(1, interval);
  if (freq === "WEEKLY") nd.setDate(nd.getDate() + 7 * n);
  else if (freq === "MONTHLY") nd.setMonth(nd.getMonth() + n);
  else if (freq === "QUARTERLY") nd.setMonth(nd.getMonth() + 3 * n);
  else nd.setFullYear(nd.getFullYear() + n);
  return nd;
}

function lineCreate(input: RecurringInput) {
  return input.lines.map((l) => ({
    description: l.description,
    quantity: D(l.quantity),
    unitPrice: D(l.unitPrice),
    taxRatePercent: D(l.taxRatePercent ?? 0),
    incomeAccountId: l.incomeAccountId,
  }));
}

export async function createRecurring(orgId: string, userId: string, input: RecurringInput) {
  if (input.lines.length === 0) throw new HttpError(400, "A recurring invoice needs at least one line.");
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, orgId } });
  if (!customer) throw new HttpError(400, "Customer not found.");

  return prisma.recurringInvoice.create({
    data: {
      orgId,
      customerId: input.customerId,
      createdByUserId: userId,
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      nextRunDate: input.startDate, // first invoice is generated on the start date
      endDate: input.endDate ?? null,
      autoPost: input.autoPost ?? false,
      notes: input.notes,
      lines: { create: lineCreate(input) },
    },
    include: includeFull,
  });
}

export async function updateRecurring(orgId: string, id: string, input: RecurringInput) {
  const existing = await prisma.recurringInvoice.findFirst({ where: { id, orgId } });
  if (!existing) throw new HttpError(404, "Recurring invoice not found.");
  if (input.lines.length === 0) throw new HttpError(400, "A recurring invoice needs at least one line.");

  // If it has never generated an invoice yet, keep the next run aligned to the start date.
  const nextRunDate = existing.lastRunAt ? existing.nextRunDate : input.startDate;

  return prisma.$transaction(async (tx) => {
    await tx.recurringInvoiceLine.deleteMany({ where: { recurringInvoiceId: id } });
    return tx.recurringInvoice.update({
      where: { id },
      data: {
        customerId: input.customerId,
        frequency: input.frequency,
        interval: input.interval,
        startDate: input.startDate,
        nextRunDate,
        endDate: input.endDate ?? null,
        autoPost: input.autoPost ?? false,
        notes: input.notes,
        lines: { create: lineCreate(input) },
      },
      include: includeFull,
    });
  });
}

// Generates one invoice from a template with the given issue date; posts it if autoPost is on.
async function generateInvoice(
  tpl: {
    id: string;
    orgId: string;
    customerId: string;
    createdByUserId: string;
    autoPost: boolean;
    notes: string | null;
    lines: {
      description: string;
      quantity: unknown;
      unitPrice: unknown;
      taxRatePercent: unknown;
      incomeAccountId: string;
    }[];
  },
  issueDate: Date,
) {
  const invoice = await createInvoice(tpl.orgId, {
    customerId: tpl.customerId,
    issueDate,
    dueDate: new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    notes: tpl.notes ?? undefined,
    lines: tpl.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      taxRatePercent: Number(l.taxRatePercent),
      incomeAccountId: l.incomeAccountId,
    })),
  });
  if (tpl.autoPost) await postInvoice(tpl.orgId, tpl.createdByUserId, invoice.id);
  return invoice;
}

// "Run now": generate the next invoice immediately and move the schedule forward one period.
export async function runRecurringNow(orgId: string, id: string) {
  const tpl = await prisma.recurringInvoice.findFirst({ where: { id, orgId }, include: { lines: true } });
  if (!tpl) throw new HttpError(404, "Recurring invoice not found.");
  const now = new Date();
  const invoice = await generateInvoice(tpl as never, now);
  await prisma.recurringInvoice.update({
    where: { id },
    data: {
      nextRunDate: advanceDate(tpl.nextRunDate, tpl.frequency as Frequency, tpl.interval),
      lastRunAt: now,
    },
  });
  return invoice;
}

// Generates every invoice a template is due for (capped for safety), advancing its next run date.
async function runTemplate(tpl: Awaited<ReturnType<typeof loadDue>>[number], now: Date) {
  let cursor = tpl.nextRunDate;
  let count = 0;
  while (cursor <= now && (!tpl.endDate || cursor <= tpl.endDate) && count < 24) {
    await generateInvoice(tpl as never, cursor);
    cursor = advanceDate(cursor, tpl.frequency as Frequency, tpl.interval);
    count++;
  }
  if (count > 0) {
    const pastEnd = tpl.endDate && cursor > tpl.endDate;
    await prisma.recurringInvoice.update({
      where: { id: tpl.id },
      data: { nextRunDate: cursor, lastRunAt: now, ...(pastEnd ? { status: "PAUSED" as const } : {}) },
    });
  }
  return count;
}

function loadDue(now: Date) {
  return prisma.recurringInvoice.findMany({
    where: { status: "ACTIVE", nextRunDate: { lte: now } },
    include: { lines: true },
  });
}

// Runs all templates that are due. Called on startup (to catch missed runs while the app was off)
// and by the daily cron job. Failures on one template don't stop the others.
export async function runDueRecurringInvoices(): Promise<number> {
  const now = new Date();
  const due = await loadDue(now);
  let total = 0;
  for (const tpl of due) {
    try {
      total += await runTemplate(tpl, now);
    } catch (e) {
      console.error(`[recurring] failed to run template ${tpl.id}:`, e);
    }
  }
  if (total > 0) console.log(`[recurring] generated ${total} invoice(s) from recurring templates.`);
  return total;
}

// Starts the scheduler: a catch-up pass now, then a daily check at 6am.
export function startRecurringScheduler() {
  runDueRecurringInvoices().catch((e) => console.error("[recurring] startup run failed:", e));
  cron.schedule("0 6 * * *", () => {
    runDueRecurringInvoices().catch((e) => console.error("[recurring] daily run failed:", e));
  });
}
