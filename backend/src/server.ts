import { createApp } from "./app";
import { env } from "./env";
import { prisma } from "./prisma";
import { startRecurringScheduler } from "./services/recurring";

async function main() {
  // Verify the database connection at boot so problems surface immediately.
  await prisma.$connect();
  console.log("✓ Connected to MySQL");

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`✓ FinBooks API running on http://localhost:${env.port}`);
    // Generate any due recurring invoices now, then every day.
    startRecurringScheduler();
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
