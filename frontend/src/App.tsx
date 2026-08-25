import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { ChartOfAccounts } from "./pages/accounts/ChartOfAccounts";
import { JournalList } from "./pages/journal/JournalList";
import { JournalEntryForm } from "./pages/journal/JournalEntryForm";
import { VoucherForm } from "./pages/journal/VoucherForm";
import { Customers } from "./pages/customers/Customers";
import { Vendors } from "./pages/vendors/Vendors";
import { InvoiceList } from "./pages/invoices/InvoiceList";
import { InvoiceForm } from "./pages/invoices/InvoiceForm";
import { InvoiceView } from "./pages/invoices/InvoiceView";
import { BillList } from "./pages/bills/BillList";
import { BillForm } from "./pages/bills/BillForm";
import { BillView } from "./pages/bills/BillView";
import { Payments } from "./pages/payments/Payments";
import { TrialBalance } from "./pages/reports/TrialBalance";
import { ProfitLoss } from "./pages/reports/ProfitLoss";
import { BalanceSheet } from "./pages/reports/BalanceSheet";
import { ArAging } from "./pages/reports/ArAging";
import { ApAging } from "./pages/reports/ApAging";
import { Team } from "./pages/Team";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<ChartOfAccounts />} />
        <Route path="journal" element={<JournalList />} />
        <Route path="journal/new" element={<JournalEntryForm />} />
        <Route path="vouchers/debit/new" element={<VoucherForm kind="DEBIT" />} />
        <Route path="vouchers/credit/new" element={<VoucherForm kind="CREDIT" />} />
        <Route path="customers" element={<Customers />} />
        <Route path="invoices" element={<InvoiceList />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="bills" element={<BillList />} />
        <Route path="bills/new" element={<BillForm />} />
        <Route path="bills/:id" element={<BillView />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports/trial-balance" element={<TrialBalance />} />
        <Route path="reports/profit-loss" element={<ProfitLoss />} />
        <Route path="reports/balance-sheet" element={<BalanceSheet />} />
        <Route path="reports/ar-aging" element={<ArAging />} />
        <Route path="reports/ap-aging" element={<ApAging />} />
        <Route path="team" element={<Team />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
