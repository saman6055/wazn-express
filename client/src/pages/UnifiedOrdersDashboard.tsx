import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Search, Filter, Eye, Edit, Plus, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart, Gem, LayoutGrid, List, RefreshCw, Clock,
  CheckCircle, Truck, AlertCircle, XCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function UnifiedOrdersDashboard() {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
  const { data: fullPackageOrders } = trpc.fullPackage.list.useQuery();

  // Combine all orders (purchase requests removed)
  const allOrders: any[] = [
    ...(fullPackageOrders?.filter((o: any) => o.orderType === 'full_package').map((o: any) => ({ ...o, type: 'full_package' })) || []),
    ...(fullPackageOrders?.filter((o: any) => o.orderType === 'commission').map((o: any) => ({ ...o, type: 'commission' })) || []),
  ];

  // Filter orders
  const filteredOrders = allOrders.filter(order => {
    const matchesTab = activeTab === "all" || order.type === activeTab;
    const matchesSearch = !searchQuery || 
      order.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesTab && matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: allOrders.length,
    fullPackage: allOrders.filter(o => o.type === 'full_package').length,

    commission: allOrders.filter(o => o.type === 'commission').length,
    totalRevenue: allOrders.reduce((sum, o) => sum + (o.sellingPrice || o.totalPrice || 0), 0),
    pending: allOrders.filter(o => ['pending', 'quoted', 'approved'].includes(o.status)).length,
    inTransit: allOrders.filter(o => ['purchasing', 'purchased', 'in_transit', 'arrived_china'].includes(o.status)).length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
  };

  // Chart data
  const weeklyData = [
    { name: pickLang(language, { ku: 'شەممە', en: 'Sat', ar: 'السبت', zh: '周六' }), orders: 12, revenue: 450 },
    { name: pickLang(language, { ku: 'یەکشەممە', en: 'Sun', ar: 'الأحد', zh: '周日' }), orders: 19, revenue: 680 },
    { name: pickLang(language, { ku: 'دووشەممە', en: 'Mon', ar: 'الإثنين', zh: '周一' }), orders: 15, revenue: 520 },
    { name: pickLang(language, { ku: 'سێشەممە', en: 'Tue', ar: 'الثلاثاء', zh: '周二' }), orders: 22, revenue: 890 },
    { name: pickLang(language, { ku: 'چوارشەممە', en: 'Wed', ar: 'الأربعاء', zh: '周三' }), orders: 18, revenue: 720 },
    { name: pickLang(language, { ku: 'پێنجشەممە', en: 'Thu', ar: 'الخميس', zh: '周四' }), orders: 25, revenue: 950 },
    { name: pickLang(language, { ku: 'هەینی', en: 'Fri', ar: 'الجمعة', zh: '周五' }), orders: 20, revenue: 800 },
  ];

  const typeDistribution = [
    { name: pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full Package', ar: 'الباقة الكاملة', zh: '全包' }), value: stats.fullPackage, color: '#10b981' },

    { name: pickLang(language, { ku: 'کڕین بە تێچوو', en: 'Commission', ar: 'بالعمولة', zh: '代购' }), value: stats.commission, color: '#f59e0b' },
  ];

  const statusData = [
    { name: pickLang(language, { ku: 'چاوەڕوان', en: 'Pending', ar: 'قيد الانتظار', zh: '待处理' }), value: stats.pending, icon: Clock, color: 'bg-yellow-500' },
    { name: pickLang(language, { ku: 'لە ڕێگا', en: 'In Transit', ar: 'في الطريق', zh: '运输中' }), value: stats.inTransit, icon: Truck, color: 'bg-blue-500' },
    { name: pickLang(language, { ku: 'گەیەندرا', en: 'Delivered', ar: 'تم التسليم', zh: '已送达' }), value: stats.delivered, icon: CheckCircle, color: 'bg-green-500' },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: pickLang(language, { ku: 'چاوەڕوان', en: 'Pending', ar: 'قيد الانتظار', zh: '待处理' }), className: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200' },
      quoted: { label: pickLang(language, { ku: 'نرخدانراو', en: 'Quoted', ar: 'تم التسعير', zh: '已报价' }), className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200' },
      approved: { label: pickLang(language, { ku: 'پەسەندکراو', en: 'Approved', ar: 'تمت الموافقة', zh: '已批准' }), className: 'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200' },
      purchasing: { label: pickLang(language, { ku: 'لە کڕیندا', en: 'Purchasing', ar: 'جاري الشراء', zh: '采购中' }), className: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200' },
      purchased: { label: pickLang(language, { ku: 'کڕدرا', en: 'Purchased', ar: 'تم الشراء', zh: '已采购' }), className: 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-200' },
      arrived_china: { label: pickLang(language, { ku: 'گەیشتە چین', en: 'Arrived in China', ar: 'وصل إلى الصين', zh: '到达中国' }), className: 'bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200' },
      in_transit: { label: pickLang(language, { ku: 'لە ڕێگا', en: 'In Transit', ar: 'في الطريق', zh: '运输中' }), className: 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200' },
      delivered: { label: pickLang(language, { ku: 'گەیەندرا', en: 'Delivered', ar: 'تم التسليم', zh: '已送达' }), className: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200' },
      cancelled: { label: pickLang(language, { ku: 'هەڵوەشێندراوە', en: 'Cancelled', ar: 'ملغى', zh: '已取消' }), className: 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-200' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 dark:bg-gray-950/40 text-gray-800 dark:text-gray-200' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; icon: any; className: string }> = {
      full_package: { label: pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full Package', ar: 'الباقة الكاملة', zh: '全包' }), icon: Package, className: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white' },

      commission: { label: pickLang(language, { ku: 'عمولە', en: 'Commission', ar: 'عمولة', zh: '佣金' }), icon: Gem, className: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' },
    };
    const config = typeConfig[type] || { label: type, icon: Package, className: 'bg-gray-500 text-white' };
    const Icon = config.icon;
    return (
      <Badge className={`${config.className} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-30"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Package className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">{pickLang(language, { ku: 'داشبۆردی یەکگرتوو', en: 'Unified Dashboard', ar: 'لوحة التحكم الموحدة', zh: '统一仪表板' })}</h1>
                <p className="mt-1 text-white/80">{pickLang(language, { ku: 'بەڕێوەبردنی هەموو ئۆردەرەکان لە یەک شوێن', en: 'Manage all orders in one place', ar: 'إدارة جميع الطلبات في مكان واحد', zh: '在一个地方管理所有订单' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
                <span className="text-sm">{pickLang(language, { ku: 'زیندوو', en: 'Live', ar: 'مباشر', zh: '实时' })}</span>
                <span className="font-mono text-lg">{currentTime.toLocaleTimeString('ku')}</span>
              </div>
              <Button className="bg-white dark:bg-card text-purple-700 dark:text-purple-300 hover:bg-white/90">
                <Plus className="me-2 h-4 w-4" />
                {pickLang(language, { ku: 'ئۆردەری نوێ', en: 'New Order', ar: 'طلب جديد', zh: '新订单' })}
              </Button>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="relative mt-8 grid grid-cols-5 gap-4">
            {[
              { label: pickLang(language, { ku: 'کۆی گشتی', en: 'Total', ar: 'الإجمالي', zh: '总计' }), value: stats.total, icon: Package, color: 'from-white/20 to-white/10' },
              { label: pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full Package', ar: 'الباقة الكاملة', zh: '全包' }), value: stats.fullPackage, icon: Package, color: 'from-emerald-400/30 to-emerald-500/20' },
              { label: pickLang(language, { ku: 'کڕین بە تێچوو', en: 'Commission', ar: 'بالعمولة', zh: '代购' }), value: stats.commission, icon: Gem, color: 'from-amber-400/30 to-amber-500/20' },
              { label: pickLang(language, { ku: 'کۆی داهات', en: 'Total Revenue', ar: 'إجمالي الإيرادات', zh: '总收入' }), value: `$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'from-green-400/30 to-green-500/20' },
            ].map((stat, i) => (
              <div key={i} className={`rounded-xl bg-gradient-to-br ${stat.color} p-4 backdrop-blur-sm`}>
                <div className="flex items-center justify-between">
                  <stat.icon className="h-5 w-5 text-white/70" />
                  <span className="text-xs text-white/60">0%</span>
                </div>
                <div className="mt-2 text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-3 gap-6">
          {/* Weekly Trend Chart */}
          <Card className="col-span-2 border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                {pickLang(language, { ku: 'ڕەوتی هەفتانە', en: 'Weekly Trend', ar: 'الاتجاه الأسبوعي', zh: '每周趋势' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: '#fff'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                    name={pickLang(language, { ku: 'ئۆردەرەکان', en: 'Orders', ar: 'الطلبات', zh: '订单' })}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                    name={pickLang(language, { ku: 'داهات ($)', en: 'Revenue ($)', ar: 'الإيرادات ($)', zh: '收入 ($)' })}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Type Distribution Pie Chart */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center gap-2">
                <Gem className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                {pickLang(language, { ku: 'دابەشبوونی جۆرەکان', en: 'Type Distribution', ar: 'توزيع الأنواع', zh: '类型分布' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {typeDistribution.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span>{item.name}</span>
                    </div>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Overview & Recent Activity */}
        <div className="grid grid-cols-3 gap-6">
          {/* Status Overview */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                {pickLang(language, { ku: 'بارودۆخی ئۆردەرەکان', en: 'Order Status', ar: 'حالة الطلبات', zh: '订单状态' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {statusData.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-950/40 overflow-hidden">
                    <div 
                      className={`h-full ${item.color} transition-all duration-1000`}
                      style={{ width: `${stats.total > 0 ? (item.value / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="col-span-2 border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                {pickLang(language, { ku: 'چالاکییە دواییەکان', en: 'Recent Activity', ar: 'النشاط الأخير', zh: '最近活动' })}
                <Badge className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-xs">{pickLang(language, { ku: 'زیندوو', en: 'Live', ar: 'مباشر', zh: '实时' })}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {filteredOrders.slice(0, 5).length > 0 ? (
                <div className="space-y-4">
                  {filteredOrders.slice(0, 5).map((order, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-indigo-100">
                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{order.productName || pickLang(language, { ku: 'بێ ناو', en: 'No name', ar: 'بدون اسم', zh: '无名称' })}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{order.trackingNumber || pickLang(language, { ku: 'بێ تراکینگ', en: 'No tracking', ar: 'بدون تتبع', zh: '无追踪号' })}</div>
                      </div>
                      {getTypeBadge(order.type)}
                      {getStatusBadge(order.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <Package className="h-12 w-12 mb-4 text-gray-300" />
                  <p>{pickLang(language, { ku: 'هیچ چالاکییەک نییە', en: 'No activity', ar: 'لا يوجد نشاط', zh: '暂无活动' })}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
            <div className="flex items-center justify-between">
              <CardTitle>{pickLang(language, { ku: 'لیستی ئۆردەرەکان', en: 'Orders List', ar: 'قائمة الطلبات', zh: '订单列表' })}</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "card" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Filter Tabs */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-gray-100 dark:bg-gray-950/40">
                  <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                    🌐 {pickLang(language, { ku: 'هەموو', en: 'All', ar: 'الكل', zh: '全部' })}
                  </TabsTrigger>
                  <TabsTrigger value="full_package" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white">
                    📦 {pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full Package', ar: 'الباقة الكاملة', zh: '全包' })}
                  </TabsTrigger>

                  <TabsTrigger value="commission" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-600 data-[state=active]:text-white">
                    💎 {pickLang(language, { ku: 'عمولە', en: 'Commission', ar: 'عمولة', zh: '佣金' })}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex-1"></div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder={pickLang(language, { ku: 'گەڕان بە ناو، کۆد، تراکینگ...', en: 'Search by name, code, tracking...', ar: 'البحث بالاسم، الرمز، التتبع...', zh: '按名称、编码、追踪号搜索...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={pickLang(language, { ku: 'بارودۆخ', en: 'Status', ar: 'الحالة', zh: '状态' })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🔄 {pickLang(language, { ku: 'هەموو بارودۆخەکان', en: 'All statuses', ar: 'جميع الحالات', zh: '所有状态' })}</SelectItem>
                  <SelectItem value="pending">⏳ {pickLang(language, { ku: 'چاوەڕوان', en: 'Pending', ar: 'قيد الانتظار', zh: '待处理' })}</SelectItem>
                  <SelectItem value="in_transit">✈️ {pickLang(language, { ku: 'لە ڕێگا', en: 'In Transit', ar: 'في الطريق', zh: '运输中' })}</SelectItem>
                  <SelectItem value="delivered">✅ {pickLang(language, { ku: 'گەیەندرا', en: 'Delivered', ar: 'تم التسليم', zh: '已送达' })}</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setActiveTab("all"); }}>
                <XCircle className="me-2 h-4 w-4" />
                {pickLang(language, { ku: 'پاککردنەوەی فلتەرەکان', en: 'Clear filters', ar: 'مسح الفلاتر', zh: '清除筛选' })}
              </Button>
            </div>

            {/* Table View */}
            {viewMode === "table" && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-950/40">
                    <tr>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'کاڵا', en: 'Product', ar: 'المنتج', zh: '商品' })}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'جۆر', en: 'Type', ar: 'النوع', zh: '类型' })}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'کڕیار', en: 'Customer', ar: 'العميل', zh: '客户' })}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'تراکینگ', en: 'Tracking', ar: 'التتبع', zh: '追踪号' })}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'بارودۆخ', en: 'Status', ar: 'الحالة', zh: '状态' })}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'نرخ', en: 'Price', ar: 'السعر', zh: '价格' })}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'کردارەکان', en: 'Actions', ar: 'الإجراءات', zh: '操作' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredOrders.length > 0 ? filteredOrders.map((order, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {order.productImage ? (
                              <img src={order.productImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-950/40">
                                <Package className="h-5 w-5 text-gray-400" />
                              </div>
                            )}
                            <span className="font-medium">{order.productName || pickLang(language, { ku: 'بێ ناو', en: 'No name', ar: 'بدون اسم', zh: '无名称' })}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{getTypeBadge(order.type)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{order.customerName || '-'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">{order.trackingNumber || '-'}</td>
                        <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-300">${order.sellingPrice || order.totalPrice || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                          <Package className="mx-auto h-12 w-12 mb-4 text-gray-300" />
                          <p>{pickLang(language, { ku: 'هیچ ئۆردەرێک نەدۆزرایەوە', en: 'No orders found', ar: 'لم يتم العثور على طلبات', zh: '未找到订单' })}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Card View */}
            {viewMode === "card" && (
              <div className="grid grid-cols-3 gap-4">
                {filteredOrders.length > 0 ? filteredOrders.map((order, i) => (
                  <Card key={i} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        {getTypeBadge(order.type)}
                        {getStatusBadge(order.status)}
                      </div>
                      <h3 className="font-semibold mb-2">{order.productName || pickLang(language, { ku: 'بێ ناو', en: 'No name', ar: 'بدون اسم', zh: '无名称' })}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{order.trackingNumber || pickLang(language, { ku: 'بێ تراکینگ', en: 'No tracking', ar: 'بدون تتبع', zh: '无追踪号' })}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{order.customerName || '-'}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-300">${order.sellingPrice || order.totalPrice || 0}</span>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="col-span-3 flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <Package className="h-12 w-12 mb-4 text-gray-300" />
                    <p>{pickLang(language, { ku: 'هیچ ئۆردەرێک نەدۆزرایەوە', en: 'No orders found', ar: 'لم يتم العثور على طلبات', zh: '未找到订单' })}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Detail Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="h-2 -mx-6 -mt-6 mb-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-t-lg"></div>
              <DialogTitle className="flex items-center gap-3">
                <Package className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                {pickLang(language, { ku: 'وردەکاری ئۆردەر', en: 'Order Details', ar: 'تفاصيل الطلب', zh: '订单详情' })}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  {getTypeBadge(selectedOrder.type)}
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'ناوی کاڵا', en: 'Product Name', ar: 'اسم المنتج', zh: '商品名称' })}</label>
                    <p className="font-medium">{selectedOrder.productName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'کڕیار', en: 'Customer', ar: 'العميل', zh: '客户' })}</label>
                    <p className="font-medium">{selectedOrder.customerName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'تراکینگ نەمبەر', en: 'Tracking Number', ar: 'رقم التتبع', zh: '追踪号码' })}</label>
                    <p className="font-mono">{selectedOrder.trackingNumber || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-gray-500 dark:text-gray-400">{pickLang(language, { ku: 'نرخ', en: 'Price', ar: 'السعر', zh: '价格' })}</label>
                    <p className="font-bold text-emerald-600 dark:text-emerald-300">${selectedOrder.sellingPrice || selectedOrder.totalPrice || 0}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>{pickLang(language, { ku: 'داخستن', en: 'Close', ar: 'إغلاق', zh: '关闭' })}</Button>
                  <Button className="bg-gradient-to-r from-purple-500 to-indigo-600">
                    <Edit className="me-2 h-4 w-4" />
                    {pickLang(language, { ku: 'دەستکاری', en: 'Edit', ar: 'تعديل', zh: '编辑' })}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
