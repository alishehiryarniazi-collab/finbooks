import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../middleware/error";
import { requireAuth, requireRole } from "../middleware/auth";

// --- Cost Centers ----------------------------------------------------------
export const costCentersRouter = Router();
costCentersRouter.use(requireAuth);

const ccSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().max(20).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

costCentersRouter.get("/", async (req, res) => {
  const costCenters = await prisma.costCenter.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { name: "asc" },
  });
  res.json({ costCenters });
});

costCentersRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = ccSchema.parse(req.body);
  const costCenter = await prisma.costCenter.create({
    data: { orgId: req.auth!.orgId, name: data.name, code: data.code || null },
  });
  res.status(201).json({ costCenter });
});

costCentersRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = ccSchema.partial().parse(req.body);
  const existing = await prisma.costCenter.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Cost center not found.");
  const costCenter = await prisma.costCenter.update({
    where: { id: existing.id },
    data: { ...data, code: data.code === "" ? null : data.code },
  });
  res.json({ costCenter });
});

costCentersRouter.delete("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const existing = await prisma.costCenter.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Cost center not found.");
  const used = await prisma.journalLine.count({ where: { costCenterId: existing.id } });
  if (used > 0) throw new HttpError(409, "This cost center is used by transactions. Deactivate it instead.");
  await prisma.costCenter.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// --- Projects --------------------------------------------------------------
export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const projectSchema = z.object({
  name: z.string().min(1).max(80),
  code: z.string().max(20).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "COMPLETED", "ON_HOLD"]).optional(),
  isActive: z.boolean().optional(),
});

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { name: "asc" },
  });
  res.json({ projects });
});

projectsRouter.post("/", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = projectSchema.parse(req.body);
  const project = await prisma.project.create({
    data: { orgId: req.auth!.orgId, name: data.name, code: data.code || null, status: data.status ?? "ACTIVE" },
  });
  res.status(201).json({ project });
});

projectsRouter.patch("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const data = projectSchema.partial().parse(req.body);
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Project not found.");
  const project = await prisma.project.update({
    where: { id: existing.id },
    data: { ...data, code: data.code === "" ? null : data.code },
  });
  res.json({ project });
});

projectsRouter.delete("/:id", requireRole("ADMIN", "ACCOUNTANT"), async (req, res) => {
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, orgId: req.auth!.orgId } });
  if (!existing) throw new HttpError(404, "Project not found.");
  const used = await prisma.journalLine.count({ where: { projectId: existing.id } });
  if (used > 0) throw new HttpError(409, "This project is used by transactions. Deactivate it instead.");
  await prisma.project.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});
