import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Everyone in the org can see the team list.
usersRouter.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  res.json({ users });
});

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "ACCOUNTANT", "VIEWER"]),
});

// Only an ADMIN can add teammates. The new user joins the admin's organization.
usersRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = createSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, "A user with this email already exists.");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { orgId: req.auth!.orgId, name: data.name, email: data.email, passwordHash, role: data.role },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  res.status(201).json({ user });
});

const updateSchema = z.object({
  role: z.enum(["ADMIN", "ACCOUNTANT", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

// Admin can change a teammate's role or deactivate them — but not themselves,
// so an org can never lock out its last admin by accident.
usersRouter.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const data = updateSchema.parse(req.body);
  if (req.params.id === req.auth!.userId) {
    throw new HttpError(400, "You can't change your own role or status.");
  }
  const target = await prisma.user.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!target) throw new HttpError(404, "User not found.");

  const user = await prisma.user.update({
    where: { id: target.id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  res.json({ user });
});
