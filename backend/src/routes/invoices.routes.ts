import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createInvoice,
  postInvoice,
  recordInvoicePayment,
  voidInvoice,
} from "../services/invoices";

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get("/", async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { issueDate: "desc" },
    include: { customer: { select: { name: true } } },
  });
  res.json({ invoices });
});

invoicesRouter.get("/:id", async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
    include: { customer: true, lines: { include: { incomeAccount: { select: { code: true, name: true } } } } },
  });
  if (!invoice) throw new HttpError(404, "Invoice not found.");
  res.json({ invoice });
});

const lineSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  incomeAccountId: z.string().min(1),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  number: z.string().min(1).max(40),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1),
});

invoicesRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const invoice = await createInvoice(req.auth!.orgId, data);
  res.status(201).json({ invoice });
});

invoicesRouter.post("/:id/post", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const invoice = await postInvoice(req.auth!.orgId, req.auth!.userId, req.params.id);
  res.json({ invoice });
});

const paymentSchema = z.object({
  date: z.coerce.date(),
  amount: z.coerce.number().positive(),
  bankAccountId: z.string().min(1),
  method: z.string().max(40).optional(),
  reference: z.string().max(60).optional(),
});

invoicesRouter.post("/:id/payments", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = paymentSchema.parse(req.body);
  const result = await recordInvoicePayment(req.auth!.orgId, req.auth!.userId, req.params.id, data);
  res.status(201).json(result);
});

invoicesRouter.post("/:id/void", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const invoice = await voidInvoice(req.auth!.orgId, req.auth!.userId, req.params.id);
  res.json({ invoice });
});
