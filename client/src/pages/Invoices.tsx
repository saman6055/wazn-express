import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Search, FileText, Download, Eye, Receipt,
  DollarSign, CheckCircle2, AlertTriangle,
  ChevronLeft, ChevronRight, FileX2,
  TrendingUp, CalendarDays, Hash
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Invoices() {
  const { t, isRTL } = useTranslation();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // FIX: API returns { data, total, page, pageSize, totalPages } not a direct array
  const { data: invoicesResult, isLoading } = trpc.invoices.list.useQuery({ limit: 20, page: currentPage });
  const { data: customers } = trpc.customers.list.useQuery();

  const allInvoices = invoicesResult?.data || [];
  const totalPages = invoicesResult?.totalPages || 0;
  const totalCount = invoicesResult?.total || 0;

  const getCustomer = (customerId: number) => customers?.find(c => c.id === customerId);

  const statusConfig: Record<string, { labelKey: string; color: string; icon: typeof FileText }> = {
    draft: { labelKey: "invoicesList.draft", color: "bg-gray-100 dark:bg-gray-950/40 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800/60", icon: FileText },
    issued: { labelKey: "invoicesList.issued", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60", icon: CheckCircle2 },
    paid: { labelKey: "invoicesList.paid", color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60", icon: CheckCircle2 },
    partially_paid: { labelKey: "invoicesList.partiallyPaid", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60", icon: TrendingUp },
    cancelled: { labelKey: "invoicesList.cancelled", color: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60", icon: AlertTriangle },
    refunded: { labelKey: "invoicesList.refunded", color: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60", icon: AlertTriangle },
  };

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv: { customerId: number; invoiceNumber: string; status: string }) => {
      const customer = getCustomer(inv.customerId);
      const matchesSearch = !search ||
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (customer?.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
        (customer?.customerCode || "").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allInvoices, search, statusFilter, customers]);

  const stats = useMemo(() => {
    const totalAmount = allInvoices.reduce((sum: number, inv: { totalUsd?: string }) => sum + parseFloat(inv.totalUsd || "0"), 0);
    const now = new Date();
    const thisMonthInvoices = allInvoices.filter((inv: { createdAt: Date | string }) => {
      const d = new Date(inv.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthAmount = thisMonthInvoices.reduce((sum: number, inv: { totalUsd?: string }) => sum + parseFloat(inv.totalUsd || "0"), 0);
    const todayStr = now.toDateString();
    const todayInvoices = allInvoices.filter((inv: { createdAt: Date | string }) => new Date(inv.createdAt).toDateString() === todayStr);
    const todayAmount = todayInvoices.reduce((sum: number, inv: { totalUsd?: string }) => sum + parseFloat(inv.totalUsd || "0"), 0);
    return { totalAmount, thisMonthAmount, thisMonthCount: thisMonthInvoices.length, todayAmount, todayCount: todayInvoices.length };
  }, [allInvoices]);

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-teal-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"><Receipt className="h-7 w-7" /></div>
              <div>
                <h1 className="text-2xl font-bold">{t('invoicesList.title')}</h1>
                <p className="text-teal-100 text-sm">{t('invoicesList.subtitle')}</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-teal-200 text-xs">{t('invoicesList.totalAmount')}</p>
              <p className="text-3xl font-bold font-mono">${stats.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t('invoicesList.totalInvoices')}</p>
                  <p className="text-2xl font-bold mt-1">{totalCount}</p>
                </div>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-950/40 rounded-xl"><Hash className="h-5 w-5 text-slate-600 dark:text-slate-300" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-teal-600 dark:text-teal-300 font-medium">{t('invoicesList.totalAmount')}</p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300 font-mono mt-1">${stats.totalAmount.toFixed(0)}</p>
                </div>
                <div className="p-2.5 bg-teal-100 dark:bg-teal-950/40 rounded-xl"><DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-300" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">{t('invoicesList.thisMonth')} ({stats.thisMonthCount})</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-mono mt-1">${stats.thisMonthAmount.toFixed(0)}</p>
                </div>
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950/40 rounded-xl"><CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-300" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">{t('invoicesList.today')} ({stats.todayCount})</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono mt-1">${stats.todayAmount.toFixed(0)}</p>
                </div>
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl"><TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
                <Input placeholder={t('invoicesList.searchPlaceholder')} value={search}
                  onChange={(e) => setSearch(e.target.value)} className={isRTL ? "pr-9 h-10" : "pl-9 h-10"} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] h-10"><SelectValue placeholder={t('invoicesList.status')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('invoicesList.allStatuses')}</SelectItem>
                  <SelectItem value="draft">{t('invoicesList.draft')}</SelectItem>
                  <SelectItem value="issued">{t('invoicesList.issued')}</SelectItem>
                  <SelectItem value="paid">{t('invoicesList.paid')}</SelectItem>
                  <SelectItem value="partially_paid">{t('invoicesList.partiallyPaid')}</SelectItem>
                  <SelectItem value="cancelled">{t('invoicesList.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-800/50 rounded w-32" /><div className="h-4 bg-gray-200 dark:bg-gray-800/50 rounded w-24" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-800/50 rounded w-20" /><div className="h-4 bg-gray-200 dark:bg-gray-800/50 rounded flex-1" />
                  </div>
                ))}
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-gray-100 dark:bg-gray-950/40 rounded-2xl mb-4"><FileX2 className="h-10 w-10 text-gray-400" /></div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{t('invoicesList.noInvoices')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== "all" ? t('invoicesList.changeFilters') : t('invoicesList.noInvoicesYet')}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 dark:bg-gray-900/80 hover:bg-gray-50/80">
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoicesList.invoiceNumber')}</TableHead>
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoicesList.customer')}</TableHead>
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoicesList.date')}</TableHead>
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoicesList.total')}</TableHead>
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300">{t('invoicesList.status')}</TableHead>
                      <TableHead className="font-semibold text-gray-700 dark:text-gray-300 text-center">{t('invoicesList.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice: { id: number; customerId: number; invoiceNumber: string; status: string; totalUsd?: string; createdAt: Date | string; issuedAt?: Date | string | null }) => {
                      const customer = getCustomer(invoice.customerId);
                      const sc = statusConfig[invoice.status] || statusConfig.draft;
                      const StatusIcon = sc.icon;
                      return (
                        <TableRow key={invoice.id} className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                          onClick={() => navigate(`/invoices/${invoice.id}`)}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-teal-50 dark:bg-teal-950/40 rounded-lg"><FileText className="h-4 w-4 text-teal-600 dark:text-teal-300" /></div>
                              <span className="font-mono text-sm font-medium">{invoice.invoiceNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{customer?.fullName || t('invoicesList.unknown')}</p>
                            <p className="text-xs text-muted-foreground font-mono">{customer?.customerCode || ""}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(invoice.issuedAt || invoice.createdAt).toLocaleDateString("en-GB")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono font-semibold text-sm">${parseFloat(invoice.totalUsd || "0").toFixed(2)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${sc.color} text-xs px-2.5 py-1 gap-1.5 border`}>
                              <StatusIcon className="h-3 w-3" />{t(sc.labelKey)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-teal-50 hover:text-teal-600"
                                title={t('invoicesList.view')} onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                                title={t('invoicesList.download')} onClick={() => navigate(`/invoices/${invoice.id}`)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50 dark:bg-gray-900/50">
                    <p className="text-sm text-muted-foreground">
                      {t('invoicesList.showing')} {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalCount)} {t('invoicesList.of')} {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                        <PrevIcon className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                        <NextIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
