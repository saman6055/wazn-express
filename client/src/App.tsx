import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PortalThemeProvider } from "./contexts/PortalThemeContext";
import { LandingThemeProvider } from "./contexts/LandingThemeContext";
import { PWAInstallPrompt, OfflineIndicator } from "./components/PWAInstallPrompt";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import QueryErrorBoundary from "./components/QueryErrorBoundary";
import { MutationToastHandler } from "./components/MutationToastHandler";
import { OfflineProvider } from "./contexts/OfflineContext";
import { FastEntry } from "./components/FastEntry";

// Lazy: StaffTips drags a large tips-content module; keep it out of the entry chunk.
const StaffTips = lazy(() => import("./components/StaffTips").then((m) => ({ default: m.StaffTips })));

// ---------------------------------------------------------------------------
// Core & Home
// ---------------------------------------------------------------------------
const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));

// ---------------------------------------------------------------------------
// Dashboard & Customers
// ---------------------------------------------------------------------------
const DashboardWrapper = lazy(() => import("./pages/DashboardWrapper"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/customers/CustomerDetail"));
const Countries = lazy(() => import("./pages/Countries"));
const Warehouses = lazy(() => import("./pages/Warehouses"));

// ---------------------------------------------------------------------------
// Packages & Registration
// ---------------------------------------------------------------------------
const PackagesDashboard = lazy(() => import("./pages/PackagesDashboard"));
const Packages = lazy(() => import("./pages/Packages"));
const SelfOrders = lazy(() => import("./pages/SelfOrders"));
const QuickRegister = lazy(() => import("./pages/QuickRegister"));
const BulkRegister = lazy(() => import("./pages/BulkRegister"));
const UnclaimedPackages = lazy(() => import("./pages/UnclaimedPackages"));
const ClaimRequests = lazy(() => import("./pages/ClaimRequests"));

// ---------------------------------------------------------------------------
// Scanners & Scan
// ---------------------------------------------------------------------------
const BatchAssignmentScanner = lazy(() => import("./pages/BatchAssignmentScanner"));
const ArrivalVerificationScanner = lazy(() => import("./pages/ArrivalVerificationScanner"));
const CustomerDeliveryScanner = lazy(() => import("./pages/CustomerDeliveryScanner"));
const ScanDashboard = lazy(() => import("./pages/ScanDashboard"));
const ScanReports = lazy(() => import("./pages/ScanReports"));

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------
const Finance = lazy(() => import("./pages/Finance"));
const CompanyFinanceDashboard = lazy(() => import("./pages/CompanyFinanceDashboard"));
const CustomerFinance = lazy(() => import("./pages/CustomerFinance"));
const DebtorsReport = lazy(() => import("./pages/DebtorsReport"));
const BalanceSheet = lazy(() => import("./pages/BalanceSheet"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const DebtReminders = lazy(() => import("./pages/DebtReminders"));

// ---------------------------------------------------------------------------
// Batches & Accounting & Invoices
// ---------------------------------------------------------------------------
const Batches = lazy(() => import("./pages/Batches"));
const BatchFinancialReport = lazy(() => import("./pages/BatchFinancialReport"));
const BatchFinancialReportFull = lazy(() => import("./pages/BatchFinancialReportFull"));
const CustomerPricingReport = lazy(() => import("./pages/CustomerPricingReport"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceReports = lazy(() => import("./pages/InvoiceReports"));
const InvoiceView = lazy(() => import("./pages/InvoiceView"));
const BusinessAnalytics = lazy(() => import("./pages/BusinessAnalytics"));

// ---------------------------------------------------------------------------
// Reports & Services & Profit
// ---------------------------------------------------------------------------
const Reports = lazy(() => import("./pages/Reports"));
const BatchReports = lazy(() => import("./pages/BatchReports"));
const ServicesReport = lazy(() => import("./pages/ServicesReport"));
const ServicesManagement = lazy(() => import("./pages/ServicesManagement"));
// ServiceTypesManagement removed — merged into /service-types (Settings)
const ProfitDashboard = lazy(() => import("./pages/ProfitDashboard"));
const ProfitDashboardByType = lazy(() => import("./pages/ProfitDashboardByType"));
const UnifiedProfitDashboard = lazy(() => import("./pages/UnifiedProfitDashboard"));
const MonthlyProfitReport = lazy(() => import("./pages/MonthlyProfitReport"));
const ProfitReports = lazy(() => import("./pages/ProfitReports"));
const ProfitLossReport = lazy(() => import("./pages/ProfitLossReport"));

// ---------------------------------------------------------------------------
// Company (Expenses, Partners, Treasury)
// ---------------------------------------------------------------------------
const Expenses = lazy(() => import("./pages/Expenses"));
const ExpenseAlerts = lazy(() => import("./pages/ExpenseAlerts"));
const Partners = lazy(() => import("./pages/Partners"));
const CompanyDebts = lazy(() => import("./pages/CompanyDebts"));
const Treasury = lazy(() => import("./pages/Treasury"));
const FinancialReports = lazy(() => import("./pages/FinancialReports"));

// ---------------------------------------------------------------------------
// Users & Audit
// ---------------------------------------------------------------------------
const Users = lazy(() => import("./pages/Users"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const PermissionsManagement = lazy(() => import("./pages/PermissionsManagement"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));

// ---------------------------------------------------------------------------
// Settings & Admin
// ---------------------------------------------------------------------------
const Settings = lazy(() => import("./pages/Settings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const AdminPushNotificationCenter = lazy(() => import("./pages/AdminPushNotificationCenter"));
const InvoiceTemplateSettings = lazy(() => import("./pages/InvoiceTemplateSettings"));
const LabelTemplateSettings = lazy(() => import("./pages/LabelTemplateSettings"));
const BatchLabelTemplateSettings = lazy(() => import("./pages/BatchLabelTemplateSettings"));
const DataManagement = lazy(() => import("./pages/admin/DataManagement"));
const BackupManagement = lazy(() => import("./pages/BackupManagement"));
const ScheduledBackups = lazy(() => import("./pages/ScheduledBackups"));
const SystemMonitorDashboard = lazy(() => import("./pages/SystemMonitorDashboard"));
const CustomerOptions = lazy(() => import("./pages/CustomerOptions"));
const CurrencyManagement = lazy(() => import("./pages/CurrencyManagement"));
const TaxRatesManagement = lazy(() => import("./pages/TaxRatesManagement"));
const EmailTemplatesManagement = lazy(() => import("./pages/EmailTemplatesManagement"));
const IpWhitelistManagement = lazy(() => import("./pages/IpWhitelistManagement"));
const AdvancedSettings = lazy(() => import("./pages/AdvancedSettings"));
const CustomerCodePrefixSettings = lazy(() => import("./pages/CustomerCodePrefixSettings"));
const PortalPriceListSettings = lazy(() => import("./pages/PortalPriceListSettings"));
const PortalCenter = lazy(() => import("./pages/PortalCenter"));
const Pricing = lazy(() => import("./pages/Pricing"));

// ---------------------------------------------------------------------------
// Labels, VIP, Products, Services, Blog, Payments
// ---------------------------------------------------------------------------
const LabelPrinting = lazy(() => import("./pages/LabelPrinting"));
const VipCustomers = lazy(() => import("./pages/VipCustomers"));
const ProductCategories = lazy(() => import("./pages/ProductCategories"));
const ServiceTypes = lazy(() => import("./pages/ServiceTypes"));
const ServiceProfitReport = lazy(() => import("./pages/ServiceProfitReport"));
const CustomerMessages = lazy(() => import("./pages/CustomerMessages"));
const BlogManagement = lazy(() => import("./pages/BlogManagement"));
const Payments = lazy(() => import("./pages/Payments"));

// ---------------------------------------------------------------------------
// Full Package System
// ---------------------------------------------------------------------------
const UnifiedOrdersDashboard = lazy(() => import("./pages/UnifiedOrdersDashboard"));
const FullPackageDashboard = lazy(() => import("./pages/FullPackageDashboard"));
const FullPackageForm = lazy(() => import("./pages/FullPackageForm"));
const FullPackageDetail = lazy(() => import("./pages/FullPackageDetail"));
const BulkOrderForm = lazy(() => import("./pages/BulkOrderForm"));

// ---------------------------------------------------------------------------
// Commission
// ---------------------------------------------------------------------------
const CommissionDashboard = lazy(() => import("./pages/CommissionDashboard"));
const CommissionOrders = lazy(() => import("./pages/CommissionOrders"));
const CommissionForm = lazy(() => import("./pages/CommissionForm"));
const CommissionDetail = lazy(() => import("./pages/CommissionDetail"));

// ---------------------------------------------------------------------------
// Suppliers & Tracking
// ---------------------------------------------------------------------------
const Suppliers = lazy(() => import("./pages/Suppliers"));
const TrackingAlerts = lazy(() => import("./pages/TrackingAlerts"));

// ---------------------------------------------------------------------------
// Auth (Customer & Staff login)
// ---------------------------------------------------------------------------
const CustomerLogin = lazy(() => import("./pages/CustomerLogin"));
const StaffLogin = lazy(() => import("./pages/StaffLogin"));

// ---------------------------------------------------------------------------
// Customer Portal routes
// ---------------------------------------------------------------------------
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalShipments = lazy(() => import("./pages/portal/PortalShipments"));
const PortalBatchDetail = lazy(() => import("./pages/portal/PortalBatchDetail"));
const PortalFinancial = lazy(() => import("./pages/portal/PortalFinancial"));
const PortalProfile = lazy(() => import("./pages/portal/PortalProfile"));
const PortalSearch = lazy(() => import("./pages/portal/PortalSearch"));
const PortalUnclaimedPackages = lazy(() => import("./pages/portal/PortalUnclaimedPackages"));
const PortalDeclarePackage = lazy(() => import("./pages/portal/PortalDeclarePackage"));
const PortalFullPackage = lazy(() => import("./pages/portal/PortalFullPackage"));
const PortalMessages = lazy(() => import("./pages/portal/PortalMessages"));
const PortalNotifications = lazy(() => import("./pages/portal/PortalNotifications"));
const PortalAddresses = lazy(() => import("./pages/portal/PortalAddresses"));
const PortalTerms = lazy(() => import("./pages/portal/PortalTerms"));
const PortalServices = lazy(() => import("./pages/portal/PortalServices"));
const PortalBlog = lazy(() => import("./pages/portal/PortalBlog"));
const PortalBlogDetail = lazy(() => import("./pages/portal/PortalBlogDetail"));
const PortalInvoiceReports = lazy(() => import("./pages/portal/PortalInvoiceReports"));
const PortalYuanExchange = lazy(() => import("./pages/portal/PortalYuanExchange"));
const PortalProhibitedItems = lazy(() => import("./pages/portal/PortalProhibitedItems"));
const PortalGuide = lazy(() => import("./pages/portal/PortalGuide"));

function Router() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={DashboardWrapper} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/countries" component={Countries} />
        <Route path="/warehouses" component={Warehouses} />
        <Route path="/packages" component={PackagesDashboard} />
        <Route path="/packages/all" component={Packages} />
        <Route path="/self-orders" component={SelfOrders} />
        <Route path="/packages/quick-register" component={QuickRegister} />
        <Route path="/quick-register" component={QuickRegister} />
        <Route path="/packages/bulk-register" component={BulkRegister} />
        <Route path="/packages/unclaimed" component={UnclaimedPackages} />
        <Route path="/packages/claim-requests" component={ClaimRequests} />
        <Route path="/batch-assignment-scanner" component={BatchAssignmentScanner} />
        <Route path="/arrival-verification-scanner" component={ArrivalVerificationScanner} />
        <Route path="/customer-delivery-scanner" component={CustomerDeliveryScanner} />
        <Route path="/scan-dashboard" component={ScanDashboard} />
        <Route path="/scan-reports" component={ScanReports} />
        <Route path="/finance" component={Finance} />
        <Route path="/finance/company-dashboard" component={CompanyFinanceDashboard} />
        <Route path="/finance/customer/:id" component={CustomerFinance} />
        <Route path="/finance/debtors" component={DebtorsReport} />
        <Route path="/finance/balance-sheet" component={BalanceSheet} />
        <Route path="/finance/bank-accounts" component={BankAccounts} />
        <Route path="/finance/debt-reminders" component={DebtReminders} />
        <Route path="/batches" component={Batches} />
        <Route path="/batches/:id/financial" component={BatchFinancialReport} />
        <Route path="/batches/customer-pricing" component={CustomerPricingReport} />
        <Route path="/accounting" component={Accounting} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoice-reports" component={InvoiceReports} />
        <Route path="/invoices/:id" component={InvoiceView} />
        <Route path="/business-analytics" component={BusinessAnalytics} />
        <Route path="/reports" component={Reports} />
        <Route path="/reports/batches" component={BatchReports} />
        <Route path="/reports/batch-financial/:id" component={BatchFinancialReportFull} />
        <Route path="/reports/services" component={ServicesReport} />
        <Route path="/services" component={ServicesManagement} />
        <Route path="/profit-dashboard" component={ProfitDashboard} />
        <Route path="/profit-by-type" component={ProfitDashboardByType} />
        <Route path="/reports/unified-profit" component={UnifiedProfitDashboard} />
        <Route path="/reports/monthly-profit" component={MonthlyProfitReport} />
        <Route path="/reports/profit" component={ProfitReports} />
        <Route path="/reports/profit-loss" component={ProfitLossReport} />
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
        <Route path="/admin/push-notifications" component={AdminPushNotificationCenter} />
        <Route path="/settings/invoice-template" component={InvoiceTemplateSettings} />
        <Route path="/settings/label-templates" component={LabelTemplateSettings} />
        <Route path="/settings/batch-label-template" component={BatchLabelTemplateSettings} />
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
        <Route path="/settings/portal-price-list" component={PortalPriceListSettings} />
        <Route path="/portal-center" component={PortalCenter} />
        <Route path="/settings/pricing" component={Pricing} />
        <Route path="/label-printing" component={LabelPrinting} />
        <Route path="/vip-customers" component={VipCustomers} />
        <Route path="/product-categories" component={ProductCategories} />
        <Route path="/service-types" component={ServiceTypes} />
        <Route path="/service-profit-report" component={ServiceProfitReport} />
        <Route path="/customer-messages" component={CustomerMessages} />
        <Route path="/blog-management" component={BlogManagement} />
        <Route path="/payments" component={Payments} />
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
        {/* `:mode` must be a wouter named param (not the literal word "edit"),
            otherwise useParams({mode}) is always undefined and isEditMode
            stays false — the URL flips to /edit but the page still renders
            in view mode. Mirrors the /full-package/:id/:mode route above. */}
        <Route path="/commission/:id/:mode" component={CommissionDetail} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/tracking-alerts" component={TrackingAlerts} />
        <Route path="/customer-login" component={CustomerLogin} />
        <Route path="/staff-login" component={StaffLogin} />
        <Route path="/portal" component={PortalHome} />
        <Route path="/portal/shipments" component={PortalShipments} />
        <Route path="/portal/shipments/:id" component={PortalBatchDetail} />
        <Route path="/portal/financial" component={PortalFinancial} />
        <Route path="/portal/profile" component={PortalProfile} />
        <Route path="/portal/search" component={PortalSearch} />
        <Route path="/portal/no-mark" component={PortalUnclaimedPackages} />
        <Route path="/portal/declare" component={PortalDeclarePackage} />
        <Route path="/portal/full-package" component={PortalFullPackage} />
        <Route path="/portal/messages" component={PortalMessages} />
        <Route path="/portal/notifications" component={PortalNotifications} />
        <Route path="/portal/addresses" component={PortalAddresses} />
        <Route path="/portal/terms" component={PortalTerms} />
        <Route path="/portal/services" component={PortalServices} />
        <Route path="/portal/blog" component={PortalBlog} />
        <Route path="/portal/news" component={PortalBlog} />
        <Route path="/portal/blog/:id" component={PortalBlogDetail} />
        <Route path="/portal/invoice-reports" component={PortalInvoiceReports} />
        <Route path="/portal/yuan-exchange" component={PortalYuanExchange} />
        <Route path="/portal/prohibited-items" component={PortalProhibitedItems} />
        <Route path="/portal/guide" component={PortalGuide} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <LanguageProvider>
          <OfflineProvider>
            <PortalThemeProvider>
              <LandingThemeProvider>
                <TooltipProvider>
                <Toaster />
                <MutationToastHandler />
                <OfflineIndicator />
                <QueryErrorBoundary>
                  <Router />
                </QueryErrorBoundary>
                <Suspense fallback={null}>
                  <StaffTips />
                </Suspense>
                <FastEntry />
                <PWAInstallPrompt />
              </TooltipProvider>
              </LandingThemeProvider>
            </PortalThemeProvider>
          </OfflineProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
