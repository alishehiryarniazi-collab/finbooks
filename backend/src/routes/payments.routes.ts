import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

// Read-only list of every payment (received + made). Payments are created through the
// invoice/bill routes so they always stay tied to a document and a journal entry.
paymentsRouter.get("/", async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { orgId: req.auth!.orgId },
    orderBy: { date: "desc" },
    include: {
      bankAccount: { select: { code: true, name: true } },
      allocations: { include: { invoice: { select: { number: true } }, bill: { select: { number: true } } } },
    },
  });
  res.json({ payments });
});
