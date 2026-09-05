import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { createEstimate, updateEstimate, convertEstimateToInvoice } from "../services/estimates";

export const estimatesRouter = Router();
estimatesRouter.use(requireAuth);

estimatesRouter.get("/", async (req, res) => {
  const estimates = await prisma.estimate.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { issueDate: "desc" },
    include: { customer: { select: { name: true } } },
  });
  res.json({ estimates });
});

estimatesRouter.get("/:id", async (req, res) => {
  const estimate = await prisma.estimate.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
    include: {
      customer: true,
      lines: { include: { incomeAccount: { select: { code: true, name: true } } } },
    },
  });
  if (!estimate) throw new HttpError(404, "Estimate not found.");
  res.json({ estimate });
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
  number: z.string().max(40).optional(),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1),
});

estimatesRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const estimate = await createEstimate(req.auth!.orgId, data);
  res.status(201).json({ estimate });
});

estimatesRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const estimate = await updateEstimate(req.auth!.orgId, req.params.id, data);
  res.json({ estimate });
});

estimatesRouter.delete("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const existing = await prisma.estimate.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Estimate not found.");
  if (existing.status === "CONVERTED") throw new HttpError(409, "A converted estimate can't be deleted.");
  await prisma.estimate.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// Move an estimate through its lifecycle: mark it sent, accepted or declined.
const statusSchema = z.object({ status: z.enum(["SENT", "ACCEPTED", "DECLINED"]) });

estimatesRouter.post("/:id/status", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  const existing = await prisma.estimate.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Estimate not found.");
  if (existing.status === "CONVERTED") throw new HttpError(409, "This estimate has already been converted.");
  const estimate = await prisma.estimate.update({ where: { id: existing.id }, data: { status } });
  res.json({ estimate });
});

// Convert an accepted estimate into a draft invoice.
estimatesRouter.post("/:id/convert", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const invoice = await convertEstimateToInvoice(req.auth!.orgId, req.params.id);
  res.status(201).json({ invoice });
});
