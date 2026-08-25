# PROJECT_NOTES — FinBooks

Running context for the project so any new session has instant background.

## Purpose
A small-business **double-entry accounting system** built as a serious portfolio piece.
Real bookkeeping: chart of accounts, balanced journal entries, a general ledger that is the
single source of truth, invoicing (AR), bills (AP), payments, and financial reports.

## Feature set (as of Aug 2026)
Smart Vouchers (period lock, negative-cash/duplicate-ref confirmable guards, auto-balance) ·
Cost Accounting (cost centers + projects, profit-by-cost-center & project P&L) ·
Financial Analyst (ratios, trends, health score, auto-insights) · Tax rates + Tax Report ·
Localization EN/UR/AR with RTL (shell/dashboard/auth done; rest pending) ·
Multi-company (one login → many companies via Membership + topbar switcher) ·
Auth + roles (Admin/Accountant/Viewer) · 3-level Chart of Accounts (leaf-only posting) ·
Opening balances · Journal / Debit / Credit vouchers · General Ledger (statement w/ opening
balance) · Customers & Vendors (search + edit/delete) · Invoices & Bills (draft edit/delete,
auto-numbering, post to ledger, payments, void, PDF/print) · Reports: Trial Balance, P&L,
Balance Sheet, AR/AP Aging (all CSV-exportable) · Dashboard · Company Settings (profile,
currency, logo). Themed custom dropdowns app-wide. ESLint + Prettier; Vitest unit tests for
the posting engine + money math. NOT pushed to GitHub yet (by request).

## Tech stack
- **Backend:** Node.js + Express + TypeScript, Prisma ORM, **MySQL**, JWT auth, zod validation.
- **Frontend:** React + Vite + TypeScript, Tailwind CSS (Aurora dark-glass style), React Router,
  axios, Recharts.
- Mirrors the conventions of the existing `farmers-app` (createApp(), HttpError, requireAuth/requireRole).

## Folder structure
```
accounting-system/
  backend/
    prisma/schema.prisma      # full data model (MySQL)
    prisma/seed.ts            # demo org + admin/accountant/viewer + sample books
    src/
      app.ts server.ts env.ts prisma.ts
      middleware/ (auth, error)
      utils/ (jwt, money)      # money.ts = Prisma.Decimal helpers (no floats)
      services/                # posting (core), invoices, bills, reports, chartOfAccounts
      routes/                  # auth, users, accounts, journal, customers, vendors,
                               # invoices, bills, payments, reports
  frontend/
    src/
      lib/ (api, format, types)
      context/AuthContext.tsx
      hooks/useFetch.ts
      components/ui/           # Aurora kit: Card, Button, Field, Badge, DataTable, Modal, ...
      components/layout/       # AppLayout, Sidebar, ProtectedRoute
      pages/                   # login, register, dashboard, accounts, journal, customers,
                               # invoices, vendors, bills, payments, reports, team
```

## Key design decisions
- **General Ledger is the single source of truth.** Invoices/bills/payments POST balanced
  journal entries; all reports are computed from journal lines.
- **Money = `DECIMAL(18,2)`** via Prisma.Decimal. Never floats.
- Every journal entry must satisfy **Σ debits = Σ credits**, enforced in `services/posting.ts`
  inside a `prisma.$transaction` (atomic).
- **Posted entries are immutable** — corrections are reversing entries / voids.
- Multi-tenant: an **Organization** owns the books; **Users** have roles ADMIN / ACCOUNTANT / VIEWER.
- Bill input tax is posted as a debit to Sales Tax Payable (net-VAT treatment).

## How to run (local)
1. Ensure a **MySQL server** is running (XAMPP / MySQL Community / Docker) and note its
   user/password/port. Update `backend/.env` `DATABASE_URL` accordingly.
2. Backend:
   ```
   cd backend
   npm install
   npx prisma migrate dev --name init   # creates the "finbooks" schema + tables
   npm run db:seed                       # loads the demo company
   npm run dev                           # http://localhost:4001
   ```
3. Frontend:
   ```
   cd frontend
   npm install
   npm run dev                           # http://localhost:5173
   ```
4. Log in: **demo@finbooks.app / demo1234** (admin). Also accountant@ / viewer@ (same password).

## Status — RUNNING & VERIFIED (2026-08-25)
- [x] Backend: full schema, auth, accounts, journal + posting engine, AR, AP, payments, reports.
- [x] Frontend: auth, dashboard, all modules and reports, Aurora UI, role-aware actions.
- [x] Both backend and frontend typecheck clean.
- [x] MySQL 8 (Community) installed locally; `prisma migrate dev` + seed applied.
- [x] **Verified end-to-end:** trial balance balances (59,470 = 59,470); balance sheet balances
      (assets 56,870 = liabilities 1,230 + equity 55,640); an unbalanced entry is rejected (400);
      VIEWER role is blocked from writes (403). Dashboard loads live data in the browser.

Local ports: **backend :4001**, **frontend :5173/5174** (Vite auto-picks a free one; another
local app already uses 4000, hence 4001).

## TODO / next
- Add ESLint + Prettier configs.
- Add a few screenshots / short GIF to the README now that it runs.
- Later: CSV export of reports, invoice PDF, closing entries for fiscal year, edit/delete on
  customers & vendors from the UI.
