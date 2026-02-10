import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PortalThemeProvider } from "./contexts/PortalThemeContext";
import { PWAInstallPrompt, OfflineIndicator } from "./components/PWAInstallPrompt";

// Pages
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Countries from "./pages/Countries";
import Warehouses from "./pages/Warehouses";
import Packages from "./pages/Packages";
import PackageRegister from "./pages/PackageRegister";
import Batches from "./pages/Batches";
import Accounting from "./pages/Accounting";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import CustomerPortal from "./pages/CustomerPortal";
import CustomerLogin from "./pages/CustomerLogin";
// Full Package System
import FullPackageDashboard from "./pages/FullPackageDashboard";
import UnifiedOrdersDashboard from "./pages/UnifiedOrdersDashboard";
import FullPackageForm from "./pages/FullPackageForm";
import FullPackageDetail from "./pages/FullPackageDetail";
// PurchaseRequestDashboard removed
import CommissionDashboard from "./pages/CommissionDashboard";
import CommissionOrders from "./pages/CommissionOrders";
import CommissionForm from "./pages/CommissionForm";
// PurchaseRequestDetail removed
import CommissionDetail from "./pages/CommissionDetail";
import BulkOrderForm from "./pages/BulkOrderForm";
// PurchaseRequestForm removed
import VipCustomers from "./pages/VipCustomers";
import Payments from "./pages/Payments";
// Old scanner pages removed - using new 4-module system
// import Scanner from "./pages/Scanner";
// import SmartScanner from "./pages/SmartScanner";
// import AISmartScanner from "./pages/AISmartScanner";
// import AdvancedScanner from "./pages/AdvancedScanner";
// import ContinuousScan from "./pages/ContinuousScan";
// import UnifiedScanner from "./pages/UnifiedScanner";
import ScanDashboard from "./pages/ScanDashboard";
import Finance from "./pages/Finance";
import CustomerFinance from "./pages/CustomerFinance";
// import RecordPayment from "./pages/RecordPayment"; // REMOVED
import DebtorsReport from "./pages/DebtorsReport";
import ProductCategories from "./pages/ProductCategories";
import BackupManagement from "./pages/BackupManagement";
import ScheduledBackups from "./pages/ScheduledBackups";
import QuickRegister from "./pages/QuickRegister";
import BulkRegister from "./pages/BulkRegister";
import UnclaimedPackages from "./pages/UnclaimedPackages";
import ClaimRequests from "./pages/ClaimRequests";
import PackagesDashboard from "./pages/PackagesDashboard";
import BatchFinancialReport from "./pages/BatchFinancialReport";
import BatchFinancialReportFull from "./pages/BatchFinancialReportFull";
import BatchReports from "./pages/BatchReports";
import ServicesManagement from "./pages/ServicesManagement";
import ServiceTypesManagement from "./pages/ServiceTypesManagement";
import ServicesReport from "./pages/ServicesReport";
import NotificationSettings from "./pages/NotificationSettings";
import ProfitDashboard from "./pages/ProfitDashboard";
import ProfitDashboardByType from "./pages/ProfitDashboardByType";
import UnifiedProfitDashboard from "./pages/UnifiedProfitDashboard";
import MonthlyProfitReport from "./pages/MonthlyProfitReport";
// import WarehouseOperations from "./pages/WarehouseOperations"; // REMOVED
import Expenses from "./pages/Expenses";
import ExpenseAlerts from "./pages/ExpenseAlerts";
import Partners from "./pages/Partners";
import CompanyDebts from "./pages/CompanyDebts";
import Treasury from "./pages/Treasury";
import FinancialReports from "./pages/FinancialReports";
import ScanReports from "./pages/ScanReports";
import CustomerPricingReport from "./pages/CustomerPricingReport";
import ServiceTypes from "./pages/ServiceTypes";
import ServiceProfitReport from "./pages/ServiceProfitReport";
import CustomerMessages from "./pages/CustomerMessages";
// import MobileScanner from "./pages/MobileScanner"; // REMOVED
import BatchAssignmentScanner from "./pages/BatchAssignmentScanner";
import ArrivalVerificationScanner from "./pages/ArrivalVerificationScanner";
import CustomerDeliveryScanner from "./pages/CustomerDeliveryScanner";
import InvoiceTemplateSettings from "./pages/InvoiceTemplateSettings";
import LabelTemplateSettings from "./pages/LabelTemplateSettings";
import LabelPrinting from "./pages/LabelPrinting";
import Suppliers from "./pages/Suppliers";
// import FullPackageReports from "./pages/FullPackageReports";
import CompanyFinanceDashboard from "./pages/CompanyFinanceDashboard";
// import ProfitLossReport from "./pages/ProfitLossReport"; // REMOVED
import ProfitReports from "./pages/ProfitReports";
// import CashFlowReport from "./pages/CashFlowReport"; // REMOVED
import BalanceSheet from "./pages/BalanceSheet";
import BankAccounts from "./pages/BankAccounts";
import DebtReminders from "./pages/DebtReminders";
// import FinancialGoals from "./pages/FinancialGoals"; // REMOVED
import DataManagement from "./pages/DataManagement";
import StaffLogin from "./pages/StaffLogin";
import StaffManagement from "./pages/StaffManagement";
import PermissionsManagement from "./pages/PermissionsManagement";
import BlogManagement from "./pages/BlogManagement";
import TrackingAlerts from "./pages/TrackingAlerts";
// import FinancialHub from "./pages/FinancialHub"; // REMOVED
// CustomerPurchaseRequest and CustomerMyRequests removed
// AdminPurchaseRequests removed
import CustomerOptions from "./pages/CustomerOptions";
import CurrencyManagement from "./pages/CurrencyManagement";
import TaxRatesManagement from "./pages/TaxRatesManagement";
import EmailTemplatesManagement from "./pages/EmailTemplatesManagement";
import IpWhitelistManagement from "./pages/IpWhitelistManagement";
import AdvancedSettings from "./pages/AdvancedSettings";
import CustomerCodePrefixSettings from "./pages/CustomerCodePrefixSettings";
import InvoiceReports from "./pages/InvoiceReports";
import InvoiceView from "./pages/InvoiceView";
import BusinessAnalytics from "./pages/BusinessAnalytics";
import SystemMonitorDashboard from "./pages/SystemMonitorDashboard";
// import BalanceValidationDashboard from "./pages/BalanceValidationDashboard"; // REMOVED


