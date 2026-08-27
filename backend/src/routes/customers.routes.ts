import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";

export const customersRouter = Router();
customersRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  // Payment / beneficiary details (all optional) — used for refunds.
  paymentMethod: z.string().max(20).optional(),
  bankName: z.string().max(120).optional(),
  accountTitle: z.string().max(120).optional(),
  accountNumber: z.string().max(50).optional(),
  iban: z.string().max(50).optional(),
  raastId: z.string().max(50).optional(),
});

customersRouter.get("/", async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { name: "asc" },
  });
  res.json({ customers });
});

customersRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const customer = await prisma.customer.create({
    data: { ...data, email: data.email || null, orgId: req.auth!.orgId },
  });
  res.status(201).json({ customer });
});

customersRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.partial().parse(req.body);
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
  });
  if (!existing) throw new HttpError(404, "Customer not found.");
  const customer = await prisma.customer.update({
    where: { id: existing.id },
    data: { ...data, email: data.email === "" ? null : data.email },
  });
  res.json({ customer });
});

customersRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.customer.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
  });
  if (!existing) throw new HttpError(404, "Customer not found.");

  const invoiceCount = await prisma.invoice.count({ where: { customerId: existing.id } });
  if (invoiceCount > 0) {
    throw new HttpError(409, "Customer has invoices and cannot be deleted.");
  }
  await prisma.customer.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
