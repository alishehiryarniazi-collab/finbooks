# PROJECT_NOTES — FinBooks

Running context for the project so any new session has instant background.

## Purpose
A small-business **double-entry accounting system** built as a serious portfolio piece.
Real bookkeeping: chart of accounts, balanced journal entries, a general ledger that is the
single source of truth, invoicing (AR), bills (AP), payments, and financial reports.

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

## Status
- [x] Backend: full schema, auth, accounts, journal + posting engine, AR, AP, payments, reports.
- [x] Frontend: auth, dashboard, all modules and reports, Aurora UI, role-aware actions.
- [x] Both backend and frontend typecheck clean.
- [ ] **Run + verify end-to-end** — BLOCKED: no MySQL server found on the machine yet.
      (No `mysqld.exe` present; port 3306 closed. Need MySQL installed/started first.)

## TODO / next
- Get MySQL running, then: `prisma migrate dev` → `db:seed` → run both apps → verify the
  balance sheet balances and an unbalanced entry is rejected (400).
- Add ESLint + Prettier configs.
- Add a few screenshots to the README once it runs.
- Later: CSV export of reports, invoice PDF, closing entries for fiscal year.
