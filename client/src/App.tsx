import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Navbar } from "@/components/ui/navbar";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import CRM from "@/pages/CRM";
import Quotations from "@/pages/Quotations";
import Invoices from "@/pages/Invoices";
import Expenses from "@/pages/Expenses";
import ExpenseDetail from "@/pages/ExpenseDetail";
import ExpenseEdit from "@/pages/ExpenseEdit";

import Tasks from "@/pages/Tasks";
import Analytics from "@/pages/Analytics";
import PaymentSources from "@/pages/PaymentSources";
import PaymentSourceDetail from "@/pages/PaymentSourceDetail";
import ClientProfile from "@/pages/ClientProfile";
import QuotationDetail from "@/pages/QuotationDetail";
import InvoiceDetail from "@/pages/InvoiceDetail";
import QuotationManagement from "@/pages/QuotationManagement";
import UserManagement from "@/pages/UserManagement";
import EmployeeProfile from "@/pages/EmployeeProfile";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={Landing} />
      </Switch>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/crm" component={CRM} />
            <Route path="/crm/:id" component={ClientProfile} />
            <Route path="/quotations" component={Quotations} />
            <Route path="/quotations/:id" component={QuotationDetail} />
            <Route path="/quotation-management" component={QuotationManagement} />
            <Route path="/invoices" component={Invoices} />
            <Route path="/invoices/:id" component={InvoiceDetail} />
            <Route path="/expenses" component={Expenses} />
            <Route path="/expenses/:id" component={ExpenseDetail} />
            <Route path="/expenses/:id/edit" component={ExpenseEdit} />
            <Route path="/payment-sources" component={PaymentSources} />
            <Route path="/payment-sources/:id" component={PaymentSourceDetail} />

            <Route path="/user-management" component={UserManagement} />
            <Route path="/employees/:id" component={EmployeeProfile} />
            <Route path="/tasks" component={Tasks} />
            <Route path="/analytics" component={Analytics} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
