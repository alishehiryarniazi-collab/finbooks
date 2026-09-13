import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireSuperAdmin } from "../middleware/auth";

// Platform (super-admin) API. These routes intentionally see ACROSS all tenants — the only
// place that bypasses per-org isolation — so the whole router is locked behind requireSuperAdmin.
export const adminRouter = Router();
adminRouter.use(requireSuperAdmin);

// Platform-wide totals for the admin dashboard.
adminRouter.get("/stats", async (_req, res) => {
  const [organizations, activeOrganizations, users, activeUsers, invoices, bills] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.invoice.count(),
    prisma.bill.count(),
  ]);
  res.json({
    stats: {
      organizations,
      activeOrganizations,
      suspendedOrganizations: organizations - activeOrganizations,
      users,
      activeUsers,
      invoices,
      bills,
    },
  });
});

// Every organization (tenant) with member/record counts, newest first.
adminRouter.get("/organizations", async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      baseCurrency: true,
      isActive: true,
      createdAt: true,
      _count: { select: { memberships: true, invoices: true, bills: true, customers: true } },
    },
  });
  res.json({ organizations: orgs });
});

// One organization in detail, including its members (for support/inspection).
adminRouter.get("/organizations/:id", async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      baseCurrency: true,
      isActive: true,
      email: true,
      phone: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          isActive: true,
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      },
      _count: { select: { invoices: true, bills: true, customers: true, vendors: true } },
    },
  });
  if (!org) throw new HttpError(404, "Organization not found.");
  res.json({ organization: org });
});

const activeSchema = z.object({ isActive: z.boolean() });

// Suspend or re-activate a tenant. Suspending blocks all of its members from using the app.
adminRouter.patch("/organizations/:id/active", async (req, res) => {
  const { isActive } = activeSchema.parse(req.body);
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
  res.json({ organization: org });
});

// Every user across the platform, newest first.
adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      isSuperAdmin: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });
  res.json({ users });
});

// Enable/disable a user account globally (blocks them from every company).
adminRouter.patch("/users/:id/active", async (req, res) => {
  const { isActive } = activeSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });
  res.json({ user });
});
