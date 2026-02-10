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
  { id: "customers", titleKey: "dataManagement.customers", descKey: "dataManagement.customersDesc", icon: <Users className="h-5 w-5" />, color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200", mutationKey: "deleteAllCustomers" },
  { id: "packages", titleKey: "dataManagement.packages", descKey: "dataManagement.packagesDesc", icon: <Package className="h-5 w-5" />, color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", mutationKey: "deleteAllPackages" },
  { id: "batches", titleKey: "dataManagement.batches", descKey: "dataManagement.batchesDesc", icon: <Boxes className="h-5 w-5" />, color: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200", mutationKey: "deleteAllBatches" },
  { id: "invoices", titleKey: "dataManagement.invoices", descKey: "dataManagement.invoicesDesc", icon: <FileText className="h-5 w-5" />, color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200", mutationKey: "deleteAllInvoices" },
  { id: "payments", titleKey: "dataManagement.payments", descKey: "dataManagement.paymentsDesc", icon: <CreditCard className="h-5 w-5" />, color: "text-teal-600", bgColor: "bg-teal-50", borderColor: "border-teal-200", mutationKey: "deleteAllPayments" },
  { id: "expenses", titleKey: "dataManagement.expenses", descKey: "dataManagement.expensesDesc", icon: <Receipt className="h-5 w-5" />, color: "text-rose-600", bgColor: "bg-rose-50", borderColor: "border-rose-200", mutationKey: "deleteAllExpenses" },
  { id: "ledgerEntries", titleKey: "dataManagement.ledger", descKey: "dataManagement.ledgerDesc", icon: <BookOpen className="h-5 w-5" />, color: "text-indigo-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", mutationKey: "deleteAllLedgerTransactions" },
  { id: "fullPackages", titleKey: "dataManagement.fullPackages", descKey: "dataManagement.fullPackagesDesc", icon: <ShoppingBag className="h-5 w-5" />, color: "text-pink-600", bgColor: "bg-pink-50", borderColor: "border-pink-200", mutationKey: "deleteAllFullPackages" },
  { id: "suppliers", titleKey: "dataManagement.suppliers", descKey: "dataManagement.suppliersDesc", icon: <Truck className="h-5 w-5" />, color: "text-cyan-600", bgColor: "bg-cyan-50", borderColor: "border-cyan-200", mutationKey: "deleteAllSuppliers" },
  { id: "scans", titleKey: "dataManagement.scans", descKey: "dataManagement.scansDesc", icon: <ScanLine className="h-5 w-5" />, color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", mutationKey: "deleteAllScans" },
  { id: "statusHistory", titleKey: "dataManagement.statusHistory", descKey: "dataManagement.statusHistoryDesc", icon: <History className="h-5 w-5" />, color: "text-slate-600", bgColor: "bg-slate-50", borderColor: "border-slate-200", mutationKey: "deleteAllStatusHistory" },
  { id: "auditLogs", titleKey: "dataManagement.auditLogs", descKey: "dataManagement.auditLogsDesc", icon: <FileWarning className="h-5 w-5" />, color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200", mutationKey: "deleteAllAuditLogs" },
  { id: "blogPosts", titleKey: "dataManagement.blogPosts", descKey: "dataManagement.blogPostsDesc", icon: <Newspaper className="h-5 w-5" />, color: "text-violet-600", bgColor: "bg-violet-50", borderColor: "border-violet-200", mutationKey: "deleteAllBlogPosts" },
];
