import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Package, 
  Users,
  Scale,
  Box,
  Percent,
  AlertTriangle,
  CheckCircle,
  Download,
  Loader2,
  Ship,
  Plane,
  Calendar,
  BarChart3,
  Wallet,
  Calculator,
  FileText,
  FileSpreadsheet,
  Eye,
  ShoppingBag,
  Printer,
  Tag,
  PieChart,
  Activity,
  Target,
  Banknote,
  Receipt,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { pickLang } from "@/lib/lang";

// Format currency helper
function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return `$${amount.toFixed(2)}`;
}

// PDF Download Button
function DownloadPDFButton({ batchId }: { batchId: number }) {
  const { language } = useTranslation();
  const generatePDF = trpc.batches.generateFinancialPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success(pickLang(language, { ku: "PDF دروستکرا", en: "PDF created", ar: "تم إنشاء ملف PDF", zh: "PDF 已生成" }));
    },
    onError: (error) => {
      toast.error(`${pickLang(language, { ku: "هەڵە لە دروستکردنی PDF", en: "Error creating PDF", ar: "خطأ في إنشاء ملف PDF", zh: "生成 PDF 出错" })}: ${error.message}`);
    },
  });
  
  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => generatePDF.mutate({ batchId })}
      disabled={generatePDF.isPending}
      className="gap-2"
    >
      {generatePDF.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {pickLang(language, { ku: "داونلۆدی PDF", en: "Download PDF", ar: "تنزيل PDF", zh: "下载 PDF" })}
    </Button>
  );
}

