import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  AlertTriangle, AlertCircle, Info, CheckCircle, Bell, BellOff,
  Activity, Server, Database, Shield, Users, Package, Wallet,
  Settings, RefreshCw, Filter, Eye, EyeOff, Clock, TrendingUp,
  BarChart3, PieChart as PieChartIcon, Loader2, Check, X
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Translations
const translations = {
  en: {
    title: "System Monitor",
    subtitle: "Real-time monitoring of system activity and alerts",
    totalAlerts: "Total Alerts",
    unreadAlerts: "Unread",
    criticalAlerts: "Critical",
    warningAlerts: "Warning",
    infoAlerts: "Info",
    recentAlerts: "Recent Alerts",
    alertsByCategory: "Alerts by Category",
    alertsBySeverity: "Alerts by Severity",
    markAsRead: "Mark as Read",
    markAllAsRead: "Mark All as Read",
    refresh: "Refresh",
    filter: "Filter",
    all: "All",
    read: "Read",
    unread: "Unread",
    noAlerts: "No alerts found",
    loading: "Loading...",
    customer: "Customer",
    package: "Package",
    batch: "Batch",
    full_package: "Full Package",

    commission: "Commission",
    finance: "Finance",
    settings: "Settings",
    user: "User",
    system: "System",
    security: "Security",
    critical: "Critical",
    warning: "Warning",
    info: "Info",
    systemHealth: "System Health",
    databaseStatus: "Database",
    serverStatus: "Server",
    backupStatus: "Backup",
    healthy: "Healthy",
    degraded: "Degraded",
    down: "Down",
    lastBackup: "Last Backup",
    never: "Never",
    ago: "ago",
  },
  ku: {
    title: "چاودێری سیستەم",
    subtitle: "چاودێری کاتی ڕاستەقینەی چالاکی و ئاگادارییەکانی سیستەم",
    totalAlerts: "کۆی ئاگادارییەکان",
    unreadAlerts: "نەخوێندراوەکان",
    criticalAlerts: "گرنگ",
    warningAlerts: "ئاگاداری",
    infoAlerts: "زانیاری",
    recentAlerts: "ئاگادارییە نوێیەکان",
    alertsByCategory: "ئاگادارییەکان بەپێی جۆر",
    alertsBySeverity: "ئاگادارییەکان بەپێی گرنگی",
    markAsRead: "وەک خوێندراو نیشانە بکە",
    markAllAsRead: "هەموو وەک خوێندراو نیشانە بکە",
    refresh: "نوێکردنەوە",
    filter: "فلتەر",
    all: "هەموو",
    read: "خوێندراو",
    unread: "نەخوێندراو",
    noAlerts: "هیچ ئاگاداریەک نەدۆزرایەوە",
    loading: "چاوەڕوان بە...",
    customer: "کڕیار",
    package: "پاکەت",
    batch: "باتچ",
    full_package: "فول پاکەج",

    commission: "کۆمیشن",
    finance: "دارایی",
    settings: "ڕێکخستنەکان",
    user: "بەکارهێنەر",
    system: "سیستەم",
    security: "ئەمنیەت",
    critical: "گرنگ",
    warning: "ئاگاداری",
    info: "زانیاری",
    systemHealth: "تەندروستی سیستەم",
    databaseStatus: "داتابەیس",
    serverStatus: "سێرڤەر",
    backupStatus: "باکئەپ",
    healthy: "باش",
    degraded: "کەمی هەیە",
    down: "کار ناکات",
    lastBackup: "دوایین باکئەپ",
    never: "هەرگیز",
    ago: "پێش",
  },
  ar: {
    title: "مراقبة النظام",
    subtitle: "مراقبة في الوقت الفعلي لنشاط النظام والتنبيهات",
    totalAlerts: "إجمالي التنبيهات",
    unreadAlerts: "غير مقروءة",
    criticalAlerts: "حرجة",
    warningAlerts: "تحذير",
    infoAlerts: "معلومات",
    recentAlerts: "التنبيهات الأخيرة",
    alertsByCategory: "التنبيهات حسب الفئة",
    alertsBySeverity: "التنبيهات حسب الخطورة",
    markAsRead: "تحديد كمقروء",
    markAllAsRead: "تحديد الكل كمقروء",
    refresh: "تحديث",
    filter: "تصفية",
    all: "الكل",
    read: "مقروء",
    unread: "غير مقروء",
    noAlerts: "لم يتم العثور على تنبيهات",
    loading: "جاري التحميل...",
    customer: "عميل",
    package: "طرد",
    batch: "دفعة",
    full_package: "باقة كاملة",

    commission: "عمولة",
    finance: "مالية",
    settings: "إعدادات",
    user: "مستخدم",
    system: "نظام",
    security: "أمان",
    critical: "حرج",
    warning: "تحذير",
    info: "معلومات",
    systemHealth: "صحة النظام",
    databaseStatus: "قاعدة البيانات",
    serverStatus: "الخادم",
    backupStatus: "النسخ الاحتياطي",
    healthy: "سليم",
    degraded: "متدهور",
    down: "معطل",
    lastBackup: "آخر نسخة احتياطية",
    never: "أبداً",
    ago: "منذ",
  }
};

