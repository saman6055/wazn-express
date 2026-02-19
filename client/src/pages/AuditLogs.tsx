import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import { 
  Search, History, Eye, Filter, Calendar, User, Activity, 
  Package, Users, Settings, DollarSign, Truck, ShoppingCart,
  FileText, ChevronLeft, ChevronRight, RefreshCw, ArrowUpRight,
  Clock, Layers, TrendingUp, AlertCircle, CheckCircle, XCircle,
  Edit, Plus, Trash2, RotateCcw, Download, FileSpreadsheet, Printer
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

// Category icons and colors
const categoryConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  customer: { icon: Users, color: "text-blue-600", bgColor: "bg-blue-100", label: "کڕیارەکان" },
  package: { icon: Package, color: "text-purple-600", bgColor: "bg-purple-100", label: "پاکەتەکان" },
  batch: { icon: Truck, color: "text-orange-600", bgColor: "bg-orange-100", label: "باچەکان" },
  full_package: { icon: ShoppingCart, color: "text-green-600", bgColor: "bg-green-100", label: "فول پاکیج" },

  commission: { icon: DollarSign, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "کڕین بە عمولە" },
  finance: { icon: DollarSign, color: "text-emerald-600", bgColor: "bg-emerald-100", label: "دارایی" },
  settings: { icon: Settings, color: "text-gray-600", bgColor: "bg-gray-100", label: "ڕێکخستنەکان" },
  user: { icon: User, color: "text-indigo-600", bgColor: "bg-indigo-100", label: "بەکارهێنەرەکان" },
  system: { icon: Activity, color: "text-red-600", bgColor: "bg-red-100", label: "سیستەم" },
};

// Action icons and colors
const actionConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  create: { icon: Plus, color: "text-green-600", bgColor: "bg-green-100", label: "دروستکردن" },
  update: { icon: Edit, color: "text-blue-600", bgColor: "bg-blue-100", label: "نوێکردنەوە" },
  delete: { icon: Trash2, color: "text-red-600", bgColor: "bg-red-100", label: "سڕینەوە" },
  status_change: { icon: RefreshCw, color: "text-orange-600", bgColor: "bg-orange-100", label: "گۆڕینی بارودۆخ" },
  charge: { icon: DollarSign, color: "text-purple-600", bgColor: "bg-purple-100", label: "چارج کردن" },
  payment: { icon: DollarSign, color: "text-emerald-600", bgColor: "bg-emerald-100", label: "پارەدان" },
  refund: { icon: RotateCcw, color: "text-yellow-600", bgColor: "bg-yellow-100", label: "گەڕاندنەوە" },
};

// Get action type from action string
const getActionType = (action: string): string => {
  if (action.startsWith("create") || action.includes("_create")) return "create";
  if (action.startsWith("update") || action.includes("_update")) return "update";
  if (action.startsWith("delete") || action.includes("_delete")) return "delete";
  if (action.includes("status")) return "status_change";
  if (action.includes("charge")) return "charge";
  if (action.includes("payment") || action.includes("refund")) return "payment";
  return "update";
};

