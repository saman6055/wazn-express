import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, Download, Calendar, TrendingUp, 
  Package, Clock, Users, Filter, Search,
  QrCode, Boxes, Truck, CreditCard, FileDown,
  ChevronDown, Printer, Activity, ArrowUpRight,
  ArrowDownRight, Minus
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { SCANNER_MODULES, getModuleByType } from "@/constants/scannerModules";

// Locale code for date/number formatting based on active UI language
function localeCode(lang: string | undefined) {
  return pickLang(lang, { ku: 'ku', en: 'en-US', ar: 'ar', zh: 'zh-CN' });
}

// Format date for display
function formatDate(date: Date | string, lang: string | undefined) {
  const d = new Date(date);
  return d.toLocaleDateString(localeCode(lang), { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format date for input
function formatDateForInput(date: Date) {
  return date.toISOString().split('T')[0];
}

export default function ScanReports() {
  const { t, language } = useTranslation();

  // Date range state
  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return formatDateForInput(d);
  });
  const [endDate, setEndDate] = useState(() => formatDateForInput(today));
  const [filterModule, setFilterModule] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch scan data
  const { data: scansByDateRange, isLoading: loadingScans } = trpc.scanReports.getByDateRange.useQuery({
    startDate,
    endDate,
  });
  
  // Fetch today's stats
  const { data: todayStats } = trpc.scanning.todayStats.useQuery();
  
  // Calculate module stats
  const moduleStats = useMemo(() => {
    if (!scansByDateRange) return [];
    
    return SCANNER_MODULES.map(module => {
      const scans = scansByDateRange.filter((s: any) => s.scanType === module.scanType);
      return {
        ...module,
        count: scans.length,
        percentage: scansByDateRange.length > 0 
          ? Math.round((scans.length / scansByDateRange.length) * 100) 
          : 0
      };
    });
  }, [scansByDateRange]);
  
  // Filter scans
  const filteredScans = useMemo(() => {
    if (!scansByDateRange) return [];
    
    return scansByDateRange.filter((scan: any) => {
      const matchesModule = filterModule === "all" || scan.scanType === filterModule;
      const matchesSearch = !searchTerm || 
        scan.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.packageCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesModule && matchesSearch;
    });
  }, [scansByDateRange, filterModule, searchTerm]);
  
  // Group by date for daily report
  const dailyReport = useMemo(() => {
    const grouped: Record<string, any> = {};
    
    filteredScans.forEach((scan: any) => {
      const date = new Date(scan.scannedAt).toLocaleDateString('en-CA');
      if (!grouped[date]) {
        grouped[date] = { date, total: 0, modules: {} };
        SCANNER_MODULES.forEach(m => grouped[date].modules[m.scanType] = 0);
      }
      grouped[date].total++;
      if (grouped[date].modules[scan.scanType] !== undefined) {
        grouped[date].modules[scan.scanType]++;
      }
    });
    
    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredScans]);
  
  // Calculate totals
  const totalScans = scansByDateRange?.length || 0;
  const todayTotal = todayStats?.reduce((sum: number, s: any) => sum + s.count, 0) || 0;
  
  // Export to Excel
  const exportToExcel = async () => {
    const moduleLabels: Record<string, string> = {
      registered: pickLang(language, { ku: 'تۆماری خێرا', en: 'Quick Register', ar: 'تسجيل سريع', zh: '快速登记' }),
      in_batch: pickLang(language, { ku: 'خستنە ناو باچ', en: 'Batch Assignment', ar: 'إسناد إلى دفعة', zh: '批次分配' }),
      received_local: pickLang(language, { ku: 'پشکنینی گەیشتن', en: 'Arrival Verification', ar: 'التحقق من الوصول', zh: '到货核验' }),
      delivered: pickLang(language, { ku: 'گەیاندن بە کڕیار', en: 'Customer Delivery', ar: 'التسليم للعميل', zh: '客户交付' }),
    };

    const data = filteredScans.map((scan: any) => ({
      [pickLang(language, { ku: 'بەروار', en: 'Date', ar: 'التاريخ', zh: '日期' })]: new Date(scan.scannedAt).toLocaleDateString(),
      [pickLang(language, { ku: 'تراکینگ', en: 'Tracking', ar: 'رقم التتبع', zh: '运单号' })]: scan.trackingNumber || scan.packageCode,
      [pickLang(language, { ku: 'جۆر', en: 'Type', ar: 'النوع', zh: '类型' })]: moduleLabels[scan.scanType] || scan.scanType,
      [pickLang(language, { ku: 'بەکارهێنەر', en: 'User', ar: 'المستخدم', zh: '用户' })]: scan.scannedBy || 'N/A',
      [pickLang(language, { ku: 'کات', en: 'Time', ar: 'الوقت', zh: '时间' })]: new Date(scan.scannedAt).toLocaleTimeString(),
    }));

    // Loaded on demand so the heavy xlsx bundle stays out of the page chunk.
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, pickLang(language, { ku: 'ڕاپۆرتی سکان', en: 'Scan Report', ar: 'تقرير المسح', zh: '扫描报告' }));
    XLSX.writeFile(wb, `scan-report-${startDate}-${endDate}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
          
          <div className="container py-8 relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    {pickLang(language, { ku: "ڕاپۆرتی سکان", en: "Scan Reports", ar: "تقارير المسح", zh: "扫描报告" })}
                  </h1>
                  <p className="text-indigo-100 mt-1">
                    {pickLang(language, { ku: "شیکاری تەواوی کارەکانی سکان", en: "Complete analysis of scanning operations", ar: "تحليل شامل لعمليات المسح", zh: "扫描操作的完整分析" })}
                  </p>
                </div>
              </div>
              
              {/* Export Button */}
              <Button 
                onClick={exportToExcel}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Download className="h-4 w-4 me-2" />
                {pickLang(language, { ku: "داگرتنی Excel", en: "Export Excel", ar: "تصدير Excel", zh: "导出 Excel" })}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="container py-8">
          {/* Date Range & Filters */}
          <Card className="border-0 shadow-lg mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {pickLang(language, { ku: "لە:", en: "From:", ar: "من:", zh: "从：" })}
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {pickLang(language, { ku: "بۆ:", en: "To:", ar: "إلى:", zh: "至：" })}
                  </span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex-1" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={pickLang(language, { ku: "گەڕان بە تراکینگ...", en: "Search tracking...", ar: "البحث برقم التتبع...", zh: "搜索运单号…" })}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={filterModule} onValueChange={setFilterModule}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 me-2 text-slate-500 dark:text-slate-400" />
                    <SelectValue placeholder={pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}
                    </SelectItem>
                    {SCANNER_MODULES.map((module) => (
                      <SelectItem key={module.id} value={module.scanType}>
                        {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          {/* Module Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {moduleStats.map((module) => {
              const Icon = module.icon;
              const isActive = filterModule === module.scanType;
              
              return (
                <Card 
                  key={module.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-lg border-2 ${
                    isActive 
                      ? `${module.borderColor} ${module.lightColor}` 
                      : 'border-transparent hover:border-slate-200'
                  }`}
                  onClick={() => setFilterModule(isActive ? "all" : module.scanType)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 ${module.color} rounded-xl shadow-sm`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${module.textColor} truncate`}>
                          {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                        </p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{module.count}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {module.percentage}%
                      </Badge>
                    </div>
                    <Progress value={module.percentage} className="h-1.5 mt-3" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="overview">
                {pickLang(language, { ku: "پوختە", en: "Overview", ar: "نظرة عامة", zh: "概览" })}
              </TabsTrigger>
              <TabsTrigger value="daily">
                {pickLang(language, { ku: "ڕۆژانە", en: "Daily", ar: "يومي", zh: "每日" })}
              </TabsTrigger>
              <TabsTrigger value="details">
                {pickLang(language, { ku: "وردەکاری", en: "Details", ar: "التفاصيل", zh: "明细" })}
              </TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Summary Card */}
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                      {pickLang(language, { ku: "پوختەی ماوە", en: "Period Summary", ar: "ملخص الفترة", zh: "周期汇总" })}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(startDate, language)} - {formatDate(endDate, language)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 dark:from-indigo-950/40 to-purple-50 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-800/60">
                        <p className="text-sm text-indigo-600 dark:text-indigo-300 font-medium">
                          {pickLang(language, { ku: "کۆی سکان", en: "Total Scans", ar: "إجمالي عمليات المسح", zh: "扫描总数" })}
                        </p>
                        <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{totalScans}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 dark:from-emerald-950/40 to-teal-50 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-800/60">
                        <p className="text-sm text-emerald-600 dark:text-emerald-300 font-medium">
                          {pickLang(language, { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" })}
                        </p>
                        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{todayTotal}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 dark:from-amber-950/40 to-orange-50 dark:to-orange-950/40 border border-amber-100 dark:border-amber-800/60">
                        <p className="text-sm text-amber-600 dark:text-amber-300 font-medium">
                          {pickLang(language, { ku: "ڕۆژانە بە تێکڕا", en: "Daily Average", ar: "المعدل اليومي", zh: "日均" })}
                        </p>
                        <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                          {dailyReport.length > 0 ? Math.round(totalScans / dailyReport.length) : 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 dark:from-blue-950/40 to-cyan-50 dark:to-cyan-950/40 border border-blue-100 dark:border-blue-800/60">
                        <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">
                          {pickLang(language, { ku: "ژمارەی ڕۆژ", en: "Days", ar: "الأيام", zh: "天数" })}
                        </p>
                        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{dailyReport.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Module Breakdown */}
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      {pickLang(language, { ku: "شیکاری مۆدیولەکان", en: "Module Breakdown", ar: "تفصيل الوحدات", zh: "模块明细" })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {moduleStats.map((module) => {
                        const Icon = module.icon;
                        return (
                          <div key={module.id} className="flex items-center gap-4">
                            <div className={`p-2 ${module.color} rounded-lg`}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                                </span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                  {module.count}
                                </span>
                              </div>
                              <Progress value={module.percentage} className="h-2" />
                            </div>
                            <Badge variant="secondary" className={`${module.lightColor} ${module.textColor}`}>
                              {module.percentage}%
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Daily Tab */}
            <TabsContent value="daily">
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                    {pickLang(language, { ku: "ڕاپۆرتی ڕۆژانە", en: "Daily Report", ar: "التقرير اليومي", zh: "每日报告" })}
                  </CardTitle>
                  <CardDescription>
                    {pickLang(language, { ku: "شیکاری سکان بە ڕۆژ", en: "Scan analysis by day", ar: "تحليل المسح حسب اليوم", zh: "按日扫描分析" })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                        {SCANNER_MODULES.map((module) => (
                          <TableHead key={module.id} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <module.icon className={`h-4 w-4 ${module.textColor}`} />
                              <span className="hidden md:inline">
                                {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">
                          {pickLang(language, { ku: "کۆ", en: "Total", ar: "الإجمالي", zh: "合计" })}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReport.slice(0, 15).map((day: any) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">
                            {new Date(day.date).toLocaleDateString(localeCode(language), {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          {SCANNER_MODULES.map((module) => (
                            <TableCell key={module.id} className="text-center">
                              <Badge variant="secondary" className={`${module.lightColor} ${module.textColor}`}>
                                {day.modules[module.scanType] || 0}
                              </Badge>
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            <Badge className="bg-slate-800 text-white">
                              {day.total}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {dailyReport.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{pickLang(language, { ku: "هیچ داتایەک نییە", en: "No data available", ar: "لا توجد بيانات متاحة", zh: "暂无数据" })}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Details Tab */}
            <TabsContent value="details">
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                        {pickLang(language, { ku: "وردەکاری سکانەکان", en: "Scan Details", ar: "تفاصيل المسح", zh: "扫描明细" })}
                      </CardTitle>
                      <CardDescription>
                        {filteredScans.length} {pickLang(language, { ku: "سکان", en: "scans", ar: "عملية مسح", zh: "次扫描" })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "رقم التتبع", zh: "运单号" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "کات", en: "Time", ar: "الوقت", zh: "时间" })}</TableHead>
                        <TableHead>{pickLang(language, { ku: "بەکارهێنەر", en: "User", ar: "المستخدم", zh: "用户" })}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredScans.slice(0, 50).map((scan: any, index: number) => {
                        const module = getModuleByType(scan.scanType) ?? SCANNER_MODULES[0];
                        const Icon = module.icon;
                        return (
                          <TableRow key={scan.id || index}>
                            <TableCell className="font-mono text-sm">
                              {scan.trackingNumber || scan.packageCode || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${module.lightColor} ${module.textColor}`}>
                                <Icon className="h-3 w-3 me-1" />
                                {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(scan.scannedAt).toLocaleDateString(localeCode(language))}
                            </TableCell>
                            <TableCell className="text-slate-500 dark:text-slate-400">
                              {new Date(scan.scannedAt).toLocaleTimeString(localeCode(language))}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-slate-400" />
                                <span className="text-sm">{scan.scannedBy || "System"}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {filteredScans.length === 0 && (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{pickLang(language, { ku: "هیچ سکانێک نییە", en: "No scans found", ar: "لم يتم العثور على عمليات مسح", zh: "未找到扫描记录" })}</p>
                    </div>
                  )}
                  
                  {filteredScans.length > 50 && (
                    <div className="text-center py-4 text-slate-500 dark:text-slate-400 border-t">
                      <p className="text-sm">
                        {pickLang(language, {
                          ku: `${filteredScans.length - 50} سکانی تر هەیە...`,
                          en: `${filteredScans.length - 50} more scans...`,
                          ar: `${filteredScans.length - 50} عملية مسح أخرى...`,
                          zh: `还有 ${filteredScans.length - 50} 次扫描…`,
                        })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