export default function BatchFinancialReportFull() {
  const params = useParams<{ id: string }>();
  const batchId = parseInt(params.id || '0');
  const { t, language } = useTranslation();
  const company = useCompanyInfo();
  
  // State for customer modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string; code: string } | null>(null);
  
  // Fetch batch data
  const { data: batch, isLoading: batchLoading } = trpc.batches.getById.useQuery(
    { id: batchId },
    { enabled: batchId > 0 }
  );
  
  // Fetch financial analysis
  const { data: financial, isLoading: financialLoading } = trpc.batches.getFinancialSummary.useQuery(
    { batchId },
    { enabled: batchId > 0 }
  );
  
  // Fetch customers list
  const { data: customers } = trpc.customers.list.useQuery();
  
  // Fetch customer packages when modal opens
  const { data: customerPackages, isLoading: packagesLoading } = trpc.batches.getCustomerPackages.useQuery(
    { batchId, customerId: selectedCustomer?.id || 0 },
    { enabled: isCustomerModalOpen && !!selectedCustomer?.id }
  );
  
  // Helper functions
  const getCustomerName = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.fullNameKurdish || customer?.fullName || `${pickLang(language, { ku: "کڕیار", en: "Customer", ar: "زبون", zh: "客户" })} #${customerId}`;
  };
  
  const getCustomerCode = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.customerCode || '';
  };

  // Calculate totals
  const totalChargeableWeight = useMemo(() => {
    if (!financial?.customerBreakdown) return 0;
    return financial.customerBreakdown.reduce((sum: number, c: { chargeableWeight?: number }) => sum + (c.chargeableWeight || 0), 0);
  }, [financial?.customerBreakdown]);

  const isProfitable = (financial?.profit || 0) >= 0;
  
  // Status labels
  const statusLabels: Record<string, string> = {
    pending: pickLang(language, { ku: 'چاوەڕوان', en: 'Pending', ar: 'قيد الانتظار', zh: '待处理' }),
    in_transit: pickLang(language, { ku: 'لە ڕێگادا', en: 'In transit', ar: 'قيد النقل', zh: '运输中' }),
    arrived: pickLang(language, { ku: 'گەیشتووە', en: 'Arrived', ar: 'وصلت', zh: '已到达' }),
    delivered: pickLang(language, { ku: 'گەیشتووە بە کڕیار', en: 'Delivered to customer', ar: 'تم التسليم للزبون', zh: '已交付客户' }),
    cancelled: pickLang(language, { ku: 'هەڵوەشاوەتەوە', en: 'Cancelled', ar: 'ملغاة', zh: '已取消' })
  };

  const shippingTypeLabel = batch?.shippingType === 'sea'
    ? pickLang(language, { ku: 'دەریایی', en: 'Sea', ar: 'بحري', zh: '海运' })
    : pickLang(language, { ku: 'ئاسمانی', en: 'Air', ar: 'جوي', zh: '空运' });
  const unit = batch?.shippingType === 'sea' ? 'CBM' : 'KG';

  // Loading state
  if (batchLoading || financialLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  // No batch found
  if (!batch || !financial) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Package className="h-24 w-24 text-muted-foreground/30 mb-6" />
          <h2 className="text-2xl font-bold text-muted-foreground mb-2">{pickLang(language, { ku: "باچ نەدۆزرایەوە", en: "Batch not found", ar: "لم يتم العثور على الدفعة", zh: "未找到批次" })}</h2>
          <p className="text-muted-foreground mb-6">{pickLang(language, { ku: "ئەم باچە بوونی نییە یان سڕاوەتەوە", en: "This batch does not exist or has been deleted", ar: "هذه الدفعة غير موجودة أو تم حذفها", zh: "此批次不存在或已被删除" })}</p>
          <Link href="/reports">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {pickLang(language, { ku: "گەڕانەوە بۆ ڕاپۆرتەکان", en: "Back to reports", ar: "العودة إلى التقارير", zh: "返回报告" })}
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Professional Header */}
        <div className={`relative overflow-hidden rounded-2xl p-8 text-white ${
          batch.shippingType === 'sea' 
            ? 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700' 
            : 'bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700'
        }`}>
          {/* Background decorations */}
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            {/* Top Row: Navigation & Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Link href="/reports">
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur">
                    {batch.shippingType === 'sea' ? (
                      <Ship className="h-8 w-8" />
                    ) : (
                      <Plane className="h-8 w-8" />
                    )}
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">{pickLang(language, { ku: "ڕاپۆرتی دارایی باچ", en: "Batch financial report", ar: "التقرير المالي للدفعة", zh: "批次财务报告" })}</p>
                    <h1 className="text-3xl font-bold">{batch.batchCode}</h1>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={`text-sm px-4 py-2 ${
                  batch.status === 'delivered' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/20 text-white backdrop-blur'
                }`}>
                  {statusLabels[batch.status] || batch.status}
                </Badge>
                <DownloadPDFButton batchId={batchId} />
              </div>
            </div>
            
            {/* Company Header */}
            <div className="flex items-center justify-between border-t border-white/20 pt-6">
              <div className="flex items-center gap-4">
                <Building2 className="h-6 w-6 text-white/70" />
                <div>
                  <p className="text-white/70 text-sm">{company.nameKu}</p>
                  <p className="font-bold text-lg">{company.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-sm">{pickLang(language, { ku: "بەرواری ڕاپۆرت", en: "Report date", ar: "تاريخ التقرير", zh: "报告日期" })}</p>
                <p className="font-bold text-lg flex items-center gap-2 justify-end">
                  <Calendar className="h-5 w-5" />
                  {new Date().toLocaleDateString('ku-IQ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary - 4 Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Cost */}
          <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-red-700">{pickLang(language, { ku: "کۆی تێچوون", en: "Total cost", ar: "إجمالي التكلفة", zh: "总成本" })}</CardTitle>
              <div className="p-3 bg-red-100 rounded-xl">
                <Banknote className="h-6 w-6 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600">{formatCurrency(financial.totalCost)}</div>
              <p className="text-sm text-red-600/70 mt-3 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                {batch.shippingType === 'sea' 
                  ? `${financial.chargedCbm || 0} CBM × $${financial.costPerCbm || 0}`
                  : `${(financial.totalChargeableWeight || totalChargeableWeight).toFixed(2)} KG × $${financial.costPerKg || 0}`
                }
              </p>
            </CardContent>
          </Card>
          
          {/* Total Revenue */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700">{pickLang(language, { ku: "کۆی داهات", en: "Total revenue", ar: "إجمالي الإيرادات", zh: "总收入" })}</CardTitle>
              <div className="p-3 bg-green-100 rounded-xl">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{formatCurrency(financial.totalRevenue)}</div>
              <p className="text-sm text-green-600/70 mt-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                {pickLang(language, { ku: `لە ${financial.totalPackages} پاکەت`, en: `From ${financial.totalPackages} packages`, ar: `من ${financial.totalPackages} طرد`, zh: `来自 ${financial.totalPackages} 个包裹` })}
              </p>
            </CardContent>
          </Card>
          
          {/* Net Profit */}
          <Card className={`border-2 shadow-lg ${isProfitable 
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50' 
            : 'border-red-300 bg-gradient-to-br from-red-50 to-rose-50'
          }`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${isProfitable ? 'text-emerald-700' : 'text-red-700'}`}>
                {isProfitable
                  ? pickLang(language, { ku: 'قازانجی خاوێن', en: 'Net profit', ar: 'صافي الربح', zh: '净利润' })
                  : pickLang(language, { ku: 'زیان', en: 'Loss', ar: 'خسارة', zh: '亏损' })}
              </CardTitle>
              <div className={`p-3 rounded-xl ${isProfitable ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {isProfitable ? (
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(Math.abs(financial.profit))}
              </div>
              <p className={`text-sm mt-3 flex items-center gap-2 ${isProfitable ? 'text-emerald-600/70' : 'text-red-600/70'}`}>
                {isProfitable ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    {pickLang(language, { ku: "قازانجدارە", en: "Profitable", ar: "مربح", zh: "盈利" })}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    {pickLang(language, { ku: "زیاندارە", en: "Loss-making", ar: "خاسر", zh: "亏损" })}
                  </>
                )}
              </p>
            </CardContent>
          </Card>
          
          {/* Profit Margin */}
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">{pickLang(language, { ku: "ڕێژەی قازانج", en: "Profit margin", ar: "هامش الربح", zh: "利润率" })}</CardTitle>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Percent className="h-6 w-6 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${
                financial.profitMargin >= 20 ? 'text-green-600' : 
                financial.profitMargin >= 10 ? 'text-yellow-600' : 
                financial.profitMargin >= 0 ? 'text-orange-600' : 'text-red-600'
              }`}>
                {financial.profitMargin?.toFixed(1) || 0}%
              </div>
              <p className="text-sm text-blue-600/70 mt-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                {financial.profitMargin >= 20 ? pickLang(language, { ku: 'زۆر باش', en: 'Excellent', ar: 'ممتاز', zh: '优秀' }) :
                 financial.profitMargin >= 10 ? pickLang(language, { ku: 'باش', en: 'Good', ar: 'جيد', zh: '良好' }) :
                 financial.profitMargin >= 0 ? pickLang(language, { ku: 'نزم', en: 'Low', ar: 'منخفض', zh: '偏低' }) : pickLang(language, { ku: 'زیان', en: 'Loss', ar: 'خسارة', zh: '亏损' })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weight Analysis */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Scale className="h-5 w-5 text-amber-600" />
                </div>
                {pickLang(language, { ku: "شیکاری کێش", en: "Weight analysis", ar: "تحليل الوزن", zh: "重量分析" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-200 rounded-xl">
                    <Calculator className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-amber-800 font-medium">{pickLang(language, { ku: `${unit} حسابکراو`, en: `Chargeable ${unit}`, ar: `${unit} المحتسب`, zh: `计费 ${unit}` })}</p>
                    <p className="text-amber-600/70 text-sm">{pickLang(language, { ku: "کێشی کۆتایی بۆ حسابکردن", en: "Final weight for calculation", ar: "الوزن النهائي للاحتساب", zh: "用于计算的最终重量" })}</p>
                  </div>
                </div>
                <span className="font-bold text-3xl text-amber-700">
                  {batch.shippingType === 'sea' 
                    ? financial.chargedCbm?.toFixed(3) 
                    : totalChargeableWeight.toFixed(2)
                  } {unit}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-slate-600 text-sm mb-1">{pickLang(language, { ku: "کۆی پاکەت", en: "Total packages", ar: "إجمالي الطرود", zh: "包裹总数" })}</p>
                  <p className="text-2xl font-bold text-slate-800">{financial.totalPackages}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-slate-600 text-sm mb-1">{pickLang(language, { ku: "کۆی کڕیار", en: "Total customers", ar: "إجمالي الزبائن", zh: "客户总数" })}</p>
                  <p className="text-2xl font-bold text-slate-800">{financial.customerBreakdown?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Price Analysis */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                {pickLang(language, { ku: "شیکاری نرخ", en: "Price analysis", ar: "تحليل السعر", zh: "价格分析" })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center p-5 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-200 rounded-xl">
                    <TrendingDown className="h-5 w-5 text-red-700" />
                  </div>
                  <div>
                    <p className="text-red-800 font-medium">{pickLang(language, { ku: "نرخی کڕین", en: "Cost price", ar: "سعر الشراء", zh: "采购价" })}</p>
                    <p className="text-red-600/70 text-sm">{pickLang(language, { ku: `نرخی هەر ${unit}`, en: `Price per ${unit}`, ar: `سعر كل ${unit}`, zh: `每 ${unit} 价格` })}</p>
                  </div>
                </div>
                <span className="font-bold text-2xl text-red-700">
                  ${batch.shippingType === 'sea' ? financial.costPerCbm : financial.costPerKg}/{unit}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-200 rounded-xl">
                    <TrendingUp className="h-5 w-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-green-800 font-medium">{pickLang(language, { ku: "نرخی فرۆشتن (تێکڕا)", en: "Selling price (average)", ar: "سعر البيع (المتوسط)", zh: "销售价（平均）" })}</p>
                    <p className="text-green-600/70 text-sm">{pickLang(language, { ku: `نرخی هەر ${unit}`, en: `Price per ${unit}`, ar: `سعر كل ${unit}`, zh: `每 ${unit} 价格` })}</p>
                  </div>
                </div>
                <span className="font-bold text-2xl text-green-700">
                  ${(() => {
                    const divisor = batch.shippingType === 'sea' ? financial.actualCbm : totalChargeableWeight;
                    return financial.totalRevenue > 0 && divisor > 0
                      ? (financial.totalRevenue / divisor).toFixed(2)
                      : '0.00';
                  })()}/{unit}
                </span>
              </div>
              
              <div className={`flex justify-between items-center p-5 rounded-xl border ${
                isProfitable 
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' 
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${isProfitable ? 'bg-blue-200' : 'bg-red-200'}`}>
                    <Wallet className={`h-5 w-5 ${isProfitable ? 'text-blue-700' : 'text-red-700'}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${isProfitable ? 'text-blue-800' : 'text-red-800'}`}>
                      {isProfitable
                        ? pickLang(language, { ku: `قازانج بۆ هەر ${unit}`, en: `Profit per ${unit}`, ar: `الربح لكل ${unit}`, zh: `每 ${unit} 利润` })
                        : pickLang(language, { ku: `زیان بۆ هەر ${unit}`, en: `Loss per ${unit}`, ar: `الخسارة لكل ${unit}`, zh: `每 ${unit} 亏损` })}
                    </p>
                    <p className={`text-sm ${isProfitable ? 'text-blue-600/70' : 'text-red-600/70'}`}>
                      {pickLang(language, { ku: "جیاوازی نرخ", en: "Price difference", ar: "فرق السعر", zh: "价格差额" })}
                    </p>
                  </div>
                </div>
                <span className={`font-bold text-2xl ${isProfitable ? 'text-blue-700' : 'text-red-700'}`}>
                  ${(() => {
                    const divisor = batch.shippingType === 'sea' ? financial.actualCbm : totalChargeableWeight;
                    return divisor > 0
                      ? (financial.profit / divisor).toFixed(2)
                      : '0.00';
                  })()}/{unit}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Breakdown Table */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-slate-50">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              {pickLang(language, { ku: "شیکاری بەپێی کڕیار", en: "Analysis by customer", ar: "التحليل حسب الزبون", zh: "按客户分析" })}
            </CardTitle>
            <CardDescription>
              {pickLang(language, { ku: "داهات و وردەکاری هەر کڕیارێک لەم باچەدا", en: "Revenue and details for each customer in this batch", ar: "الإيرادات وتفاصيل كل زبون في هذه الدفعة", zh: "本批次中每位客户的收入与明细" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {financial.customerBreakdown?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="h-20 w-20 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">{pickLang(language, { ku: "هیچ زانیارییەک بەردەست نییە", en: "No data available", ar: "لا توجد بيانات متاحة", zh: "暂无数据" })}</p>
                <p className="text-sm mt-2">{pickLang(language, { ku: "هێشتا هیچ پاکەتێک لەم باچەدا نییە", en: "There are no packages in this batch yet", ar: "لا توجد طرود في هذه الدفعة بعد", zh: "此批次中尚无包裹" })}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-slate-100">
                      <th className="text-right py-4 px-6 font-semibold text-slate-700">{pickLang(language, { ku: "کڕیار", en: "Customer", ar: "الزبون", zh: "客户" })}</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700">{pickLang(language, { ku: "پاکەت", en: "Packages", ar: "الطرود", zh: "包裹" })}</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700">
                        {batch.shippingType === 'sea' ? 'CBM' : pickLang(language, { ku: 'کێش حسابکراو', en: 'Chargeable weight', ar: 'الوزن المحتسب', zh: '计费重量' })}
                      </th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700">{pickLang(language, { ku: "داهات", en: "Revenue", ar: "الإيرادات", zh: "收入" })}</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700">{pickLang(language, { ku: "ڕێژە", en: "Share", ar: "النسبة", zh: "占比" })}</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700">{pickLang(language, { ku: "وردەکاری", en: "Details", ar: "التفاصيل", zh: "明细" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.customerBreakdown
                      ?.sort((a, b) => b.revenue - a.revenue)
                      .map((item, index) => (
                        <tr 
                          key={item.customerId} 
                          className={`border-b hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{getCustomerName(item.customerId)}</p>
                                <Badge variant="outline" className="text-xs mt-1">{getCustomerCode(item.customerId)}</Badge>
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-4 px-4">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 px-3 py-1">
                              {item.packages}
                            </Badge>
                          </td>
                          <td className="text-center py-4 px-4 font-mono">
                            {batch.shippingType === 'sea' 
                              ? item.cbm?.toFixed(3)
                              : <span className="text-amber-600 font-bold">{item.chargeableWeight?.toFixed(2)}</span>
                            }
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="font-bold text-green-600 text-lg">{formatCurrency(item.revenue)}</span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                  style={{ width: `${((item.revenue / financial.totalRevenue) * 100).toFixed(0)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-slate-600">
                                {((item.revenue / financial.totalRevenue) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-4 px-4">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="gap-2 hover:bg-indigo-50 hover:text-indigo-600"
                              onClick={() => {
                                setSelectedCustomer({
                                  id: item.customerId,
                                  name: getCustomerName(item.customerId),
                                  code: getCustomerCode(item.customerId)
                                });
                                setIsCustomerModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              {pickLang(language, { ku: "بینین", en: "View", ar: "عرض", zh: "查看" })}
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td className="py-4 px-6 text-slate-700">{pickLang(language, { ku: "کۆی گشتی", en: "Grand total", ar: "المجموع الكلي", zh: "总计" })}</td>
                      <td className="text-center py-4 px-4">
                        <Badge className="bg-indigo-600 px-3 py-1">{financial.totalPackages}</Badge>
                      </td>
                      <td className="text-center py-4 px-4 font-mono">
                        {batch.shippingType === 'sea' 
                          ? financial.actualCbm?.toFixed(3)
                          : <span className="text-amber-600 font-bold">{totalChargeableWeight.toFixed(2)}</span>
                        }
                      </td>
                      <td className="text-center py-4 px-4 text-green-600 text-lg">
                        {formatCurrency(financial.totalRevenue)}
                      </td>
                      <td className="text-center py-4 px-4">100%</td>
                      <td className="text-center py-4 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Summary Card */}
        <Card className={`border-2 shadow-lg ${isProfitable 
          ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50' 
          : 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50'
        }`}>
          <CardContent className="flex items-center justify-between py-8 px-8">
            <div className="flex items-center gap-6">
              <div className={`p-5 rounded-2xl ${isProfitable ? 'bg-green-100' : 'bg-red-100'}`}>
                {isProfitable ? (
                  <CheckCircle className="h-12 w-12 text-green-600" />
                ) : (
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                )}
              </div>
              <div>
                <p className={`text-2xl font-bold ${isProfitable ? 'text-green-700' : 'text-red-700'}`}>
                  {isProfitable
                    ? pickLang(language, { ku: 'ئەم باچە قازانجدارە!', en: 'This batch is profitable!', ar: 'هذه الدفعة مربحة!', zh: '此批次盈利！' })
                    : pickLang(language, { ku: 'ئەم باچە زیاندارە', en: 'This batch is loss-making', ar: 'هذه الدفعة خاسرة', zh: '此批次亏损' })}
                </p>
                <p className="text-muted-foreground mt-2 text-lg">
                  {isProfitable
                    ? pickLang(language, {
                        ku: `قازانجی ${formatCurrency(financial.profit)} بە ڕێژەی ${financial.profitMargin?.toFixed(1)}%`,
                        en: `Profit of ${formatCurrency(financial.profit)} at a margin of ${financial.profitMargin?.toFixed(1)}%`,
                        ar: `ربح قدره ${formatCurrency(financial.profit)} بهامش ${financial.profitMargin?.toFixed(1)}%`,
                        zh: `利润 ${formatCurrency(financial.profit)}，利润率 ${financial.profitMargin?.toFixed(1)}%`,
                      })
                    : pickLang(language, {
                        ku: `زیانی ${formatCurrency(Math.abs(financial.profit))} بە ڕێژەی ${Math.abs(financial.profitMargin || 0).toFixed(1)}%`,
                        en: `Loss of ${formatCurrency(Math.abs(financial.profit))} at a margin of ${Math.abs(financial.profitMargin || 0).toFixed(1)}%`,
                        ar: `خسارة قدرها ${formatCurrency(Math.abs(financial.profit))} بهامش ${Math.abs(financial.profitMargin || 0).toFixed(1)}%`,
                        zh: `亏损 ${formatCurrency(Math.abs(financial.profit))}，比率 ${Math.abs(financial.profitMargin || 0).toFixed(1)}%`,
                      })
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{pickLang(language, { ku: "بەرواری دروستکردن", en: "Creation date", ar: "تاريخ الإنشاء", zh: "创建日期" })}</p>
              <p className="font-medium text-lg flex items-center gap-2 justify-end mt-1">
                <Calendar className="h-5 w-5" />
                {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString('ku-IQ') : '-'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Packages Modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <span className="text-lg">{selectedCustomer?.name}</span>
                <Badge variant="outline" className="me-2 text-xs">{selectedCustomer?.code}</Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              {pickLang(language, { ku: "پاکەتەکانی ئەم کڕیارە لەم باچەدا", en: "This customer's packages in this batch", ar: "طرود هذا الزبون في هذه الدفعة", zh: "本批次中该客户的包裹" })}
            </DialogDescription>
          </DialogHeader>
          
          {packagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : customerPackages && customerPackages.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-blue-600">{pickLang(language, { ku: "کۆی پاکەت", en: "Total packages", ar: "إجمالي الطرود", zh: "包裹总数" })}</p>
                    <p className="text-2xl font-bold text-blue-700">{customerPackages.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-amber-600">{pickLang(language, { ku: "کێش حسابکراو", en: "Chargeable weight", ar: "الوزن المحتسب", zh: "计费重量" })}</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {batch?.shippingType === 'sea' 
                        ? customerPackages.reduce((sum, p) => sum + (p.volumeCbm || 0), 0).toFixed(3)
                        : customerPackages.reduce((sum, p) => {
                            const actualWeight = p.weightKg || 0;
                            const volumetricWeight = (p.lengthCm && p.widthCm && p.heightCm) 
                              ? (p.lengthCm * p.widthCm * p.heightCm) / 6000 
                              : 0;
                            return sum + Math.max(actualWeight, volumetricWeight);
                          }, 0).toFixed(2)
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-green-600">{pickLang(language, { ku: "کۆی نرخ", en: "Total price", ar: "إجمالي السعر", zh: "总价" })}</p>
                    <p className="text-2xl font-bold text-green-700">
                      ${customerPackages.reduce((sum, p) => sum + (p.calculatedCostUsd || 0), 0).toFixed(2)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Packages Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-right py-3 px-4 text-sm font-medium">#</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">{pickLang(language, { ku: "تراک نەمبەر", en: "Tracking number", ar: "رقم التتبع", zh: "追踪号" })}</th>
                      <th className="text-center py-3 px-4 text-sm font-medium">{pickLang(language, { ku: "کێش حسابکراو", en: "Chargeable weight", ar: "الوزن المحتسب", zh: "计费重量" })}</th>
                      <th className="text-center py-3 px-4 text-sm font-medium">{pickLang(language, { ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })}</th>
                      <th className="text-center py-3 px-4 text-sm font-medium">{pickLang(language, { ku: "جۆر", en: "Type", ar: "النوع", zh: "类型" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPackages.map((pkg, idx) => {
                      const actualWeight = pkg.weightKg || 0;
                      const volumetricWeight = (pkg.lengthCm && pkg.widthCm && pkg.heightCm) 
                        ? (pkg.lengthCm * pkg.widthCm * pkg.heightCm) / 6000 
                        : 0;
                      const chargeableWeight = Math.max(actualWeight, volumetricWeight);
                      
                      return (
                        <tr key={pkg.id} className="border-t hover:bg-slate-50">
                          <td className="py-3 px-4 text-sm">{idx + 1}</td>
                          <td className="py-3 px-4 text-sm font-mono">{pkg.trackingNumber || '-'}</td>
                          <td className="text-center py-3 px-4 text-sm font-bold text-amber-600">
                            {batch?.shippingType === 'sea' 
                              ? (pkg.volumeCbm?.toFixed(3) || '0')
                              : chargeableWeight.toFixed(2)
                            }
                          </td>
                          <td className="text-center py-3 px-4 text-sm font-bold text-green-600">
                            ${(pkg.calculatedCostUsd || 0).toFixed(2)}
                          </td>
                          <td className="text-center py-3 px-4">
                            <Badge className={
                              pkg.isFullPackage 
                                ? pkg.fullPackageOrderType === 'commission' 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-700'
                            }>
                              {pkg.isFullPackage
                                ? pkg.fullPackageOrderType === 'commission'
                                  ? pickLang(language, { ku: 'کڕین بە تێچوو', en: 'Cost purchase', ar: 'شراء بالتكلفة', zh: '代购' })
                                  : pickLang(language, { ku: 'پاکێجی تەواو', en: 'Full package', ar: 'باقة كاملة', zh: '全包' })
                                : pickLang(language, { ku: 'ئاسایی', en: 'Standard', ar: 'عادي', zh: '普通' })
                              }
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>{pickLang(language, { ku: "هیچ پاکەتێک نەدۆزرایەوە", en: "No packages found", ar: "لم يتم العثور على طرود", zh: "未找到包裹" })}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
