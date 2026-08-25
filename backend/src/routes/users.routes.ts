import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(requireAuth);

// Team = the memberships of the ACTIVE company (role lives on the membership).
usersRouter.get("/", async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { orgId: req.auth!.orgId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const users = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    isActive: m.isActive,
  }));
  res.json({ users });
});

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "ACCOUNTANT", "VIEWER"]),
});

// Only an ADMIN can add teammates to the current company. If the email already belongs to a
// global user, we just add a membership; otherwise we create the user too.
usersRouter.post("/", requireRole("ADMIN"), async (req, res) => {
  const data = createSchema.parse(req.body);
  const orgId = req.auth!.orgId;

  let user = await prisma.user.findUnique({ where: { email: data.email } });
  if (user) {
    const already = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });
    if (already) throw new HttpError(409, "This person is already a member of this company.");
    await prisma.membership.create({ data: { userId: user.id, orgId, role: data.role } });
  } else {
    const passwordHash = await bcrypt.hash(data.password, 10);
    user = await prisma.user.create({ data: { name: data.name, email: data.email, passwordHash } });
    await prisma.membership.create({ data: { userId: user.id, orgId, role: data.role } });
  }

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: data.role, isActive: true },
  });
});

const updateSchema = z.object({
  role: z.enum(["ADMIN", "ACCOUNTANT", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

// Admin changes a teammate's role or per-company access — but not their own membership,
// so a company can never lock out its last admin by accident.
usersRouter.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const data = updateSchema.parse(req.body);
  const orgId = req.auth!.orgId;
  if (req.params.id === req.auth!.userId) {
    throw new HttpError(400, "You can't change your own role or status.");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: req.params.id, orgId } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!membership) throw new HttpError(404, "User not found in this company.");

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json({
    user: {
      id: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
      isActive: updated.isActive,
    },
  });
});
