import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";
import { SYSTEM_CODES } from "../services/chartOfAccounts";

export const taxRatesRouter = Router();
taxRatesRouter.use(requireAuth);

// Named tax presets (e.g. "GST 17%"). Invoice/bill lines still store the plain percent, so
// these are convenient reusable presets — changing a rate never rewrites past documents.
taxRatesRouter.get("/", async (req, res) => {
  const taxRates = await prisma.taxRate.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { name: "asc" },
  });
  res.json({ taxRates });
});

const upsertSchema = z.object({
  name: z.string().min(1).max(60),
  ratePercent: z.coerce.number().min(0).max(100),
  isActive: z.boolean().optional(),
});

// The collected/paid tax accrues in the Sales Tax Payable account (the posting engine already
// uses this account), so we attach new rates to it automatically.
async function salesTaxAccountId(orgId: string) {
  const acc = await prisma.account.findFirst({
    where: { orgId, code: SYSTEM_CODES.SALES_TAX_PAYABLE },
    select: { id: true },
  });
  if (!acc) throw new HttpError(400, "Sales Tax Payable account is missing from the chart.");
  return acc.id;
}

taxRatesRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.parse(req.body);
  const orgId = req.auth!.orgId;
  const accountId = await salesTaxAccountId(orgId);
  const taxRate = await prisma.taxRate.create({
    data: { orgId, name: data.name, ratePercent: data.ratePercent, accountId },
  });
  res.status(201).json({ taxRate });
});

taxRatesRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = upsertSchema.partial().parse(req.body);
  const existing = await prisma.taxRate.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Tax rate not found.");
  const taxRate = await prisma.taxRate.update({ where: { id: existing.id }, data });
  res.json({ taxRate });
});

// Safe to delete: documents store the percent themselves, so removing a preset changes nothing historical.
taxRatesRouter.delete("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const existing = await prisma.taxRate.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Tax rate not found.");
  await prisma.taxRate.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
