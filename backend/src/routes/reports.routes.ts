import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { financialAnalysis } from "../services/analysis";
import { trialBalance, profitAndLoss, balanceSheet, arAging, apAging, dashboard, taxSummary, costCenterReport, projectReport } from "../services/reports";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD for period reports.
const rangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

reportsRouter.get("/trial-balance", async (req, res) => {
  const range = rangeSchema.parse(req.query);
  res.json(await trialBalance(req.auth!.orgId, range));
});

reportsRouter.get("/profit-loss", async (req, res) => {
  const range = rangeSchema.parse(req.query);
  res.json(await profitAndLoss(req.auth!.orgId, range));
});

reportsRouter.get("/balance-sheet", async (req, res) => {
  const { to } = rangeSchema.parse(req.query);
  res.json(await balanceSheet(req.auth!.orgId, to));
});

reportsRouter.get("/ar-aging", async (req, res) => {
  res.json(await arAging(req.auth!.orgId));
});

reportsRouter.get("/ap-aging", async (req, res) => {
  res.json(await apAging(req.auth!.orgId));
});

reportsRouter.get("/dashboard", async (req, res) => {
  res.json(await dashboard(req.auth!.orgId));
});

reportsRouter.get("/tax-summary", async (req, res) => {
  const range = rangeSchema.parse(req.query);
  res.json(await taxSummary(req.auth!.orgId, range));
});

reportsRouter.get("/cost-centers", async (req, res) => {
  const range = rangeSchema.parse(req.query);
  res.json(await costCenterReport(req.auth!.orgId, range));
});

reportsRouter.get("/projects", async (req, res) => {
  const range = rangeSchema.parse(req.query);
  res.json(await projectReport(req.auth!.orgId, range));
});

reportsRouter.get("/analysis", async (req, res) => {
  res.json(await financialAnalysis(req.auth!.orgId));
});
