import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { createRecurring, updateRecurring, runRecurringNow } from "../services/recurring";

export const recurringRouter = Router();
recurringRouter.use(requireAuth);

recurringRouter.get("/", async (req, res) => {
  const recurring = await prisma.recurringInvoice.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { nextRunDate: "asc" },
    include: { customer: { select: { name: true } } },
  });
  res.json({ recurring });
});

recurringRouter.get("/:id", async (req, res) => {
  const recurring = await prisma.recurringInvoice.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
    include: {
      customer: true,
      lines: { include: { incomeAccount: { select: { code: true, name: true } } } },
    },
  });
  if (!recurring) throw new HttpError(404, "Recurring invoice not found.");
  res.json({ recurring });
});

const lineSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  incomeAccountId: z.string().min(1),
});

const upsertSchema = z.object({
  customerId: z.string().min(1),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  interval: z.coerce.number().int().min(1).max(52),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  autoPost: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1),
});

recurringRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const recurring = await createRecurring(req.auth!.orgId, req.auth!.userId, data);
  res.status(201).json({ recurring });
});

recurringRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const recurring = await updateRecurring(req.auth!.orgId, req.params.id, data);
  res.json({ recurring });
});

recurringRouter.delete("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const existing = await prisma.recurringInvoice.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
  });
  if (!existing) throw new HttpError(404, "Recurring invoice not found.");
  await prisma.recurringInvoice.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// Pause or resume the schedule.
const statusSchema = z.object({ status: z.enum(["ACTIVE", "PAUSED"]) });
recurringRouter.post("/:id/status", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  const existing = await prisma.recurringInvoice.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
  });
  if (!existing) throw new HttpError(404, "Recurring invoice not found.");
  const recurring = await prisma.recurringInvoice.update({ where: { id: existing.id }, data: { status } });
  res.json({ recurring });
});

// Generate the next invoice immediately.
recurringRouter.post("/:id/run", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const invoice = await runRecurringNow(req.auth!.orgId, req.params.id);
  res.status(201).json({ invoice });
});
