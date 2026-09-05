import { prisma } from "../prisma";

// Generates the next sequential document number for an org, e.g. "INV-0001".
// Looks at existing numbers with the same prefix, takes the highest numeric suffix, +1.
// Good enough for a single-tenant local app; the unique constraint is the final guard.
export async function nextDocumentNumber(
  orgId: string,
  kind: "INVOICE" | "BILL" | "ESTIMATE",
): Promise<string> {
  const prefix = kind === "INVOICE" ? "INV-" : kind === "BILL" ? "BILL-" : "EST-";

  const rows =
    kind === "INVOICE"
      ? await prisma.invoice.findMany({
          where: { orgId, number: { startsWith: prefix } },
          select: { number: true },
        })
      : kind === "BILL"
        ? await prisma.bill.findMany({
            where: { orgId, number: { startsWith: prefix } },
            select: { number: true },
          })
        : await prisma.estimate.findMany({
            where: { orgId, number: { startsWith: prefix } },
            select: { number: true },
          });

  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.number.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
