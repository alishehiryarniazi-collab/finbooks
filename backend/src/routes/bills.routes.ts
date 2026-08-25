import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { createBill, updateBill, deleteBill, postBill, recordBillPayment, voidBill } from "../services/bills";

export const billsRouter = Router();
billsRouter.use(requireAuth);

billsRouter.get("/", async (req, res) => {
  const bills = await prisma.bill.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { billDate: "desc" },
    include: { vendor: { select: { name: true } } },
  });
  res.json({ bills });
});

billsRouter.get("/:id", async (req, res) => {
  const bill = await prisma.bill.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
    include: { vendor: true, lines: { include: { expenseAccount: { select: { code: true, name: true } } } } },
  });
  if (!bill) throw new HttpError(404, "Bill not found.");
  res.json({ bill });
});

const lineSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxRatePercent: z.coerce.number().min(0).max(100).optional(),
  expenseAccountId: z.string().min(1),
  costCenterId: z.string().optional(),
  projectId: z.string().optional(),
});

const createSchema = z.object({
  vendorId: z.string().min(1),
  number: z.string().max(40).optional(),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  notes: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1),
});

billsRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const bill = await createBill(req.auth!.orgId, data);
  res.status(201).json({ bill });
});

// Edit a DRAFT bill.
billsRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const bill = await updateBill(req.auth!.orgId, req.params.id, data);
  res.json({ bill });
});

// Delete a DRAFT bill.
billsRouter.delete("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  await deleteBill(req.auth!.orgId, req.params.id);
  res.json({ ok: true });
});

billsRouter.post("/:id/post", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const bill = await postBill(req.auth!.orgId, req.auth!.userId, req.params.id);
  res.json({ bill });
});

const paymentSchema = z.object({
  date: z.coerce.date(),
  amount: z.coerce.number().positive(),
  bankAccountId: z.string().min(1),
  method: z.string().max(40).optional(),
  reference: z.string().max(60).optional(),
});

billsRouter.post("/:id/payments", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = paymentSchema.parse(req.body);
  const result = await recordBillPayment(req.auth!.orgId, req.auth!.userId, req.params.id, data);
  res.status(201).json(result);
});

billsRouter.post("/:id/void", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const bill = await voidBill(req.auth!.orgId, req.auth!.userId, req.params.id);
  res.json({ bill });
});
