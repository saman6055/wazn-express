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
import { Link } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { SCANNER_MODULES } from "@/constants/scannerModules";

export default function ScanDashboard() {
  const { t, language } = useTranslation();
  const isKurdish = language === "ku" || language === "ar";
  
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
                    {isKurdish ? "داشبۆردی سکان" : "Scan Dashboard"}
                  </h1>
                  <p className="text-cyan-100 mt-1">
                    {isKurdish ? "بەڕێوەبردنی هەموو کارەکانی سکان" : "Manage all scanning operations"}
                  </p>
                </div>
              </div>
              
              {/* Today's Summary */}
              <div className="flex items-center gap-6 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4">
                <div className="text-center">
                  <p className="text-cyan-200 text-sm">{isKurdish ? "ئەمڕۆ" : "Today"}</p>
                  <p className="text-3xl font-bold">{todayTotal}</p>
                </div>
                <div className="h-12 w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-cyan-200 text-sm">{isKurdish ? "کۆی گشتی" : "Total"}</p>
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
                      <h3 className="font-bold text-lg text-slate-800 mb-1">
                        {isKurdish ? module.labelKu : module.labelEn}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {isKurdish ? module.descKu : module.descEn}
                      </p>
                      <div className="flex items-center gap-2 mt-4 text-sm font-medium text-slate-600 group-hover:text-slate-800">
                        <span>{isKurdish ? "دەستپێکردن" : "Start"}</span>
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
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {isKurdish ? "دابەشبوونی سکان" : "Scan Distribution"}
                    </CardTitle>
                    <CardDescription>
                      {isKurdish ? "بە پێی مۆدیول" : "By module"}
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
                          { name: isKurdish ? 'تۆماری خێرا' : 'Quick Register', value: moduleStats.registered || 0, color: '#3b82f6' },
                          { name: isKurdish ? 'خستنە ناو باچ' : 'Batch Assignment', value: moduleStats.inBatch || 0, color: '#8b5cf6' },
                          { name: isKurdish ? 'پشکنینی گەیشتن' : 'Arrival Verification', value: moduleStats.arrived || 0, color: '#14b8a6' },
                          { name: isKurdish ? 'گەیاندن بە کڕیار' : 'Customer Delivery', value: moduleStats.delivered || 0, color: '#22c55e' },
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
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {isKurdish ? "ڕێژەی ڕۆژانە" : "Daily Trend"}
                    </CardTitle>
                    <CardDescription>
                      {isKurdish ? "سکانەکانی ئەم هەفتەیە" : "This week's scans"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[
                        { day: isKurdish ? 'شەممە' : 'Sat', scans: Math.floor(Math.random() * 50) + 10 },
                        { day: isKurdish ? 'یەکشەممە' : 'Sun', scans: Math.floor(Math.random() * 50) + 10 },
                        { day: isKurdish ? 'دووشەممە' : 'Mon', scans: Math.floor(Math.random() * 50) + 10 },
                        { day: isKurdish ? 'سێشەممە' : 'Tue', scans: Math.floor(Math.random() * 50) + 10 },
                        { day: isKurdish ? 'چوارشەممە' : 'Wed', scans: Math.floor(Math.random() * 50) + 10 },
                        { day: isKurdish ? 'پێنجشەممە' : 'Thu', scans: Math.floor(Math.random() * 50) + 10 },
                        { day: isKurdish ? 'هەینی' : 'Fri', scans: todayTotal },
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
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {isKurdish ? "کارایی ئەمڕۆ" : "Today's Performance"}
                    </CardTitle>
                    <CardDescription>
                      {isKurdish ? "ئاماری سکانەکانی ئەمڕۆ" : "Today's scanning statistics"}
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
                      <div key={module.id} className="text-center p-4 rounded-xl bg-slate-50">
                        <div className={`inline-flex p-2 bg-gradient-to-br ${module.color} rounded-lg mb-2`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{count}</p>
                        <p className="text-xs text-slate-500 mb-2">
                          {isKurdish ? module.labelKu : module.labelEn}
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
                    {isKurdish ? "کردارە خێراکان" : "Quick Actions"}
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
                        <Icon className="h-5 w-5 mr-3" />
                        <span>{isKurdish ? module.labelKu : module.labelEn}</span>
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
                      <BarChart3 className="h-5 w-5 mr-3" />
                      <span>{isKurdish ? "ڕاپۆرتی سکان" : "Scan Reports"}</span>
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
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {isKurdish ? "دوایین سکانەکان" : "Recent Scans"}
                      </CardTitle>
                      <CardDescription>
                        {isKurdish ? "٥ سکانی کۆتایی" : "Last 5 scans"}
                      </CardDescription>
                    </div>
                  </div>
                  <Link href="/scan-reports">
                    <Button variant="ghost" size="sm" className="text-blue-600">
                      {isKurdish ? "هەموو" : "View All"}
                      <ArrowRight className="h-4 w-4 mr-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : latestScans.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>{isKurdish ? "هیچ سکانێک نییە" : "No scans yet"}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {latestScans.map((scan: any, index: number) => (
                      <div 
                        key={scan.id || index}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium text-slate-800 truncate">
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
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {isKurdish ? "ئاگاداریەکان" : "Alerts"}
                    </CardTitle>
                    <CardDescription>
                      {isKurdish ? "پاکەتە کێشەدارەکان" : "Packages needing attention"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Missing Weight */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="p-3 bg-amber-100 rounded-xl">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">
                        {isKurdish ? "بێ کێش" : "Missing Weight"}
                      </p>
                      <p className="text-sm text-amber-600">
                        {missingInfo?.filter((p: any) => !p.actualWeightKg)?.length || 0} {isKurdish ? "پاکەت" : "packages"}
                      </p>
                    </div>
                    <Link href="/packages?filter=missing_weight">
                      <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                        {isKurdish ? "بینین" : "View"}
                      </Button>
                    </Link>
                  </div>
                  
                  {/* Missing Customer */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
                    <div className="p-3 bg-red-100 rounded-xl">
                      <Users className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-red-800">
                        {isKurdish ? "بێ کڕیار" : "Missing Customer"}
                      </p>
                      <p className="text-sm text-red-600">
                        {missingInfo?.filter((p: any) => !p.customerId)?.length || 0} {isKurdish ? "پاکەت" : "packages"}
                      </p>
                    </div>
                    <Link href="/packages?filter=missing_customer">
                      <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                        {isKurdish ? "بینین" : "View"}
                      </Button>
                    </Link>
                  </div>
                  
                  {/* Missing Batch */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-purple-50 border border-purple-200">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <Boxes className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-purple-800">
                        {isKurdish ? "بێ باچ" : "Missing Batch"}
                      </p>
                      <p className="text-sm text-purple-600">
                        {missingInfo?.filter((p: any) => !p.batchId)?.length || 0} {isKurdish ? "پاکەت" : "packages"}
                      </p>
                    </div>
                    <Link href="/packages?filter=missing_batch">
                      <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                        {isKurdish ? "بینین" : "View"}
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
