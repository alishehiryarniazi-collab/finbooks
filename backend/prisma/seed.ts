import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma";
import { seedDefaultAccounts, SYSTEM_CODES } from "../src/services/chartOfAccounts";
import { createInvoice, postInvoice, recordInvoicePayment } from "../src/services/invoices";
import { createBill, postBill, recordBillPayment } from "../src/services/bills";
import { postEntry } from "../src/services/posting";

const DEMO_ADMIN_EMAIL = "demo@finbooks.app";

// Days ago -> Date, so demo data spreads across recent months for a nice trend chart.
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function wipeExistingDemo() {
  const admin = await prisma.user.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });
  if (!admin) return;
  const orgId = admin.orgId;

  // Delete in FK-safe order (children first). Invoice/Bill/JournalEntry lines cascade.
  await prisma.paymentAllocation.deleteMany({ where: { payment: { orgId } } });
  await prisma.payment.deleteMany({ where: { orgId } });
  await prisma.invoice.deleteMany({ where: { orgId } });
  await prisma.bill.deleteMany({ where: { orgId } });
  await prisma.journalEntry.deleteMany({ where: { orgId } });
  await prisma.taxRate.deleteMany({ where: { orgId } });
  await prisma.account.deleteMany({ where: { orgId } });
  await prisma.customer.deleteMany({ where: { orgId } });
  await prisma.vendor.deleteMany({ where: { orgId } });
  await prisma.user.deleteMany({ where: { orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  console.log("• Cleared previous demo data");
}

async function main() {
  await wipeExistingDemo();

  // --- Organization + default chart of accounts ---
  const org = await prisma.organization.create({ data: { name: "FinBooks Demo Co." } });
  await seedDefaultAccounts(org.id, prisma);
  console.log("• Created organization + chart of accounts");

  // --- Users (one per role) ---
  const hash = (pw: string) => bcrypt.hash(pw, 10);
  const admin = await prisma.user.create({
    data: { orgId: org.id, name: "Demo Admin", email: DEMO_ADMIN_EMAIL, passwordHash: await hash("demo1234"), role: "ADMIN" },
  });
  await prisma.user.create({
    data: { orgId: org.id, name: "Aisha Accountant", email: "accountant@finbooks.app", passwordHash: await hash("demo1234"), role: "ACCOUNTANT" },
  });
  await prisma.user.create({
    data: { orgId: org.id, name: "Vince Viewer", email: "viewer@finbooks.app", passwordHash: await hash("demo1234"), role: "VIEWER" },
  });
  console.log("• Created users (admin / accountant / viewer)");

  // Handy account lookups by code.
  const accounts = await prisma.account.findMany({ where: { orgId: org.id } });
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const acc = (code: string) => byCode.get(code)!.id;

  // --- Opening capital: owner invests 50,000 into the bank ---
  await postEntry({
    orgId: org.id,
    createdById: admin.id,
    date: daysAgo(120),
    memo: "Owner capital investment",
    reference: "OPEN-1",
    lines: [
      { accountId: acc(SYSTEM_CODES.BANK), debit: 50000 },
      { accountId: acc("3000"), credit: 50000 },
    ],
  });

  // --- Customers ---
  const customers = await Promise.all(
    [
      { name: "Northwind Traders", email: "ap@northwind.example" },
      { name: "Umbrella Retail", email: "billing@umbrella.example" },
      { name: "Skyline Cafe", email: "owner@skyline.example" },
    ].map((c) => prisma.customer.create({ data: { ...c, orgId: org.id } })),
  );

  // --- Vendors ---
  const vendors = await Promise.all(
    [
      { name: "CityPower Utilities", email: "billing@citypower.example" },
      { name: "OfficeMart Supplies", email: "sales@officemart.example" },
      { name: "Prime Landlord LLC", email: "rent@primeland.example" },
    ].map((v) => prisma.vendor.create({ data: { ...v, orgId: org.id } })),
  );
  console.log("• Created customers + vendors");

  // --- Invoices (posted; some paid / partially paid) ---
  const salesAcc = acc(SYSTEM_CODES.SALES_REVENUE);
  const serviceAcc = acc("4100");
  const bank = acc(SYSTEM_CODES.BANK);

  const inv1 = await createInvoice(org.id, {
    customerId: customers[0].id, number: "INV-1001", issueDate: daysAgo(80), dueDate: daysAgo(50),
    lines: [{ description: "Wholesale goods", quantity: 100, unitPrice: 45, taxRatePercent: 10, incomeAccountId: salesAcc }],
  });
  await postInvoice(org.id, admin.id, inv1.id);
  await recordInvoicePayment(org.id, admin.id, inv1.id, { date: daysAgo(40), amount: 4950, bankAccountId: bank });

  const inv2 = await createInvoice(org.id, {
    customerId: customers[1].id, number: "INV-1002", issueDate: daysAgo(55), dueDate: daysAgo(25),
    lines: [
      { description: "Retail stock", quantity: 60, unitPrice: 30, taxRatePercent: 10, incomeAccountId: salesAcc },
      { description: "Setup service", quantity: 1, unitPrice: 500, incomeAccountId: serviceAcc },
    ],
  });
  await postInvoice(org.id, admin.id, inv2.id);
  await recordInvoicePayment(org.id, admin.id, inv2.id, { date: daysAgo(20), amount: 1000, bankAccountId: bank });

  const inv3 = await createInvoice(org.id, {
    customerId: customers[2].id, number: "INV-1003", issueDate: daysAgo(20), dueDate: daysAgo(-10),
    lines: [{ description: "Consulting", quantity: 12, unitPrice: 120, incomeAccountId: serviceAcc }],
  });
  await postInvoice(org.id, admin.id, inv3.id);
  console.log("• Created + posted invoices (with payments)");

  // --- Bills (posted; some paid) ---
  const rentAcc = acc("6000");
  const utilAcc = acc("6200");
  const suppliesAcc = acc("6300");

  const bill1 = await createBill(org.id, {
    vendorId: vendors[2].id, number: "BILL-2001", billDate: daysAgo(75), dueDate: daysAgo(45),
    lines: [{ description: "Office rent - month", quantity: 1, unitPrice: 2000, expenseAccountId: rentAcc }],
  });
  await postBill(org.id, admin.id, bill1.id);
  await recordBillPayment(org.id, admin.id, bill1.id, { date: daysAgo(44), amount: 2000, bankAccountId: bank });

  const bill2 = await createBill(org.id, {
    vendorId: vendors[0].id, number: "BILL-2002", billDate: daysAgo(30), dueDate: daysAgo(0),
    lines: [{ description: "Electricity", quantity: 1, unitPrice: 340, taxRatePercent: 10, expenseAccountId: utilAcc }],
  });
  await postBill(org.id, admin.id, bill2.id);

  const bill3 = await createBill(org.id, {
    vendorId: vendors[1].id, number: "BILL-2003", billDate: daysAgo(15), dueDate: daysAgo(-15),
    lines: [{ description: "Stationery & supplies", quantity: 1, unitPrice: 260, expenseAccountId: suppliesAcc }],
  });
  await postBill(org.id, admin.id, bill3.id);
  console.log("• Created + posted bills (with payments)");

  console.log("\n✓ Seed complete. Log in with:");
  console.log("   Admin      -> demo@finbooks.app / demo1234");
  console.log("   Accountant -> accountant@finbooks.app / demo1234");
  console.log("   Viewer     -> viewer@finbooks.app / demo1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
