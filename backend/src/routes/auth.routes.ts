import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import { signToken } from "../utils/jwt";
import { seedDefaultAccounts } from "../services/chartOfAccounts";

export const authRouter = Router();

// Builds the client-facing user object for a given ACTIVE company: identity + the active
// company's role/profile + the full list of companies this user can switch between.
async function buildAuthUser(userId: string, activeOrgId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new HttpError(401, "Invalid or expired token");

  const memberships = await prisma.membership.findMany({
    where: { userId, isActive: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  const active = memberships.find((m) => m.orgId === activeOrgId) ?? memberships[0];
  if (!active) throw new HttpError(403, "You are not a member of any company.");

  const org = active.organization;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: active.role,
    orgId: active.orgId,
    organization: {
      id: org.id,
      name: org.name,
      baseCurrency: org.baseCurrency,
      address: org.address ?? null,
      phone: org.phone ?? null,
      email: org.email ?? null,
      logoDataUrl: org.logoDataUrl ?? null,
      booksLockedBefore: org.booksLockedBefore ? org.booksLockedBefore.toISOString().slice(0, 10) : null,
    },
    companies: memberships.map((m) => ({ orgId: m.orgId, name: m.organization.name, role: m.role })),
  };
}

const registerSchema = z.object({
  organizationName: z.string().min(2, "Organization name is too short"),
  name: z.string().min(2, "Your name is too short"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Register creates a new company, a global user, an ADMIN membership linking them, and a
// default chart of accounts — all atomically.
authRouter.post("/register", async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, "An account with this email already exists.");

  const passwordHash = await bcrypt.hash(data.password, 10);

  const { userId, orgId } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: data.organizationName } });
    await seedDefaultAccounts(org.id, tx);
    const user = await tx.user.create({ data: { name: data.name, email: data.email, passwordHash } });
    await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: "ADMIN" } });
    return { userId: user.id, orgId: org.id };
  });

  const token = signToken({ userId, orgId, role: "ADMIN" });
  res.status(201).json({ token, user: await buildAuthUser(userId, orgId) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

authRouter.post("/login", async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  // Same error whether the email or password is wrong — don't leak which emails exist.
  if (!user) throw new HttpError(401, "Invalid email or password.");
  if (!user.isActive) throw new HttpError(403, "Your account is deactivated. Contact an admin.");

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid email or password.");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) throw new HttpError(403, "You are not a member of any company.");

  const active = memberships[0];
  const token = signToken({ userId: user.id, orgId: active.orgId, role: active.role });
  res.json({ token, user: await buildAuthUser(user.id, active.orgId) });
});

// Returns the currently authenticated user for the active company (used on app load).
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: await buildAuthUser(req.auth!.userId, req.auth!.orgId) });
});

const switchSchema = z.object({ orgId: z.string().min(1) });

// Switch the active company: verify membership, re-issue a token scoped to that company.
authRouter.post("/switch", requireAuth, async (req, res) => {
  const { orgId } = switchSchema.parse(req.body);
  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: req.auth!.userId, orgId } },
  });
  if (!membership || !membership.isActive) {
    throw new HttpError(403, "You don't have access to that company.");
  }
  const token = signToken({ userId: req.auth!.userId, orgId, role: membership.role });
  res.json({ token, user: await buildAuthUser(req.auth!.userId, orgId) });
});

const createCompanySchema = z.object({ name: z.string().min(2, "Company name is too short") });

// Create a brand-new company owned by the logged-in user (they become its ADMIN).
authRouter.post("/companies", requireAuth, async (req, res) => {
  const { name } = createCompanySchema.parse(req.body);
  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({ data: { name } });
    await seedDefaultAccounts(created.id, tx);
    await tx.membership.create({ data: { userId: req.auth!.userId, orgId: created.id, role: "ADMIN" } });
    return created;
  });
  res.status(201).json({ organization: { id: org.id, name: org.name } });
});
