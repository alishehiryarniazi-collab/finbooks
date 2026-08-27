import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  // Payment / beneficiary details (all optional).
  paymentMethod: z.string().max(20).optional(),
  bankName: z.string().max(120).optional(),
  accountTitle: z.string().max(120).optional(),
  accountNumber: z.string().max(50).optional(),
  iban: z.string().max(50).optional(),
  raastId: z.string().max(50).optional(),
});

vendorsRouter.get("/", async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { name: "asc" },
  });
  res.json({ vendors });
});

vendorsRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const vendor = await prisma.vendor.create({
    data: { ...data, email: data.email || null, orgId: req.auth!.orgId },
  });
  res.status(201).json({ vendor });
});

vendorsRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.partial().parse(req.body);
  const existing = await prisma.vendor.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
  });
  if (!existing) throw new HttpError(404, "Vendor not found.");
  const vendor = await prisma.vendor.update({
    where: { id: existing.id },
    data: { ...data, email: data.email === "" ? null : data.email },
  });
  res.json({ vendor });
});

vendorsRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.vendor.findFirst({
    where: { id: req.params.id, orgId: req.auth!.orgId },
  });
  if (!existing) throw new HttpError(404, "Vendor not found.");

  const billCount = await prisma.bill.count({ where: { vendorId: existing.id } });
  if (billCount > 0) throw new HttpError(409, "Vendor has bills and cannot be deleted.");
  await prisma.vendor.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
