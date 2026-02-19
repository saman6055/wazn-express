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
import * as XLSX from 'xlsx';
import { SCANNER_MODULES, getModuleByType } from "@/constants/scannerModules";

// Format date for display
function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString('ku', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Format date for input
function formatDateForInput(date: Date) {
  return date.toISOString().split('T')[0];
}

export default function ScanReports() {
  const { t, language } = useTranslation();
  const isKurdish = language === "ku" || language === "ar";
  
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
        SCANNER_MODULES.forEach(m => grouped[date].modules[m.value] = 0);
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
  const exportToExcel = () => {
    const moduleLabels: Record<string, string> = {
      registered: isKurdish ? 'تۆماری خێرا' : 'Quick Register',
      in_batch: isKurdish ? 'خستنە ناو باچ' : 'Batch Assignment',
      received_local: isKurdish ? 'پشکنینی گەیشتن' : 'Arrival Verification',
      delivered: isKurdish ? 'گەیاندن بە کڕیار' : 'Customer Delivery',
    };
    
    const data = filteredScans.map((scan: any) => ({
      [isKurdish ? 'بەروار' : 'Date']: new Date(scan.scannedAt).toLocaleDateString(),
      [isKurdish ? 'تراکینگ' : 'Tracking']: scan.trackingNumber || scan.packageCode,
      [isKurdish ? 'جۆر' : 'Type']: moduleLabels[scan.scanType] || scan.scanType,
      [isKurdish ? 'بەکارهێنەر' : 'User']: scan.scannedBy || 'N/A',
      [isKurdish ? 'کات' : 'Time']: new Date(scan.scannedAt).toLocaleTimeString(),
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isKurdish ? 'ڕاپۆرتی سکان' : 'Scan Report');
    XLSX.writeFile(wb, `scan-report-${startDate}-${endDate}.xlsx`);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
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
                    {isKurdish ? "ڕاپۆرتی سکان" : "Scan Reports"}
                  </h1>
                  <p className="text-indigo-100 mt-1">
                    {isKurdish ? "شیکاری تەواوی کارەکانی سکان" : "Complete analysis of scanning operations"}
                  </p>
                </div>
              </div>
              
              {/* Export Button */}
              <Button 
                onClick={exportToExcel}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Download className="h-4 w-4 mr-2" />
                {isKurdish ? "داگرتنی Excel" : "Export Excel"}
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
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {isKurdish ? "لە:" : "From:"}
                  </span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    {isKurdish ? "بۆ:" : "To:"}
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
                    placeholder={isKurdish ? "گەڕان بە تراکینگ..." : "Search tracking..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={filterModule} onValueChange={setFilterModule}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2 text-slate-500" />
                    <SelectValue placeholder={isKurdish ? "هەموو" : "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {isKurdish ? "هەموو" : "All"}
                    </SelectItem>
                    {SCANNER_MODULES.map((module) => (
                      <SelectItem key={module.id} value={module.scanType}>
                        {isKurdish ? module.labelKu : module.labelEn}
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
                          {isKurdish ? module.labelKu : module.labelEn}
                        </p>
                        <p className="text-2xl font-bold text-slate-800">{module.count}</p>
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
                {isKurdish ? "پوختە" : "Overview"}
              </TabsTrigger>
              <TabsTrigger value="daily">
                {isKurdish ? "ڕۆژانە" : "Daily"}
              </TabsTrigger>
              <TabsTrigger value="details">
                {isKurdish ? "وردەکاری" : "Details"}
              </TabsTrigger>
            </TabsList>
            
            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Summary Card */}
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-indigo-600" />
                      {isKurdish ? "پوختەی ماوە" : "Period Summary"}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(startDate)} - {formatDate(endDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                        <p className="text-sm text-indigo-600 font-medium">
                          {isKurdish ? "کۆی سکان" : "Total Scans"}
                        </p>
                        <p className="text-3xl font-bold text-indigo-700">{totalScans}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                        <p className="text-sm text-emerald-600 font-medium">
                          {isKurdish ? "ئەمڕۆ" : "Today"}
                        </p>
                        <p className="text-3xl font-bold text-emerald-700">{todayTotal}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                        <p className="text-sm text-amber-600 font-medium">
                          {isKurdish ? "ڕۆژانە بە تێکڕا" : "Daily Average"}
                        </p>
                        <p className="text-3xl font-bold text-amber-700">
                          {dailyReport.length > 0 ? Math.round(totalScans / dailyReport.length) : 0}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
                        <p className="text-sm text-blue-600 font-medium">
                          {isKurdish ? "ژمارەی ڕۆژ" : "Days"}
                        </p>
                        <p className="text-3xl font-bold text-blue-700">{dailyReport.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Module Breakdown */}
                <Card className="border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-purple-600" />
                      {isKurdish ? "شیکاری مۆدیولەکان" : "Module Breakdown"}
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
                                <span className="text-sm font-medium text-slate-700">
                                  {isKurdish ? module.labelKu : module.labelEn}
                                </span>
                                <span className="text-sm font-bold text-slate-800">
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
                    <Calendar className="h-5 w-5 text-indigo-600" />
                    {isKurdish ? "ڕاپۆرتی ڕۆژانە" : "Daily Report"}
                  </CardTitle>
                  <CardDescription>
                    {isKurdish ? "شیکاری سکان بە ڕۆژ" : "Scan analysis by day"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isKurdish ? "بەروار" : "Date"}</TableHead>
                        {SCANNER_MODULES.map((module) => (
                          <TableHead key={module.id} className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <module.icon className={`h-4 w-4 ${module.textColor}`} />
                              <span className="hidden md:inline">
                                {isKurdish ? module.labelKu : module.labelEn}
                              </span>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center">
                          {isKurdish ? "کۆ" : "Total"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyReport.slice(0, 15).map((day: any) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">
                            {new Date(day.date).toLocaleDateString('ku', { 
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
                    <div className="text-center py-12 text-slate-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{isKurdish ? "هیچ داتایەک نییە" : "No data available"}</p>
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
                        <Clock className="h-5 w-5 text-indigo-600" />
                        {isKurdish ? "وردەکاری سکانەکان" : "Scan Details"}
                      </CardTitle>
                      <CardDescription>
                        {filteredScans.length} {isKurdish ? "سکان" : "scans"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isKurdish ? "تراکینگ" : "Tracking"}</TableHead>
                        <TableHead>{isKurdish ? "جۆر" : "Type"}</TableHead>
                        <TableHead>{isKurdish ? "بەروار" : "Date"}</TableHead>
                        <TableHead>{isKurdish ? "کات" : "Time"}</TableHead>
                        <TableHead>{isKurdish ? "بەکارهێنەر" : "User"}</TableHead>
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
                                <Icon className="h-3 w-3 mr-1" />
                                {isKurdish ? module.labelKu : module.labelEn}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(scan.scannedAt).toLocaleDateString('ku')}
                            </TableCell>
                            <TableCell className="text-slate-500">
                              {new Date(scan.scannedAt).toLocaleTimeString('ku')}
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
                    <div className="text-center py-12 text-slate-500">
                      <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>{isKurdish ? "هیچ سکانێک نییە" : "No scans found"}</p>
                    </div>
                  )}
                  
                  {filteredScans.length > 50 && (
                    <div className="text-center py-4 text-slate-500 border-t">
                      <p className="text-sm">
                        {isKurdish 
                          ? `${filteredScans.length - 50} سکانی تر هەیە...` 
                          : `${filteredScans.length - 50} more scans...`
                        }
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
