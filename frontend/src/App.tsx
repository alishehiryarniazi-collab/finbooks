import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Dashboard } from "./pages/Dashboard";
import { ChartOfAccounts } from "./pages/accounts/ChartOfAccounts";
import { OpeningBalances } from "./pages/accounts/OpeningBalances";
import { JournalList } from "./pages/journal/JournalList";
import { JournalEntryForm } from "./pages/journal/JournalEntryForm";
import { VoucherForm } from "./pages/journal/VoucherForm";
import { GeneralLedger } from "./pages/journal/GeneralLedger";
import { Customers } from "./pages/customers/Customers";
import { Vendors } from "./pages/vendors/Vendors";
import { InvoiceList } from "./pages/invoices/InvoiceList";
import { InvoiceForm } from "./pages/invoices/InvoiceForm";
import { InvoiceView } from "./pages/invoices/InvoiceView";
import { InvoicePrint } from "./pages/invoices/InvoicePrint";
import { BillList } from "./pages/bills/BillList";
import { BillForm } from "./pages/bills/BillForm";
import { BillView } from "./pages/bills/BillView";
import { BillPrint } from "./pages/bills/BillPrint";
import { Payments } from "./pages/payments/Payments";
import { PaymentsDue } from "./pages/payments/PaymentsDue";
import { TrialBalance } from "./pages/reports/TrialBalance";
import { ProfitLoss } from "./pages/reports/ProfitLoss";
import { BalanceSheet } from "./pages/reports/BalanceSheet";
import { ArAging } from "./pages/reports/ArAging";
import { ApAging } from "./pages/reports/ApAging";
import { Team } from "./pages/Team";
import { Settings } from "./pages/Settings";
import { TaxRates } from "./pages/TaxRates";
import { TaxReport } from "./pages/reports/TaxReport";
import { CostCenters } from "./pages/CostCenters";
import { Projects } from "./pages/Projects";
import { CostCenterReport, ProjectReport } from "./pages/reports/DimensionReport";
import { FinancialAnalysis } from "./pages/reports/FinancialAnalysis";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="accounts" element={<ChartOfAccounts />} />
        <Route path="accounts/opening-balances" element={<OpeningBalances />} />
        <Route path="ledger" element={<GeneralLedger />} />
        <Route path="ledger/:accountId" element={<GeneralLedger />} />
        <Route path="journal" element={<JournalList />} />
        <Route path="journal/new" element={<JournalEntryForm />} />
        <Route path="vouchers/debit/new" element={<VoucherForm kind="DEBIT" />} />
        <Route path="vouchers/credit/new" element={<VoucherForm kind="CREDIT" />} />
        <Route path="customers" element={<Customers />} />
        <Route path="invoices" element={<InvoiceList />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="bills" element={<BillList />} />
        <Route path="bills/new" element={<BillForm />} />
        <Route path="bills/:id/edit" element={<BillForm />} />
        <Route path="bills/:id" element={<BillView />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments-due" element={<PaymentsDue />} />
        <Route path="reports/trial-balance" element={<TrialBalance />} />
        <Route path="reports/profit-loss" element={<ProfitLoss />} />
        <Route path="reports/balance-sheet" element={<BalanceSheet />} />
        <Route path="reports/ar-aging" element={<ArAging />} />
        <Route path="reports/ap-aging" element={<ApAging />} />
        <Route path="reports/tax-summary" element={<TaxReport />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
        <Route path="tax-rates" element={<TaxRates />} />
        <Route path="cost-centers" element={<CostCenters />} />
        <Route path="projects" element={<Projects />} />
        <Route path="reports/cost-centers" element={<CostCenterReport />} />
        <Route path="reports/projects" element={<ProjectReport />} />
        <Route path="reports/analysis" element={<FinancialAnalysis />} />
      </Route>

      {/* Standalone printable documents — protected, but outside AppLayout (no sidebar). */}
      <Route
        path="/invoices/:id/print"
        element={
          <ProtectedRoute>
            <InvoicePrint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bills/:id/print"
        element={
          <ProtectedRoute>
            <BillPrint />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
