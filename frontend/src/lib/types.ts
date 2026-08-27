// Shared types mirroring the backend API shapes.

export type Role = "ADMIN" | "ACCOUNTANT" | "VIEWER";
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export interface Organization {
  id: string;
  name: string;
  baseCurrency: string;
  fiscalYearStartMonth?: number;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoDataUrl: string | null;
  booksLockedBefore?: string | null;
}

export interface CompanyRef {
  orgId: string;
  name: string;
  role: Role;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role; // role in the ACTIVE company
  orgId: string; // active company
  organization: Organization | null; // active company profile
  companies: CompanyRef[]; // all companies this user can switch between
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: string | null;
  normalBalance: "DEBIT" | "CREDIT";
  parentId: string | null;
  isPostable: boolean; // only leaf (level-3) accounts can receive postings
  isActive: boolean;
  debit: string;
  credit: string;
  balance: string;
}

export type VoucherType = "JOURNAL" | "DEBIT" | "CREDIT";

export interface TaxRate {
  id: string;
  name: string;
  ratePercent: string;
  isActive: boolean;
}

export interface CostCenter {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
  isActive: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string | null;
  account?: { code: string; name: string };
}

export interface JournalEntry {
  id: string;
  date: string;
  memo: string | null;
  reference: string | null;
  status: "DRAFT" | "POSTED" | "VOID";
  source: string;
  voucherType: VoucherType;
  lines: JournalLine[];
  createdBy?: { name: string };
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  // Payment / beneficiary details (optional).
  paymentMethod: string | null;
  bankName: string | null;
  accountTitle: string | null;
  accountNumber: string | null;
  iban: string | null;
  raastId: string | null;
}

export type Vendor = Customer;

export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "VOID";
export type BillStatus = "DRAFT" | "OPEN" | "PARTIAL" | "PAID" | "VOID";

export interface Invoice {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  customer?: { name: string };
  customerId: string;
  lines?: DocumentLine[];
}

export interface Bill {
  id: string;
  number: string;
  billDate: string;
  dueDate: string;
  status: BillStatus;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  vendor?: Vendor;
  vendorId: string;
  lines?: DocumentLine[];
}

export interface DocumentLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRatePercent: string;
  lineTotal: string;
  incomeAccount?: { code: string; name: string };
  expenseAccount?: { code: string; name: string };
}
