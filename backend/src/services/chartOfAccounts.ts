import type { AccountType, NormalBalance, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// Well-known LEAF (postable) account codes the automation relies on. Invoice/bill/payment
// posting looks these up by code, so they must exist as postable accounts in every org.
export const SYSTEM_CODES = {
  CASH: "1000",
  BANK: "1010",
  ACCOUNTS_RECEIVABLE: "1200",
  ACCOUNTS_PAYABLE: "2000",
  SALES_TAX_PAYABLE: "2100",
  SALES_REVENUE: "4000",
  OPENING_BALANCE_EQUITY: "3200",
} as const;

// Debit-normal for assets & expenses; credit-normal for the rest.
function normalFor(type: AccountType): NormalBalance {
  return type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT";
}

// A node in the default chart. A node WITH children is a group (not postable);
// a leaf node is a postable detail account.
interface SeedNode {
  code: string;
  name: string;
  subtype?: string;
  children?: SeedNode[];
}

// Standard small-business chart, three levels deep:
//   Level 1 = major category, Level 2 = sub-group, Level 3 = postable detail account.
export const DEFAULT_TREE: { type: AccountType; groups: SeedNode[] }[] = [
  {
    type: "ASSET",
    groups: [
      {
        code: "1", name: "Assets",
        children: [
          {
            code: "10", name: "Current Assets",
            children: [
              { code: "1000", name: "Cash", subtype: "Cash" },
              { code: "1010", name: "Bank Account", subtype: "Bank" },
              { code: "1200", name: "Accounts Receivable", subtype: "Accounts Receivable" },
              { code: "1400", name: "Inventory", subtype: "Inventory" },
            ],
          },
          {
            code: "15", name: "Fixed Assets",
            children: [{ code: "1500", name: "Equipment", subtype: "Fixed Asset" }],
          },
        ],
      },
    ],
  },
  {
    type: "LIABILITY",
    groups: [
      {
        code: "2", name: "Liabilities",
        children: [
          {
            code: "20", name: "Current Liabilities",
            children: [
              { code: "2000", name: "Accounts Payable", subtype: "Accounts Payable" },
              { code: "2100", name: "Sales Tax Payable", subtype: "Tax" },
            ],
          },
          {
            code: "22", name: "Long-term Liabilities",
            children: [{ code: "2200", name: "Loans Payable", subtype: "Loan" }],
          },
        ],
      },
    ],
  },
  {
    type: "EQUITY",
    groups: [
      {
        code: "3", name: "Equity",
        children: [
          {
            code: "30", name: "Owner's Equity",
            children: [
              { code: "3000", name: "Owner's Capital" },
              { code: "3100", name: "Retained Earnings" },
              { code: "3200", name: "Opening Balance Equity" },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "INCOME",
    groups: [
      {
        code: "4", name: "Income",
        children: [
          {
            code: "40", name: "Operating Revenue",
            children: [
              { code: "4000", name: "Sales Revenue" },
              { code: "4100", name: "Service Revenue" },
            ],
          },
          {
            code: "42", name: "Other Income",
            children: [{ code: "4200", name: "Other Income" }],
          },
        ],
      },
    ],
  },
  {
    type: "EXPENSE",
    groups: [
      {
        code: "5", name: "Expenses",
        children: [
          {
            code: "50", name: "Cost of Sales",
            children: [{ code: "5000", name: "Cost of Goods Sold", subtype: "COGS" }],
          },
          {
            code: "60", name: "Operating Expenses",
            children: [
              { code: "6000", name: "Rent Expense" },
              { code: "6100", name: "Salaries & Wages" },
              { code: "6200", name: "Utilities" },
              { code: "6300", name: "Office Supplies" },
              { code: "6400", name: "Advertising & Marketing" },
              { code: "6900", name: "Miscellaneous Expense" },
            ],
          },
        ],
      },
    ],
  },
];

// Recursively creates a node and its descendants. A node is postable only if it's a leaf.
async function createNode(
  db: Db,
  orgId: string,
  type: AccountType,
  node: SeedNode,
  parentId: string | null,
) {
  const created = await db.account.create({
    data: {
      orgId,
      code: node.code,
      name: node.name,
      type,
      subtype: node.subtype,
      normalBalance: normalFor(type),
      parentId,
      isPostable: !node.children || node.children.length === 0,
    },
  });
  for (const child of node.children ?? []) {
    await createNode(db, orgId, type, child, created.id);
  }
}

// Seeds the full 3-level default chart for a new organization.
export async function seedDefaultAccounts(orgId: string, db: Db) {
  for (const { type, groups } of DEFAULT_TREE) {
    for (const group of groups) {
      await createNode(db, orgId, type, group, null);
    }
  }
}
