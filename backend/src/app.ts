import "express-async-errors";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { usersRouter } from "./routes/users.routes";
import { accountsRouter } from "./routes/accounts.routes";
import { journalRouter } from "./routes/journal.routes";
import { customersRouter } from "./routes/customers.routes";
import { vendorsRouter } from "./routes/vendors.routes";
import { invoicesRouter } from "./routes/invoices.routes";
import { billsRouter } from "./routes/bills.routes";
import { paymentsRouter } from "./routes/payments.routes";
import { reportsRouter } from "./routes/reports.routes";
import { organizationRouter } from "./routes/organization.routes";
import { errorHandler, notFoundHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  // 2mb so an inline company logo (base64 data URL) fits; default is only 100kb.
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "finbooks-api" }));

  // Feature routers
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/accounts", accountsRouter);
  app.use("/api/journal", journalRouter);
  app.use("/api/customers", customersRouter);
  app.use("/api/vendors", vendorsRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/bills", billsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/organization", organizationRouter);

  app.use(notFoundHandler);

  // Turn zod validation errors into 400s instead of falling through to the 500 handler.
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.flatten() });
      return;
    }
    next(err);
  });

  app.use(errorHandler);

  return app;
}
