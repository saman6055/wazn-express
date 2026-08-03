import {
  Users,
  Package,
  Boxes,
  FileText,
  CreditCard,
  Receipt,
  BookOpen,
  ShoppingBag,
  Truck,
  ScanLine,
  History,
  FileWarning,
  Newspaper,
} from "lucide-react";
import type { DataCategory } from "@/hooks/useDataManagement";

export const dataCategories: DataCategory[] = [
  { id: "customers", titleKey: "dataManagement.customers", descKey: "dataManagement.customersDesc", icon: <Users className="h-5 w-5" />, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/40", borderColor: "border-blue-200 dark:border-blue-800/60", mutationKey: "deleteAllCustomers" },
  { id: "packages", titleKey: "dataManagement.packages", descKey: "dataManagement.packagesDesc", icon: <Package className="h-5 w-5" />, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/40", borderColor: "border-emerald-200 dark:border-emerald-800/60", mutationKey: "deleteAllPackages" },
  { id: "batches", titleKey: "dataManagement.batches", descKey: "dataManagement.batchesDesc", icon: <Boxes className="h-5 w-5" />, color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/40", borderColor: "border-purple-200 dark:border-purple-800/60", mutationKey: "deleteAllBatches" },
  { id: "invoices", titleKey: "dataManagement.invoices", descKey: "dataManagement.invoicesDesc", icon: <FileText className="h-5 w-5" />, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/40", borderColor: "border-orange-200 dark:border-orange-800/60", mutationKey: "deleteAllInvoices" },
  { id: "payments", titleKey: "dataManagement.payments", descKey: "dataManagement.paymentsDesc", icon: <CreditCard className="h-5 w-5" />, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950/40", borderColor: "border-teal-200 dark:border-teal-800/60", mutationKey: "deleteAllPayments" },
  { id: "expenses", titleKey: "dataManagement.expenses", descKey: "dataManagement.expensesDesc", icon: <Receipt className="h-5 w-5" />, color: "text-rose-600", bgColor: "bg-rose-50 dark:bg-rose-950/40", borderColor: "border-rose-200 dark:border-rose-800/60", mutationKey: "deleteAllExpenses" },
  { id: "ledgerEntries", titleKey: "dataManagement.ledger", descKey: "dataManagement.ledgerDesc", icon: <BookOpen className="h-5 w-5" />, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/40", borderColor: "border-indigo-200 dark:border-indigo-800/60", mutationKey: "deleteAllLedgerTransactions" },
  { id: "fullPackages", titleKey: "dataManagement.fullPackages", descKey: "dataManagement.fullPackagesDesc", icon: <ShoppingBag className="h-5 w-5" />, color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950/40", borderColor: "border-pink-200 dark:border-pink-800/60", mutationKey: "deleteAllFullPackages" },
  { id: "suppliers", titleKey: "dataManagement.suppliers", descKey: "dataManagement.suppliersDesc", icon: <Truck className="h-5 w-5" />, color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/40", borderColor: "border-cyan-200 dark:border-cyan-800/60", mutationKey: "deleteAllSuppliers" },
  { id: "scans", titleKey: "dataManagement.scans", descKey: "dataManagement.scansDesc", icon: <ScanLine className="h-5 w-5" />, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/40", borderColor: "border-amber-200 dark:border-amber-800/60", mutationKey: "deleteAllScans" },
  { id: "statusHistory", titleKey: "dataManagement.statusHistory", descKey: "dataManagement.statusHistoryDesc", icon: <History className="h-5 w-5" />, color: "text-slate-600", bgColor: "bg-slate-50 dark:bg-slate-950/40", borderColor: "border-slate-200 dark:border-slate-800/60", mutationKey: "deleteAllStatusHistory" },
  { id: "auditLogs", titleKey: "dataManagement.auditLogs", descKey: "dataManagement.auditLogsDesc", icon: <FileWarning className="h-5 w-5" />, color: "text-gray-600", bgColor: "bg-gray-50 dark:bg-gray-950/40", borderColor: "border-gray-200 dark:border-gray-800/60", mutationKey: "deleteAllAuditLogs" },
  { id: "blogPosts", titleKey: "dataManagement.blogPosts", descKey: "dataManagement.blogPostsDesc", icon: <Newspaper className="h-5 w-5" />, color: "text-violet-600", bgColor: "bg-violet-50 dark:bg-violet-950/40", borderColor: "border-violet-200 dark:border-violet-800/60", mutationKey: "deleteAllBlogPosts" },
];
