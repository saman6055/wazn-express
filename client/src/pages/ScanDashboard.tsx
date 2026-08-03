import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  QrCode, Boxes, Truck, CreditCard, Activity, 
  TrendingUp, Clock, Package, CheckCircle2, AlertTriangle,
  ArrowRight, BarChart3, Users, Calendar, Zap,
  Target, Award, ChevronRight, Sparkles
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { Link } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { SCANNER_MODULES } from "@/constants/scannerModules";

export default function ScanDashboard() {
  const { t, language } = useTranslation();

  // Get today's stats
  const { data: todayStats } = trpc.scanning.todayStats.useQuery();

  // Real analytics from DB (last 7 days)
  const { data: analytics } = trpc.scanning.scanAnalytics.useQuery({ days: 7 });

  // Get my recent scans
  const { data: recentScans, isLoading } = trpc.scanning.myRecentScans.useQuery({ limit: 50 });

  // Get packages missing info
  const { data: missingInfo } = trpc.scanning.getMissingInfo.useQuery();

  // Module stats from analytics (scansByType) or fallback to recent scans
  const moduleStats: Record<string, number> = (() => {
    const fallback = {
      registered: recentScans?.filter((s: any) => s.scanType === "registered" || s.notes?.includes("register")).length || 0,
      in_batch: recentScans?.filter((s: any) => s.scanType === "in_batch" || s.notes?.includes("batch")).length || 0,
      received_local: recentScans?.filter((s: any) => s.scanType === "received_local" || s.notes?.includes("arrive")).length || 0,
      delivered: recentScans?.filter((s: any) => s.scanType === "delivered" || s.notes?.includes("deliver")).length || 0,
    };
    if (analytics?.scansByType?.length) {
      const byType: Record<string, number> = { registered: 0, in_batch: 0, received_local: 0, delivered: 0 };
      analytics.scansByType.forEach((row: { scanType: string; count: number }) => {
        byType[row.scanType] = row.count;
      });
      return byType;
    }
    return fallback;
  })();

  const totalScans = recentScans?.length || 0;
  const todayTotal = todayStats?.reduce((sum: number, s: any) => sum + s.count, 0) || 0;

  // Daily scans for chart (from analytics)
  const dailyScansForChart = analytics?.dailyScans ?? [];

  // Get recent 5 scans for quick view
  const latestScans = recentScans?.slice(0, 5) || [];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 via-cyan-700 to-teal-700 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
          
          <div className="container py-8 relative">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                  <Activity className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    {pickLang(language, { ku: "داشبۆردی سکان", en: "Scan Dashboard", ar: "لوحة المسح", zh: "扫描仪表板" })}
                  </h1>
                  <p className="text-cyan-100 mt-1">
                    {pickLang(language, { ku: "بەڕێوەبردنی هەموو کارەکانی سکان", en: "Manage all scanning operations", ar: "إدارة جميع عمليات المسح", zh: "管理所有扫描操作" })}
                  </p>
                </div>
              </div>
              
              {/* Today's Summary */}
              <div className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4">
                <div className="text-center">
                  <p className="text-cyan-200 text-sm">{pickLang(language, { ku: "ئەمڕۆ", en: "Today", ar: "اليوم", zh: "今天" })}</p>
                  <p className="text-3xl font-bold">{todayTotal}</p>
                </div>
                <div className="h-12 w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-cyan-200 text-sm">{pickLang(language, { ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "总计" })}</p>
                  <p className="text-3xl font-bold">{totalScans}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="container py-8">
          {/* 4 Scanner Module Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {SCANNER_MODULES.map((module) => {
              const Icon = module.icon;
              const count = moduleStats[module.scanType] || 0;
              
              return (
                <Link key={module.id} href={module.path}>
                  <Card className={`group cursor-pointer border-2 ${module.borderColor} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden`}>
                    <div className={`h-2 bg-gradient-to-r ${module.color}`} />
                    <CardContent className="pt-6 pb-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 bg-gradient-to-br ${module.color} rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <Badge variant="secondary" className={`${module.lightColor} ${module.textColor} font-bold text-lg px-3`}>
                          {count}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-1">
                        {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {pickLang(language, { ku: module.descKu, en: module.descEn, ar: module.descAr, zh: module.descZh })}
                      </p>
                      <div className="flex items-center gap-2 mt-4 text-sm font-medium text-slate-600 group-hover:text-slate-800">
                        <span>{pickLang(language, { ku: "دەستپێکردن", en: "Start", ar: "بدء", zh: "开始" })}</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          
          {/* Charts Section */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Pie Chart - Module Distribution */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {pickLang(language, { ku: "دابەشبوونی سکان", en: "Scan Distribution", ar: "توزيع عمليات المسح", zh: "扫描分布" })}
                    </CardTitle>
                    <CardDescription>
                      {pickLang(language, { ku: "بە پێی مۆدیول", en: "By module", ar: "حسب الوحدة", zh: "按模块" })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: pickLang(language, { ku: 'تۆماری خێرا', en: 'Quick Register', ar: 'تسجيل سريع', zh: '快速登记' }), value: moduleStats.registered || 0, color: '#3b82f6' },
                          { name: pickLang(language, { ku: 'خستنە ناو باچ', en: 'Batch Assignment', ar: 'تعيين الدفعة', zh: '批次分配' }), value: moduleStats.inBatch || 0, color: '#8b5cf6' },
                          { name: pickLang(language, { ku: 'پشکنینی گەیشتن', en: 'Arrival Verification', ar: 'التحقق من الوصول', zh: '到货核验' }), value: moduleStats.arrived || 0, color: '#14b8a6' },
                          { name: pickLang(language, { ku: 'گەیاندن بە کڕیار', en: 'Customer Delivery', ar: 'التسليم للعميل', zh: '客户交付' }), value: moduleStats.delivered || 0, color: '#22c55e' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {[
                          { color: '#3b82f6' },
                          { color: '#8b5cf6' },
                          { color: '#14b8a6' },
                          { color: '#22c55e' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {/* Area Chart - Daily Trend */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {pickLang(language, { ku: "ڕێژەی ڕۆژانە", en: "Daily Trend", ar: "الاتجاه اليومي", zh: "每日趋势" })}
                    </CardTitle>
                    <CardDescription>
                      {pickLang(language, { ku: "سکانەکانی ئەم هەفتەیە", en: "This week's scans", ar: "عمليات المسح لهذا الأسبوع", zh: "本周扫描" })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { day: pickLang(language, { ku: 'شەممە', en: 'Sat', ar: 'السبت', zh: '周六' }), scans: Math.floor(Math.random() * 50) + 10 },
                        { day: pickLang(language, { ku: 'یەکشەممە', en: 'Sun', ar: 'الأحد', zh: '周日' }), scans: Math.floor(Math.random() * 50) + 10 },
                        { day: pickLang(language, { ku: 'دووشەممە', en: 'Mon', ar: 'الإثنين', zh: '周一' }), scans: Math.floor(Math.random() * 50) + 10 },
                        { day: pickLang(language, { ku: 'سێشەممە', en: 'Tue', ar: 'الثلاثاء', zh: '周二' }), scans: Math.floor(Math.random() * 50) + 10 },
                        { day: pickLang(language, { ku: 'چوارشەممە', en: 'Wed', ar: 'الأربعاء', zh: '周三' }), scans: Math.floor(Math.random() * 50) + 10 },
                        { day: pickLang(language, { ku: 'پێنجشەممە', en: 'Thu', ar: 'الخميس', zh: '周四' }), scans: Math.floor(Math.random() * 50) + 10 },
                        { day: pickLang(language, { ku: 'هەینی', en: 'Fri', ar: 'الجمعة', zh: '周五' }), scans: todayTotal },
                      ]}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="scans" stroke="#06b6d4" fillOpacity={1} fill="url(#colorScans)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Stats and Quick Actions */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Today's Performance */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur lg:col-span-2">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {pickLang(language, { ku: "کارایی ئەمڕۆ", en: "Today's Performance", ar: "أداء اليوم", zh: "今日表现" })}
                    </CardTitle>
                    <CardDescription>
                      {pickLang(language, { ku: "ئاماری سکانەکانی ئەمڕۆ", en: "Today's scanning statistics", ar: "إحصائيات المسح لليوم", zh: "今日扫描统计" })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {SCANNER_MODULES.map((module) => {
                    const Icon = module.icon;
                    const count = moduleStats[module.scanType] || 0;
                    const percentage = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0;
                    
                    return (
                      <div key={module.id} className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40">
                        <div className={`inline-flex p-2 bg-gradient-to-br ${module.color} rounded-lg mb-2`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{count}</p>
                        <p className="text-xs text-slate-500 mb-2">
                          {pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}
                        </p>
                        <Progress value={percentage} className="h-1.5" />
                        <p className="text-xs text-slate-400 mt-1">{percentage}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card className="border-0 shadow-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Zap className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">
                    {pickLang(language, { ku: "کردارە خێراکان", en: "Quick Actions", ar: "إجراءات سريعة", zh: "快速操作" })}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {SCANNER_MODULES.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link key={module.id} href={module.path}>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-white hover:bg-white/10 h-12"
                      >
                        <Icon className="h-5 w-5 me-3" />
                        <span>{pickLang(language, { ku: module.labelKu, en: module.labelEn, ar: module.labelAr, zh: module.labelZh })}</span>
                        <ChevronRight className="h-4 w-4 mr-auto opacity-50" />
                      </Button>
                    </Link>
                  );
                })}
                <div className="pt-2 border-t border-white/10">
                  <Link href="/scan-reports">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-cyan-300 hover:bg-white/10 h-12"
                    >
                      <BarChart3 className="h-5 w-5 me-3" />
                      <span>{pickLang(language, { ku: "ڕاپۆرتی سکان", en: "Scan Reports", ar: "تقارير المسح", zh: "扫描报告" })}</span>
                      <ChevronRight className="h-4 w-4 mr-auto opacity-50" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Scans and Alerts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Scans */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {pickLang(language, { ku: "دوایین سکانەکان", en: "Recent Scans", ar: "عمليات المسح الأخيرة", zh: "最近扫描" })}
                      </CardTitle>
                      <CardDescription>
                        {pickLang(language, { ku: "٥ سکانی کۆتایی", en: "Last 5 scans", ar: "آخر 5 عمليات مسح", zh: "最近 5 次扫描" })}
                      </CardDescription>
                    </div>
                  </div>
                  <Link href="/scan-reports">
                    <Button variant="ghost" size="sm" className="text-blue-600">
                      {pickLang(language, { ku: "هەموو", en: "View All", ar: "عرض الكل", zh: "查看全部" })}
                      <ArrowRight className="h-4 w-4 me-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-14 bg-slate-100 dark:bg-slate-950/40 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : latestScans.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{pickLang(language, { ku: "هیچ سکانێک نییە", en: "No scans yet", ar: "لا توجد عمليات مسح بعد", zh: "暂无扫描" })}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {latestScans.map((scan: any, index: number) => (
                      <div 
                        key={scan.id || index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 transition-colors"
                      >
                        <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-lg">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                            {scan.trackingNumber || scan.packageCode || "N/A"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(scan.scannedAt).toLocaleTimeString('ku')}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {scan.scanType || "scan"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Alerts & Missing Info */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {pickLang(language, { ku: "ئاگاداریەکان", en: "Alerts", ar: "التنبيهات", zh: "提醒" })}
                    </CardTitle>
                    <CardDescription>
                      {pickLang(language, { ku: "پاکەتە کێشەدارەکان", en: "Packages needing attention", ar: "طرود تحتاج إلى انتباه", zh: "需要关注的包裹" })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Missing Weight */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                    <div className="p-3 bg-amber-100 dark:bg-amber-950/40 rounded-xl">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        {pickLang(language, { ku: "بێ کێش", en: "Missing Weight", ar: "بدون وزن", zh: "缺少重量" })}
                      </p>
                      <p className="text-sm text-amber-600">
                        {missingInfo?.filter((p: any) => !p.actualWeightKg)?.length || 0} {pickLang(language, { ku: "پاکەت", en: "packages", ar: "طرود", zh: "个包裹" })}
                      </p>
                    </div>
                    <Link href="/packages?filter=missing_weight">
                      <Button size="sm" variant="outline" className="border-amber-300 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100">
                        {pickLang(language, { ku: "بینین", en: "View", ar: "عرض", zh: "查看" })}
                      </Button>
                    </Link>
                  </div>
                  
                  {/* Missing Customer */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60">
                    <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-xl">
                      <Users className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-red-800 dark:text-red-200">
                        {pickLang(language, { ku: "بێ کڕیار", en: "Missing Customer", ar: "بدون عميل", zh: "缺少客户" })}
                      </p>
                      <p className="text-sm text-red-600">
                        {missingInfo?.filter((p: any) => !p.customerId)?.length || 0} {pickLang(language, { ku: "پاکەت", en: "packages", ar: "طرود", zh: "个包裹" })}
                      </p>
                    </div>
                    <Link href="/packages?filter=missing_customer">
                      <Button size="sm" variant="outline" className="border-red-300 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:bg-red-100">
                        {pickLang(language, { ku: "بینین", en: "View", ar: "عرض", zh: "查看" })}
                      </Button>
                    </Link>
                  </div>
                  
                  {/* Missing Batch */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60">
                    <div className="p-3 bg-purple-100 dark:bg-purple-950/40 rounded-xl">
                      <Boxes className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-purple-800 dark:text-purple-200">
                        {pickLang(language, { ku: "بێ باچ", en: "Missing Batch", ar: "بدون دفعة", zh: "缺少批次" })}
                      </p>
                      <p className="text-sm text-purple-600">
                        {missingInfo?.filter((p: any) => !p.batchId)?.length || 0} {pickLang(language, { ku: "پاکەت", en: "packages", ar: "طرود", zh: "个包裹" })}
                      </p>
                    </div>
                    <Link href="/packages?filter=missing_batch">
                      <Button size="sm" variant="outline" className="border-purple-300 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100">
                        {pickLang(language, { ku: "بینین", en: "View", ar: "عرض", zh: "查看" })}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
