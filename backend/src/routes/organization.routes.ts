import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";

export const organizationRouter = Router();
organizationRouter.use(requireAuth);

// Current organization's profile.
organizationRouter.get("/", async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.auth!.orgId } });
  if (!org) throw new HttpError(404, "Organization not found.");
  res.json({ organization: org });
});

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  baseCurrency: z.string().min(1).max(8).optional(), // ISO code, e.g. USD / PKR / EUR
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12).optional(),
  address: z.string().max(500).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  logoDataUrl: z.string().max(500_000).optional().or(z.literal("")), // inline data URL (small)
});

// Only ADMIN can change company settings.
organizationRouter.patch("/", requireRole("ADMIN"), async (req, res) => {
  const data = updateSchema.parse(req.body);

  // Normalise empty strings to null so cleared fields don't linger.
  const normalized = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]),
  );

  const org = await prisma.organization.update({
    where: { id: req.auth!.orgId },
    data: normalized,
  });
  res.json({ organization: org });
});