const SEVERITY_COLORS = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

const CATEGORY_COLORS = {
  customer: "#10b981",
  package: "#3b82f6",
  batch: "#8b5cf6",
  full_package: "#f59e0b",

  commission: "#06b6d4",
  finance: "#22c55e",
  settings: "#6b7280",
  user: "#14b8a6",
  system: "#f97316",
  security: "#ef4444",
};

const CATEGORY_ICONS: Record<string, any> = {
  customer: Users,
  package: Package,
  batch: Package,
  full_package: Package,

  commission: Wallet,
  finance: Wallet,
  settings: Settings,
  user: Users,
  system: Server,
  security: Shield,
};

export default function SystemMonitorDashboard() {
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.en;
  
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = trpc.activityAlerts.list.useQuery({
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    severity: severityFilter !== "all" ? severityFilter : undefined,
    isRead: readFilter === "all" ? undefined : readFilter === "read",
    limit: 100,
    offset: 0,
  }, {
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
  });
  
  // Fetch stats
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = trpc.activityAlerts.getStats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 30000 : false,
  });
  
  // Fetch backup info
  const { data: backupsData } = trpc.backup.list.useQuery({ limit: 1 });
  
  // Mutations
  const markAsRead = trpc.activityAlerts.markAsRead.useMutation({
    onSuccess: () => {
      refetchAlerts();
      refetchStats();
      toast.success(language === 'ku' ? 'وەک خوێندراو نیشانە کرا' : 'Marked as read');
    },
  });
  
  const markAllAsRead = trpc.activityAlerts.markAllAsRead.useMutation({
    onSuccess: () => {
      refetchAlerts();
      refetchStats();
      toast.success(language === 'ku' ? 'هەموو وەک خوێندراو نیشانە کران' : 'All marked as read');
    },
  });
  
  const handleRefresh = () => {
    refetchAlerts();
    refetchStats();
    toast.success(language === 'ku' ? 'نوێ کرایەوە' : 'Refreshed');
  };
  
  // Prepare chart data
  const severityChartData = (statsData?.bySeverity as any)?.map((item: any) => ({
    name: t[item.severity as keyof typeof t] || item.severity,
    value: item.count,
    color: SEVERITY_COLORS[item.severity as keyof typeof SEVERITY_COLORS] || "#6b7280",
  })) || [];
  
  const categoryChartData = (statsData?.byCategory as any)?.map((item: any) => ({
    name: t[item.category as keyof typeof t] || item.category,
    value: item.count,
    color: CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS] || "#6b7280",
  })) || [];
  
  // Format time ago
  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return language === 'ku' ? 'ئێستا' : 'Just now';
    if (diffMins < 60) return `${diffMins} ${language === 'ku' ? 'خولەک' : 'min'} ${t.ago}`;
    if (diffHours < 24) return `${diffHours} ${language === 'ku' ? 'کاتژمێر' : 'hr'} ${t.ago}`;
    return `${diffDays} ${language === 'ku' ? 'ڕۆژ' : 'day'} ${t.ago}`;
  };
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      critical: "bg-red-100 text-red-700 border-red-200",
      warning: "bg-amber-100 text-amber-700 border-amber-200",
      info: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return variants[severity] || variants.info;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Bell className="h-4 w-4 me-2" /> : <BellOff className="h-4 w-4 me-2" />}
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 me-2" />
            {t.refresh}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending || (statsData?.unread || 0) === 0}
          >
            <Check className="h-4 w-4 me-2" />
            {t.markAllAsRead}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.totalAlerts}</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          Number(statsData?.unread || 0) > 0 && "border-amber-500 bg-amber-50/50"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.unreadAlerts}</CardTitle>
            <EyeOff className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{statsData?.unread || 0}</div>
          </CardContent>
        </Card>
        
        <Card className={cn(
          ((statsData?.bySeverity as any)?.find((s: any) => s.severity === 'critical')?.count || 0) > 0 && "border-red-500 bg-red-50/50"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.criticalAlerts}</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(statsData?.bySeverity as any)?.find((s: any) => s.severity === 'critical')?.count || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.warningAlerts}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {(statsData?.bySeverity as any)?.find((s: any) => s.severity === 'warning')?.count || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t.infoAlerts}</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(statsData?.bySeverity as any)?.find((s: any) => s.severity === 'info')?.count || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t.systemHealth}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 border border-green-200">
              <Database className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">{t.databaseStatus}</p>
                <p className="text-lg font-semibold text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {t.healthy}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 border border-green-200">
              <Server className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">{t.serverStatus}</p>
                <p className="text-lg font-semibold text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {t.healthy}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 border border-green-200">
              <Shield className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">{t.backupStatus}</p>
                <p className="text-lg font-semibold text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  {backupsData?.[0] 
                    ? formatTimeAgo(backupsData[0].createdAt)
                    : t.never
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts and Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Charts */}
        <div className="lg:col-span-1 space-y-6">
          {/* Severity Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChartIcon className="h-4 w-4" />
                {t.alertsBySeverity}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {severityChartData.map((entry: { name: string; value: number; color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Category Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {t.alertsByCategory}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {categoryChartData.map((entry: { name: string; value: number; color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t.recentAlerts}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder={t.filter} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.all}</SelectItem>
                    <SelectItem value="customer">{t.customer}</SelectItem>
                    <SelectItem value="package">{t.package}</SelectItem>
                    <SelectItem value="batch">{t.batch}</SelectItem>
                    <SelectItem value="finance">{t.finance}</SelectItem>
                    <SelectItem value="system">{t.system}</SelectItem>
                    <SelectItem value="security">{t.security}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={t.filter} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.all}</SelectItem>
                    <SelectItem value="critical">{t.critical}</SelectItem>
                    <SelectItem value="warning">{t.warning}</SelectItem>
                    <SelectItem value="info">{t.info}</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={readFilter} onValueChange={setReadFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={t.filter} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.all}</SelectItem>
                    <SelectItem value="unread">{t.unread}</SelectItem>
                    <SelectItem value="read">{t.read}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              {alertsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : alertsData?.alerts?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                  <p>{t.noAlerts}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertsData?.alerts?.map((alert: any) => {
                    const CategoryIcon = CATEGORY_ICONS[alert.category] || Activity;
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          "p-4 rounded-lg border transition-colors",
                          !alert.isRead && "bg-muted/50 border-primary/20",
                          alert.severity === 'critical' && !alert.isRead && "bg-red-50/50 border-red-200",
                          alert.severity === 'warning' && !alert.isRead && "bg-amber-50/50 border-amber-200"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            alert.severity === 'critical' && "bg-red-100",
                            alert.severity === 'warning' && "bg-amber-100",
                            alert.severity === 'info' && "bg-blue-100"
                          )}>
                            <CategoryIcon className={cn(
                              "h-5 w-5",
                              alert.severity === 'critical' && "text-red-600",
                              alert.severity === 'warning' && "text-amber-600",
                              alert.severity === 'info' && "text-blue-600"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{alert.title}</h4>
                              <Badge variant="outline" className={getSeverityBadge(alert.severity)}>
                                {getSeverityIcon(alert.severity)}
                                <span className="ms-1">{t[alert.severity as keyof typeof t]}</span>
                              </Badge>
                              {!alert.isRead && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary">
                                  {t.unread}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{alert.message}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeAgo(alert.createdAt)}
                              </span>
                              {alert.triggeredByName && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {alert.triggeredByName}
                                </span>
                              )}
                              {alert.entityCode && (
                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                  {alert.entityCode}
                                </span>
                              )}
                            </div>
                          </div>
                          {!alert.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead.mutate({ alertId: alert.id })}
                              disabled={markAsRead.isPending}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