// Field labels in Kurdish
const fieldLabels: Record<string, string> = {
  name: "ناو",
  phone: "ژمارەی تەلەفۆن",
  email: "ئیمەیل",
  status: "بارودۆخ",
  price: "نرخ",
  weight: "کێش",
  trackingNumber: "تراکینگ نەمبەر",
  customerCode: "کۆدی کڕیار",
  description: "وەسف",
  notes: "تێبینی",
  quantity: "عەدەد",
  purchasePriceUsd: "نرخی کڕین",
  sellingPriceUsd: "نرخی فرۆشتن",
  shippingCostUsd: "نرخی گواستنەوە",
  profitUsd: "قازانج",
  balanceUsd: "بالانس",
  isActive: "چالاک",
  role: "ڕۆڵ",
  address: "ناونیشان",
  city: "شار",
  country: "وڵات",
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");
  const pageSize = 50;

  // Date preset options
  const datePresets = [
    { value: "all", label: "هەموو کات" },
    { value: "today", label: "ئەمڕۆ" },
    { value: "yesterday", label: "دوێنێ" },
    { value: "week", label: "٧ ڕۆژی ڕابردوو" },
    { value: "month", label: "٣٠ ڕۆژی ڕابردوو" },
    { value: "thisMonth", label: "ئەم مانگە" },
  ];

  // Apply date preset
  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case "today":
        setDateFrom(today.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case "yesterday":
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setDateFrom(yesterday.toISOString().split('T')[0]);
        setDateTo(yesterday.toISOString().split('T')[0]);
        break;
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setDateFrom(weekAgo.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case "month":
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        setDateFrom(monthAgo.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      case "thisMonth":
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setDateFrom(firstOfMonth.toISOString().split('T')[0]);
        setDateTo(today.toISOString().split('T')[0]);
        break;
      default:
        setDateFrom("");
        setDateTo("");
    }
    setPage(0);
  };

  // Fetch data with filters
  const { data: logsData, isLoading, refetch } = trpc.auditLogs.list.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  // Export to Excel (CSV)
  const exportToExcel = () => {
    if (logs.length === 0) {
      toast.error("هیچ داتایەک نییە بۆ هەناردەکردن");
      return;
    }
    
    // BOM for UTF-8
    const BOM = "\uFEFF";
    const headers = ["بەروار", "کات", "پۆل", "چالاکی", "بەکارهێنەر", "وەسف", "کۆد"];
    const rows = logs.map((log: any) => [
      new Date(log.createdAt).toLocaleDateString('ku'),
      new Date(log.createdAt).toLocaleTimeString('ku'),
      categoryConfig[log.category]?.label || log.category,
      log.actionLabel || log.action,
      log.userName || getUserName(log.userId),
      log.description || "-",
      log.entityCode || "-",
    ]);
    
    const csvContent = BOM + [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("فایلی Excel دابەزێنرا");
  };

  // Export to PDF (Print)
  const exportToPDF = () => {
    if (logs.length === 0) {
      toast.error("هیچ داتایەک نییە بۆ هەناردەکردن");
      return;
    }
    const company = getCompanyInfoFromSettings(settings || []);
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ku">
      <head>
        <meta charset="UTF-8">
        <title>تۆماری چالاکییەکان - ${company.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
          * { font-family: 'Noto Sans Arabic', sans-serif; box-sizing: border-box; }
          body { padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
          .header h1 { color: #10b981; margin: 0; font-size: 24px; }
          .header p { color: #666; margin: 5px 0 0; }
          .filters { background: #f5f5f5; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #10b981; color: white; padding: 10px 8px; text-align: right; }
          td { padding: 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #f9f9f9; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
          .badge-create { background: #dcfce7; color: #166534; }
          .badge-update { background: #dbeafe; color: #1e40af; }
          .badge-delete { background: #fee2e2; color: #991b1b; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔍 تۆماری چالاکییەکان</h1>
          <p>${company.name} - ${new Date().toLocaleDateString('ku')}</p>
        </div>
        <div class="filters">
          <strong>فلتەرەکان:</strong>
          ${categoryFilter !== "all" ? `پۆل: ${categoryConfig[categoryFilter]?.label || categoryFilter}` : ""}
          ${actionFilter !== "all" ? ` | چالاکی: ${actionFilter}` : ""}
          ${dateFrom ? ` | لە: ${dateFrom}` : ""}
          ${dateTo ? ` | بۆ: ${dateTo}` : ""}
          ${search ? ` | گەڕان: ${search}` : ""}
          | کۆی ئەنجام: ${total}
        </div>
        <table>
          <thead>
            <tr>
              <th>بەروار و کات</th>
              <th>پۆل</th>
              <th>چالاکی</th>
              <th>بەکارهێنەر</th>
              <th>وەسف</th>
              <th>کۆد</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((log: any) => {
              const actionType = getActionType(log.action);
              return `
                <tr>
                  <td>${new Date(log.createdAt).toLocaleString('ku')}</td>
                  <td>${categoryConfig[log.category]?.label || log.category}</td>
                  <td><span class="badge badge-${actionType}">${log.actionLabel || log.action}</span></td>
                  <td>${log.userName || getUserName(log.userId)}</td>
                  <td>${log.description || "-"}</td>
                  <td>${log.entityCode || "-"}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <div class="footer">
          چاپکرا لە ${new Date().toLocaleString('ku')} | ${company.name} Audit Logs
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    toast.success("ئامادەی چاپکردن");
  };

  const { data: stats } = trpc.auditLogs.getStats.useQuery();
  const { data: filters } = trpc.auditLogs.getFilters.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();

  const logs = logsData?.logs || [];
  const total = logsData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getUserName = (userId: number | null, userName?: string | null) => {
    if (userName) return userName;
    if (!userId) return "سیستەم";
    return users?.find(u => u.id === userId)?.name || "نەزانراو";
  };

  const getEntityLink = (log: any): string | null => {
    const { entityType, entityId, entityCode } = log;
    if (!entityId && !entityCode) return null;
    
    switch (entityType) {
      case "Customer":
      case "customer":
        return `/customers/${entityId}`;
      case "Package":
      case "package":
        return `/packages/${entityId}`;
      case "FullPackageOrder":
      case "full_package_order":
        return `/full-package/${entityId}`;
      case "Batch":
      case "batch":
        return `/batches/${entityId}`;

      default:
        return null;
    }
  };

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "بەڵێ" : "نەخێر";
    if (typeof value === "number") return value.toLocaleString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const renderDiff = (oldValues: any, newValues: any, changedFields: string[]) => {
    if (!changedFields || changedFields.length === 0) {
      // Show all new values if no changed fields
      if (newValues) {
        return (
          <div className="space-y-2">
            {Object.entries(newValues).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground min-w-[120px]">
                  {fieldLabels[key] || key}:
                </span>
                <span className="text-green-600">{formatFieldValue(value)}</span>
              </div>
            ))}
          </div>
        );
      }
      return null;
    }

    return (
      <div className="space-y-3">
        {changedFields.map(field => {
          const oldVal = oldValues?.[field];
          const newVal = newValues?.[field];
          return (
            <div key={field} className="border-b pb-2 last:border-0">
              <div className="font-medium text-sm mb-1">{fieldLabels[field] || field}</div>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex-1 p-2 bg-red-50 rounded border border-red-200">
                  <span className="text-red-600 line-through">{formatFieldValue(oldVal)}</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 p-2 bg-green-50 rounded border border-green-200">
                  <span className="text-green-600">{formatFieldValue(newVal)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-6 w-6" />
              تۆماری چالاکییەکان
            </h1>
            <p className="text-muted-foreground">شوێنکەوتنی هەموو گۆڕانکاریەکان لە سیستەم</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            نوێکردنەوە
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <History className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.total?.toLocaleString() || 0}</div>
                  <div className="text-sm text-muted-foreground">کۆی تۆمارەکان</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-200 rounded-lg">
                  <Plus className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">
                    {Object.entries(stats?.byAction || {})
                      .filter(([k]) => k.includes('create'))
                      .reduce((sum, [, v]) => sum + (v as number), 0)
                      .toLocaleString()}
                  </div>
                  <div className="text-sm text-green-600">دروستکردن</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Edit className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">
                    {Object.entries(stats?.byAction || {})
                      .filter(([k]) => k.includes('update'))
                      .reduce((sum, [, v]) => sum + (v as number), 0)
                      .toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-600">نوێکردنەوە</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-200 rounded-lg">
                  <Trash2 className="h-5 w-5 text-red-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-700">
                    {Object.entries(stats?.byAction || {})
                      .filter(([k]) => k.includes('delete'))
                      .reduce((sum, [, v]) => sum + (v as number), 0)
                      .toLocaleString()}
                  </div>
                  <div className="text-sm text-red-600">سڕینەوە</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-200 rounded-lg">
                  <Layers className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-700">
                    {Object.keys(stats?.byCategory || {}).length}
                  </div>
                  <div className="text-sm text-purple-600">پۆلەکان</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date Range Filter & Export */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Presets */}
          <div className="flex flex-wrap gap-2">
            {datePresets.map(preset => (
              <Button
                key={preset.value}
                variant={datePreset === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => applyDatePreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          {/* Custom Date Range */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset("custom");
                  setPage(0);
                }}
                className="w-[140px] h-9"
              />
            </div>
            <span className="text-muted-foreground">بۆ</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset("custom");
                setPage(0);
              }}
              className="w-[140px] h-9"
            />
          </div>
          
          {/* Export Buttons */}
          <div className="flex gap-2 mr-auto">
            <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1">
              <Printer className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        {/* Category Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter("all")}
            className="gap-1"
          >
            <Layers className="h-4 w-4" />
            هەموو
          </Button>
          {filters?.categories?.map(cat => {
            const config = categoryConfig[cat.value] || categoryConfig.system;
            const Icon = config.icon;
            const count = stats?.byCategory?.[cat.value] || 0;
            return (
              <Button
                key={cat.value}
                variant={categoryFilter === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(cat.value)}
                className="gap-1"
              >
                <Icon className="h-4 w-4" />
                {cat.label}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="گەڕان بە ناو، کۆد، یان وەسف..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    className="pl-9"
                  />
                </div>
                
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="جۆری چالاکی" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">هەموو چالاکییەکان</SelectItem>
                    {filters?.actions?.map(action => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {total.toLocaleString()} تۆمار
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">هیچ تۆمارێک نەدۆزرایەوە</h3>
                <p className="text-muted-foreground">هیچ چالاکییەک بەم فلتەرانە نییە</p>
              </div>
            ) : (
              <div className="divide-y">
                {logs.map((log: any) => {
                  const actionType = getActionType(log.action);
                  const actionConf = actionConfig[actionType] || actionConfig.update;
                  const catConf = categoryConfig[log.category] || categoryConfig.system;
                  const ActionIcon = actionConf.icon;
                  const CatIcon = catConf.icon;
                  const entityLink = getEntityLink(log);
                  
                  return (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-start gap-4">
                        {/* Action Icon */}
                        <div className={`p-2 rounded-lg ${actionConf.bgColor}`}>
                          <ActionIcon className={`h-5 w-5 ${actionConf.color}`} />
                        </div>
                        
                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">
                                  {log.actionLabel || log.action.replace(/_/g, " ")}
                                </span>
                                <Badge variant="outline" className={`${catConf.bgColor} ${catConf.color} border-0`}>
                                  <CatIcon className="h-3 w-3 mr-1" />
                                  {catConf.label}
                                </Badge>
                                {log.entityCode && (
                                  <Badge variant="secondary" className="font-mono">
                                    {log.entityCode}
                                  </Badge>
                                )}
                              </div>
                              
                              {log.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {log.description}
                                </p>
                              )}
                              
                              {/* Changed Fields Preview */}
                              {log.changedFields && log.changedFields.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {log.changedFields.slice(0, 3).map((field: string) => (
                                    <Badge key={field} variant="outline" className="text-xs">
                                      {fieldLabels[field] || field}
                                    </Badge>
                                  ))}
                                  {log.changedFields.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{log.changedFields.length - 3} تر
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-3 w-3" />
                                {getUserName(log.userId, log.userName)}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                {new Date(log.createdAt).toLocaleString("ku-IQ")}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* View Button */}
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                  پەڕە {page + 1} لە {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                    پێشوو
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    دواتر
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log Details Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                وردەکاریی تۆمار
              </DialogTitle>
              <DialogDescription>
                {selectedLog?.description || selectedLog?.action?.replace(/_/g, " ")}
              </DialogDescription>
            </DialogHeader>
            
            {selectedLog && (
              <div className="space-y-6">
                {/* Meta Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">کات</div>
                    <div className="font-medium text-sm">
                      {new Date(selectedLog.createdAt).toLocaleString("ku-IQ")}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">بەکارهێنەر</div>
                    <div className="font-medium text-sm">
                      {getUserName(selectedLog.userId, selectedLog.userName)}
                    </div>
                    {selectedLog.userRole && (
                      <div className="text-xs text-muted-foreground">{selectedLog.userRole}</div>
                    )}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">پۆل</div>
                    <div className="font-medium text-sm">
                      {categoryConfig[selectedLog.category]?.label || selectedLog.category}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">چالاکی</div>
                    <div className="font-medium text-sm">
                      {selectedLog.actionLabel || selectedLog.action}
                    </div>
                  </div>
                </div>
                
                {/* Entity Link */}
                {getEntityLink(selectedLog) && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <ArrowUpRight className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-700">کۆد: {selectedLog.entityCode || selectedLog.entityId}</span>
                    <Link href={getEntityLink(selectedLog)!}>
                      <Button variant="link" size="sm" className="text-blue-600 p-0 h-auto">
                        بینینی وردەکاری
                      </Button>
                    </Link>
                  </div>
                )}
                
                {/* Changes Diff */}
                {(selectedLog.changedFields?.length > 0 || selectedLog.newValues) && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      گۆڕانکاریەکان
                    </h4>
                    <div className="border rounded-lg p-4 bg-muted/30">
                      {renderDiff(selectedLog.oldValues, selectedLog.newValues, selectedLog.changedFields)}
                    </div>
                  </div>
                )}
                
                {/* Raw Data (Collapsible) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    پیشاندانی داتای خام
                  </summary>
                  <div className="mt-3 space-y-3">
                    {selectedLog.oldValues && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">بەهای پێشوو</p>
                        <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40 font-mono">
                          {JSON.stringify(selectedLog.oldValues, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.newValues && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">بەهای نوێ</p>
                        <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40 font-mono">
                          {JSON.stringify(selectedLog.newValues, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.metadata && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">زانیاری زیادە</p>
                        <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40 font-mono">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
                
                {/* Technical Info */}
                {(selectedLog.ipAddress || selectedLog.userAgent) && (
                  <div className="text-xs text-muted-foreground border-t pt-4">
                    {selectedLog.ipAddress && <div>IP: {selectedLog.ipAddress}</div>}
                    {selectedLog.userAgent && <div className="truncate">User Agent: {selectedLog.userAgent}</div>}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