// Customer Portal Pages
import PortalHome from "./pages/portal/PortalHome";
import PortalShipments from "./pages/portal/PortalShipments";
import PortalBatchDetail from "./pages/portal/PortalBatchDetail";
import PortalFinancial from "./pages/portal/PortalFinancial";
import PortalProfile from "./pages/portal/PortalProfile";
import PortalSearch from "./pages/portal/PortalSearch";
import PortalUnclaimedPackages from "./pages/portal/PortalUnclaimedPackages";
import PortalFullPackage from "./pages/portal/PortalFullPackage";
import PortalMessages from "./pages/portal/PortalMessages";
import PortalNotifications from "./pages/portal/PortalNotifications";
import PortalAddresses from "./pages/portal/PortalAddresses";
import PortalTerms from "./pages/portal/PortalTerms";
import PortalServices from "./pages/portal/PortalServices";
import PortalBlog from "./pages/portal/PortalBlog";
import PortalBlogDetail from "./pages/portal/PortalBlogDetail";
import PortalInvoiceReports from "./pages/portal/PortalInvoiceReports";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/countries" component={Countries} />
      <Route path="/warehouses" component={Warehouses} />
      <Route path="/packages" component={PackagesDashboard} />
      <Route path="/packages/all" component={Packages} />
      {/* Standard package registration removed - use quick or bulk register */}
      <Route path="/packages/quick-register" component={QuickRegister} />
      <Route path="/quick-register" component={QuickRegister} />
      <Route path="/packages/bulk-register" component={BulkRegister} />
      <Route path="/packages/unclaimed" component={UnclaimedPackages} />
      <Route path="/packages/claim-requests" component={ClaimRequests} />
      {/* Old scanner routes removed - using new 4-module system */}
      {/* <Route path="/advanced-scanner" component={AdvancedScanner} /> */}
      {/* <Route path="/scanner" component={Scanner} /> */}
      {/* <Route path="/smart-scanner" component={SmartScanner} /> */}
      {/* <Route path="/ai-scanner" component={AISmartScanner} /> */}
      {/* <Route path="/continuous-scan" component={ContinuousScan} /> */}
      {/* <Route path="/warehouse-operations" component={WarehouseOperations} /> */}
      {/* <Route path="/mobile-scanner" component={MobileScanner} /> */}
      <Route path="/batch-assignment-scanner" component={BatchAssignmentScanner} />
      <Route path="/arrival-verification-scanner" component={ArrivalVerificationScanner} />
      <Route path="/customer-delivery-scanner" component={CustomerDeliveryScanner} />
      <Route path="/scan-dashboard" component={ScanDashboard} />
      <Route path="/scan-reports" component={ScanReports} />
      {/* Route /financial-hub removed */}
      <Route path="/finance" component={Finance} />
      <Route path="/finance/company-dashboard" component={CompanyFinanceDashboard} />
      <Route path="/finance/customer/:id" component={CustomerFinance} />
      {/* Route /finance/record-payment removed */}
      <Route path="/finance/debtors" component={DebtorsReport} />
      {/* Route /finance/profit-loss removed */}
      {/* Route /finance/cash-flow removed */}
      <Route path="/finance/balance-sheet" component={BalanceSheet} />
      <Route path="/finance/bank-accounts" component={BankAccounts} />
      <Route path="/finance/debt-reminders" component={DebtReminders} />
      {/* Route /finance/goals removed */}
      <Route path="/batches" component={Batches} />
      <Route path="/batches/:id/financial" component={BatchFinancialReport} />
      <Route path="/batches/customer-pricing" component={CustomerPricingReport} />
      <Route path="/accounting" component={Accounting} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoice-reports" component={InvoiceReports} />
      <Route path="/invoices/:id" component={InvoiceView} />
      <Route path="/business-analytics" component={BusinessAnalytics} />
      {/* Route /balance-validation removed */}
      <Route path="/reports" component={Reports} />
      <Route path="/reports/batches" component={BatchReports} />
      <Route path="/reports/batch-financial/:id" component={BatchFinancialReportFull} />
      <Route path="/reports/services" component={ServicesReport} />
      <Route path="/services" component={ServicesManagement} />
      <Route path="/services/types" component={ServiceTypesManagement} />
      <Route path="/profit-dashboard" component={ProfitDashboard} />
      <Route path="/profit-by-type" component={ProfitDashboardByType} />     <Route path="/reports/unified-profit" component={UnifiedProfitDashboard} />
      <Route path="/reports/monthly-profit" component={MonthlyProfitReport} />
      <Route path="/reports/profit" component={ProfitReports} />
      <Route path="/company/expenses" component={Expenses} />
      <Route path="/company/expense-alerts" component={ExpenseAlerts} />
      <Route path="/company/partners" component={Partners} />
      <Route path="/company/debts" component={CompanyDebts} />
      <Route path="/company/treasury" component={Treasury} />
      <Route path="/company/reports" component={FinancialReports} />
      <Route path="/users" component={Users} />
      <Route path="/staff-management" component={StaffManagement} />
      <Route path="/permissions-management" component={PermissionsManagement} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/settings" component={Settings} />
      <Route path="/settings/notifications" component={NotificationSettings} />
      <Route path="/settings/invoice-template" component={InvoiceTemplateSettings} />
      <Route path="/settings/label-templates" component={LabelTemplateSettings} />
      <Route path="/settings/data-management" component={DataManagement} />
      <Route path="/backup-management" component={BackupManagement} />
      <Route path="/scheduled-backups" component={ScheduledBackups} />
      <Route path="/system-monitor" component={SystemMonitorDashboard} />
      <Route path="/settings/customer-options" component={CustomerOptions} />
      <Route path="/settings/currencies" component={CurrencyManagement} />
      <Route path="/settings/tax-rates" component={TaxRatesManagement} />
      <Route path="/settings/email-templates" component={EmailTemplatesManagement} />
      <Route path="/settings/ip-whitelist" component={IpWhitelistManagement} />
        <Route path="/settings/advanced" component={AdvancedSettings} />
        <Route path="/settings/code-prefixes" component={CustomerCodePrefixSettings} />
      <Route path="/label-printing" component={LabelPrinting} />
      <Route path="/vip-customers" component={VipCustomers} />
      <Route path="/product-categories" component={ProductCategories} />
      <Route path="/service-types" component={ServiceTypes} />
      <Route path="/service-profit-report" component={ServiceProfitReport} />
      <Route path="/customer-messages" component={CustomerMessages} />
      <Route path="/blog-management" component={BlogManagement} />
      <Route path="/payments" component={Payments} />
      {/* Full Package System */}
      <Route path="/unified-orders" component={UnifiedOrdersDashboard} />
      <Route path="/full-package" component={FullPackageDashboard} />
      <Route path="/full-package/new" component={FullPackageForm} />
      <Route path="/full-package/bulk-create" component={BulkOrderForm} />
      <Route path="/full-package/:id" component={FullPackageDetail} />
      <Route path="/full-package/:id/:mode" component={FullPackageDetail} />

      <Route path="/commission" component={CommissionDashboard} />
      <Route path="/commission-orders" component={CommissionOrders} />
      <Route path="/commission/new" component={CommissionForm} />
      <Route path="/commission/bulk-create" component={BulkOrderForm} />
      <Route path="/commission/:id" component={CommissionDetail} />
      <Route path="/commission/:id/edit" component={CommissionDetail} />
      <Route path="/suppliers" component={Suppliers} />
      {/* <Route path="/full-package/reports" component={FullPackageReports} /> */}
      <Route path="/tracking-alerts" component={TrackingAlerts} />
      
      {/* Old Full Package routes removed */}
      <Route path="/customer-login" component={CustomerLogin} />
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/portal" component={PortalHome} />
      <Route path="/portal/shipments" component={PortalShipments} />
      <Route path="/portal/shipments/:id" component={PortalBatchDetail} />
      <Route path="/portal/financial" component={PortalFinancial} />
      <Route path="/portal/profile" component={PortalProfile} />
      <Route path="/portal/search" component={PortalSearch} />
      <Route path="/portal/no-mark" component={PortalUnclaimedPackages} />
      <Route path="/portal/full-package" component={PortalFullPackage} />
      <Route path="/portal/messages" component={PortalMessages} />
      <Route path="/portal/notifications" component={PortalNotifications} />
      <Route path="/portal/addresses" component={PortalAddresses} />
      <Route path="/portal/terms" component={PortalTerms} />
      <Route path="/portal/services" component={PortalServices} />
      <Route path="/portal/blog" component={PortalBlog} />
      <Route path="/portal/blog/:id" component={PortalBlogDetail} />
      <Route path="/portal/invoice-reports" component={PortalInvoiceReports} />

      {/* CustomerMyRequests route removed */}

      <Route path="/backup-management" component={BackupManagement} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <LanguageProvider>
          <PortalThemeProvider>
            <TooltipProvider>
              <Toaster />
              <OfflineIndicator />
              <Router />
              <PWAInstallPrompt />
            </TooltipProvider>
          </PortalThemeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
