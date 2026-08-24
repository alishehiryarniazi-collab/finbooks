import type { AccountType, NormalBalance, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Well-known account codes the automation relies on. Invoice/bill/payment posting
// looks these up by code, so they must exist in every organization's chart.
export const SYSTEM_CODES = {
  CASH: "1000",
  BANK: "1010",
  ACCOUNTS_RECEIVABLE: "1200",
  ACCOUNTS_PAYABLE: "2000",
  SALES_TAX_PAYABLE: "2100",
  SALES_REVENUE: "4000",
} as const;

interface SeedAccount {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  subtype?: string;
}

// A standard small-business chart of accounts. Codes follow the usual convention:
// 1xxx assets, 2xxx liabilities, 3xxx equity, 4xxx income, 5xxx COGS, 6xxx expenses.
export const DEFAULT_ACCOUNTS: SeedAccount[] = [
  // Assets (debit-normal)
  { code: "1000", name: "Cash", type: "ASSET", normalBalance: "DEBIT", subtype: "Cash" },
  { code: "1010", name: "Bank Account", type: "ASSET", normalBalance: "DEBIT", subtype: "Bank" },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", normalBalance: "DEBIT", subtype: "Accounts Receivable" },
  { code: "1400", name: "Inventory", type: "ASSET", normalBalance: "DEBIT", subtype: "Inventory" },
  { code: "1500", name: "Equipment", type: "ASSET", normalBalance: "DEBIT", subtype: "Fixed Asset" },

  // Liabilities (credit-normal)
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT", subtype: "Accounts Payable" },
  { code: "2100", name: "Sales Tax Payable", type: "LIABILITY", normalBalance: "CREDIT", subtype: "Tax" },
  { code: "2200", name: "Loans Payable", type: "LIABILITY", normalBalance: "CREDIT", subtype: "Loan" },

  // Equity (credit-normal)
  { code: "3000", name: "Owner's Equity", type: "EQUITY", normalBalance: "CREDIT" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", normalBalance: "CREDIT" },

  // Income (credit-normal)
  { code: "4000", name: "Sales Revenue", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4100", name: "Service Revenue", type: "INCOME", normalBalance: "CREDIT" },
  { code: "4200", name: "Other Income", type: "INCOME", normalBalance: "CREDIT" },

  // Cost of goods sold + expenses (debit-normal)
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", normalBalance: "DEBIT", subtype: "COGS" },
  { code: "6000", name: "Rent Expense", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "6100", name: "Salaries & Wages", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "6200", name: "Utilities", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "6300", name: "Office Supplies", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "6400", name: "Advertising & Marketing", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "6900", name: "Miscellaneous Expense", type: "EXPENSE", normalBalance: "DEBIT" },
];

// Inserts the default chart for a new organization. Safe to call once at org creation.
export async function seedDefaultAccounts(orgId: string, db: Db) {
  await db.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a) => ({ ...a, orgId })),
  });
}
