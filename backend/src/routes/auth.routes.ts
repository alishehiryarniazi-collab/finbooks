import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth } from "../middleware/auth";
import { signToken } from "../utils/jwt";
import { seedDefaultAccounts } from "../services/chartOfAccounts";

export const authRouter = Router();

const registerSchema = z.object({
  organizationName: z.string().min(2, "Organization name is too short"),
  name: z.string().min(2, "Your name is too short"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Register creates a new organization, its first ADMIN user, and a default
// chart of accounts — all atomically so a half-created org can never exist.
authRouter.post("/register", async (req, res) => {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, "An account with this email already exists.");

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: data.organizationName } });
    await seedDefaultAccounts(org.id, tx);
    return tx.user.create({
      data: {
        orgId: org.id,
        name: data.name,
        email: data.email,
        passwordHash,
        role: "ADMIN",
      },
      include: { organization: true },
    });
  });

  const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

authRouter.post("/login", async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: { organization: true },
  });
  // Same error whether the email or password is wrong — don't leak which emails exist.
  if (!user) throw new HttpError(401, "Invalid email or password.");
  if (!user.isActive) throw new HttpError(403, "Your account is deactivated. Contact an admin.");

  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid email or password.");

  const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
  res.json({ token, user: publicUser(user) });
});

// Returns the currently authenticated user (used by the frontend on app load).
authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { organization: true },
  });
  if (!user) throw new HttpError(401, "Invalid or expired token");
  res.json({ user: publicUser(user) });
});

// Strips the password hash before sending a user to the client.
function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  orgId: string;
  organization?: { id: string; name: string; baseCurrency: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
    organization: user.organization
      ? {
          id: user.organization.id,
          name: user.organization.name,
          baseCurrency: user.organization.baseCurrency,
        }
      : null,
  };
}
