# FinBooks

A small-business accounting app I built to learn how real bookkeeping software works under the
hood — not just an income/expense tracker, but a proper **double-entry** system where every
transaction hits a general ledger and the books actually have to balance.

The idea was to stop hand-waving "accounting" and force myself to get the fundamentals right:
a chart of accounts, journal entries where debits equal credits, invoices and bills that post
into the ledger, and financial statements that are calculated from the ledger instead of being
faked.

## What it does

- **Chart of accounts** — assets, liabilities, equity, income, expenses, each with a normal balance.
- **Journal entries** — manual balanced entries; the API rejects anything that doesn't balance.
- **Invoices (AR)** — create, post to the ledger, record customer payments, track what's owed.
- **Bills (AP)** — same idea on the money-out side with vendors.
- **Reports** — Trial Balance, Profit & Loss, Balance Sheet, and AR/AP aging, all built from the ledger.
- **Dashboard** — cash, receivables, payables, this month's profit, and a 6-month income vs expense chart.
- **Users & roles** — an organization with Admin / Accountant / Viewer access.

## Tech

- **Backend:** Node.js, Express, TypeScript, Prisma, MySQL, JWT.
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Recharts.

The one rule I kept coming back to: the general ledger is the source of truth. Invoices, bills
and payments don't store their own "truth" — they post balanced journal entries, and every report
reads from those. Money is stored as `DECIMAL`, never a float, so the cents always add up.

## Running it locally

You'll need Node 18+ and a MySQL server (I used XAMPP). Point `backend/.env` at your database, then:

```bash
# backend
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev

# frontend (second terminal)
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173 and log in with the demo account:

```
demo@finbooks.app  /  demo1234
```

The seed loads a demo company with a few customers, vendors, invoices and bills already posted,
so the dashboard and reports have something to show right away.

## Notes

This is a learning/portfolio project, so a few things are deliberately out of scope for now:
multi-currency, payroll, inventory and bank reconciliation. The data model leaves room for them.
