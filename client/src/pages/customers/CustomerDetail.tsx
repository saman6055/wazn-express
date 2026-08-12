import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerAwaitingCard } from "@/components/customers/CustomerAwaitingCard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Crown,
  Edit,
  RotateCcw,
  FileDown,
  Loader2,
  Shield,
  Package,
  Wallet,
  Clock,
  TrendingUp,
  Globe,
  Check,
  Briefcase,
  DollarSign,
  FileText,
  FileCheck,
  Clock as ClockIcon,
  Download,
  User,
} from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { IRAQI_CITIES } from "../../../../shared/iraqi-cities";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { useCustomerDetail } from "@/hooks/useCustomerDetail";
import { CustomerInfoCard } from "@/components/customers/CustomerInfoCard";
import { CustomerSummaryHeader } from "@/components/customers/CustomerSummaryHeader";
import { CustomerPackagesTab } from "@/components/customers/CustomerPackagesTab";
import { CustomerFinanceTab } from "@/components/customers/CustomerFinanceTab";
import { CustomerPendingOrdersSection } from "@/components/customers/CustomerPendingOrdersSection";
import { CustomerDocumentsTab } from "@/components/customers/CustomerDocumentsTab";
import { CustomerActivityTab } from "@/components/customers/CustomerActivityTab";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function CustomerDetail() {
  const { t: tToast, language } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const customerId = parseInt(params.id ?? "0", 10);
  const cd = useCustomerDetail(customerId);
  const {
    customer,
    t,
    balance,
    totalPackages,
    deliveredPackages,
    pendingPackages,
    totalSpent,
    totalWeight,
    averageWeight,
    preferredShippingType,
    preferredShippingCount,
    isVip,
    vipInfo,
    packages,
    ledger,
    invoices,
    activityLogs,
    fullPackageOrders,
    extraServices,
    serviceTypes,
    newService,
    setNewService,
    isAddServiceOpen,
    setIsAddServiceOpen,
    createServiceMutation,
    markAsPaidMutation,
  } = cd;

  const deliveryRatePct = totalPackages > 0 ? Math.round((deliveredPackages / totalPackages) * 100) : 0;

  const lastActivity = useMemo(() => {
    const dates = (packages ?? [])
      .map((p) => (p as unknown as { createdAt?: string | Date }).createdAt)
      .filter((d): d is string | Date => !!d)
      .map((d) => new Date(d).toISOString())
      .sort();
    return dates.length ? dates[dates.length - 1] : undefined;
  }, [packages]);

  // Nationalities & business types for edit form
  const DEFAULT_NATIONALITIES = [
    { id: "kurdish", nameEn: "Kurdish", nameKu: "کورد" },
    { id: "arab", nameEn: "Arab", nameKu: "عەرەب" },
    { id: "turkmen", nameEn: "Turkmen", nameKu: "تورکمان" },
    { id: "assyrian", nameEn: "Assyrian", nameKu: "ئاشووری" },
    { id: "armenian", nameEn: "Armenian", nameKu: "ئەرمەنی" },
    { id: "foreign", nameEn: "Foreign", nameKu: "بیانی" },
    { id: "other", nameEn: "Other", nameKu: "تر" },
  ];
  const DEFAULT_BUSINESS_TYPES = [
    { id: "online_page", nameEn: "Online Page", nameKu: "پەیجی ئۆنلاین" },
    { id: "shop_owner", nameEn: "Shop Owner", nameKu: "دوکاندار" },
    { id: "wholesaler", nameEn: "Wholesaler", nameKu: "جوملەفرۆش" },
    { id: "personal", nameEn: "Personal", nameKu: "کەسی (شەخصی)" },
    { id: "company", nameEn: "Company", nameKu: "کۆمپانیا" },
    { id: "agent", nameEn: "Agent", nameKu: "ئەیجنت" },
    { id: "other", nameEn: "Other", nameKu: "تر" },
  ];
  const { data: settingsData } = trpc.system.getSettings.useQuery();
  const nationalities = useMemo(() => {
    const custom = settingsData?.find(s => s.settingKey === "nationalities")?.settingValue;
    if (custom) { try { return JSON.parse(custom); } catch { return DEFAULT_NATIONALITIES; } }
    return DEFAULT_NATIONALITIES;
  }, [settingsData]);
  const businessTypes = useMemo(() => {
    const custom = settingsData?.find(s => s.settingKey === "businessTypes")?.settingValue;
    if (custom) { try { return JSON.parse(custom); } catch { return DEFAULT_BUSINESS_TYPES; } }
    return DEFAULT_BUSINESS_TYPES;
  }, [settingsData]);
  const editFilteredCities = cd.selectedGovernorate
    ? IRAQI_CITIES.filter((c) => c.governorateId === cd.selectedGovernorate)
    : IRAQI_CITIES;

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">{pickLang(language, { ku: "خشتەکردنی کڕیار...", en: "Loading customer...", ar: "جارٍ تحميل العميل...", zh: "正在加载客户..." })}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">{customer.fullName}</h1>
              {isVip && (
                <Badge
                  className={`text-xs border-0 ${
                    vipInfo?.tier === "platinum"
                      ? "bg-gradient-to-r from-slate-600 to-slate-800 text-white"
                      : vipInfo?.tier === "gold"
                        ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Crown className="h-3 w-3 me-1" />
                  {vipInfo?.tier?.toUpperCase()} VIP
                </Badge>
              )}
              <Badge variant={customer.isActive ? "default" : "secondary"} className="text-xs">
                {customer.isActive ? pickLang(language, { ku: "چالاک", en: "Active", ar: "نشط", zh: "活跃" }) : pickLang(language, { ku: "ناچالاک", en: "Inactive", ar: "غير نشط", zh: "停用" })}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">{customer.customerCode}</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={cd.isResetPasswordOpen} onOpenChange={cd.setIsResetPasswordOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 me-2" />
                  {pickLang(language, { ku: "ڕێستکردنەوەی وشەی نهێنی", en: "Reset Password", ar: "إعادة تعيين كلمة المرور", zh: "重置密码" })}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                    {pickLang(language, { ku: "ڕێستکردنەوەی وشەی نهێنی کڕیار", en: "Reset Customer Password", ar: "إعادة تعيين كلمة مرور العميل", zh: "重置客户密码" })}
                  </DialogTitle>
                  <DialogDescription>{pickLang(language, { ku: "وشەیەکی نهێنی نوێ دابنێ بۆ", en: "Set a new password for", ar: "تعيين كلمة مرور جديدة لـ", zh: "为以下客户设置新密码" })} {customer.fullName}</DialogDescription>
                </DialogHeader>
                <form onSubmit={cd.handleResetPassword}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">{pickLang(language, { ku: "وشەی نهێنی نوێ", en: "New Password", ar: "كلمة مرور جديدة", zh: "新密码" })}</Label>
                      <Input id="newPassword" name="newPassword" type="password" required minLength={6} className="h-11" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => cd.setIsResetPasswordOpen(false)}>
                      {pickLang(language, { ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                    </Button>
                    <Button type="submit" disabled={cd.resetPasswordMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
                      {cd.resetPasswordMutation.isPending ? pickLang(language, { ku: "ڕێستکردنەوە...", en: "Resetting...", ar: "جارٍ إعادة التعيين...", zh: "正在重置..." }) : pickLang(language, { ku: "ڕێستکردنەوەی وشەی نهێنی", en: "Reset Password", ar: "إعادة تعيين كلمة المرور", zh: "重置密码" })}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={cd.handleExportCustomerPDF} disabled={cd.isExportingPDF}>
              {cd.isExportingPDF ? (
                <><Loader2 className="h-4 w-4 me-2 animate-spin" /> {pickLang(language, { ku: "هەناردەکردن...", en: "Exporting...", ar: "جارٍ التصدير...", zh: "正在导出..." })}</>
              ) : (
                <><FileDown className="h-4 w-4 me-2" /> {pickLang(language, { ku: "هەناردەی PDF", en: "Export PDF", ar: "تصدير PDF", zh: "导出 PDF" })}</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={cd.handleOpenEdit}>
              <Edit className="h-4 w-4 me-2" />
              {pickLang(language, { ku: "دەستکاری", en: "Edit", ar: "تعديل", zh: "编辑" })}
            </Button>
          </div>
        </div>

        <CustomerSummaryHeader
          totalOrders={totalPackages}
          balance={balance ?? undefined}
          currency="USD"
          lastActivity={lastActivity}
          createdAt={(() => {
            const c = (customer as unknown as { createdAt?: string | Date }).createdAt;
            return c ? new Date(c).toISOString() : undefined;
          })()}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <CustomerInfoCard customer={customer as any} t={t} />

          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.balance")}</p>
                      <p className={`text-2xl font-bold ${(balance ?? 0) > 0 ? "text-red-600 dark:text-red-300" : (balance ?? 0) < 0 ? "text-green-600 dark:text-green-300" : ""}`}>
                        ${Math.abs(balance ?? 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(balance ?? 0) > 0 ? t("customers.inDebt") : (balance ?? 0) < 0 ? t("customers.hasCredit") : t("customers.settled")}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${(balance ?? 0) > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                      <Wallet className={`h-5 w-5 ${(balance ?? 0) > 0 ? "text-red-600 dark:text-red-300" : "text-green-600 dark:text-green-300"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalPackages")}</p>
                      <p className="text-2xl font-bold">{totalPackages}</p>
                      <p className="text-xs text-muted-foreground">{deliveredPackages} {t("packages.delivered")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("packages.inProgress")}</p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-300">{pendingPackages}</p>
                      <p className="text-xs text-muted-foreground">{t("common.active")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalSpent")}</p>
                      <p className="text-2xl font-bold">${totalSpent.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t("common.allTime")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.totalWeight")}</p>
                      <p className="text-2xl font-bold">{totalWeight.toFixed(2)} kg</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Package className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.avgWeight")}</p>
                      <p className="text-2xl font-bold">{averageWeight.toFixed(2)} kg</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.preferredShipping")}</p>
                      <p className="text-2xl font-bold">{preferredShippingType}</p>
                      <p className="text-xs text-muted-foreground">{preferredShippingCount} {t("common.packages")}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t("customers.deliveryRate")}</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-300">{deliveryRatePct}%</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="packages" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="packages" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">{pickLang(language, { ku: "پاکێجەکان", en: "Packages", ar: "الطرود", zh: "包裹" })}</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">{pickLang(language, { ku: "خزمەتگوزاری", en: "Services", ar: "الخدمات", zh: "服务" })}</span>
                </TabsTrigger>
                <TabsTrigger value="finance" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">{pickLang(language, { ku: "دارایی", en: "Finance", ar: "المالية", zh: "财务" })}</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-2">
                  <FileCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">{pickLang(language, { ku: "بەڵگەنامەکان", en: "Documents", ar: "المستندات", zh: "文件" })}</span>
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2">
                  <ClockIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{pickLang(language, { ku: "چالاکی", en: "Activity", ar: "النشاط", zh: "活动" })}</span>
                </TabsTrigger>
                <TabsTrigger value="fullPackage" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("nav.fullPackage")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="packages" className="mt-4 space-y-4">
                {/* What is still coming, above what already arrived: the office
                    reads this out when the customer rings to ask where it is. */}
                <CustomerAwaitingCard customerId={customerId} />
                <CustomerPackagesTab packages={packages as any} customerId={customerId} t={t} />
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{pickLang(language, { ku: "خزمەتگوزاری زیادە", en: "Extra Services", ar: "خدمات إضافية", zh: "额外服务" })}</CardTitle>
                        <CardDescription>{t("customers.additionalServices")}</CardDescription>
                      </div>
                      <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" />
                            {pickLang(language, { ku: "زیادکردنی خزمەت", en: "Add Service", ar: "إضافة خدمة", zh: "添加服务" })}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>{pickLang(language, { ku: "زیادکردنی خزمەتی زیادە", en: "Add Extra Service", ar: "إضافة خدمة إضافية", zh: "添加额外服务" })}</DialogTitle>
                            <DialogDescription>{t("customers.addServiceDescription")}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>{t("customers.serviceType")}</Label>
                              <Select
                                value={newService.serviceTypeId.toString()}
                                onValueChange={(v) => {
                                  const typeId = parseInt(v, 10);
                                  const selectedType = serviceTypes?.find((st) => st.id === typeId);
                                  setNewService({
                                    ...newService,
                                    serviceTypeId: typeId,
                                    costAmount: selectedType?.defaultCost ?? "",
                                    priceAmount: selectedType?.defaultPrice ?? "",
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={pickLang(language, { ku: "جۆری خزمەت هەڵبژێرە...", en: "Select service type...", ar: "اختر نوع الخدمة...", zh: "选择服务类型..." })} />
                                </SelectTrigger>
                                <SelectContent>
                                  {serviceTypes?.map((type) => (
                                    <SelectItem key={type.id} value={type.id.toString()}>
                                      {type.nameKu || type.nameEn}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t("common.description")}</Label>
                              <Textarea
                                placeholder={pickLang(language, { ku: "وەسفی خزمەت بنووسە...", en: "Enter service description...", ar: "أدخل وصف الخدمة...", zh: "输入服务描述..." })}
                                value={newService.description}
                                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>{t("common.cost")}</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newService.costAmount}
                                  onChange={(e) => setNewService({ ...newService, costAmount: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>{t("common.price")}</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newService.priceAmount}
                                  onChange={(e) => setNewService({ ...newService, priceAmount: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="addToBalance"
                                checked={newService.addToBalance}
                                onChange={(e) => setNewService({ ...newService, addToBalance: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="addToBalance" className="text-sm cursor-pointer">
                                {t("customers.addToBalance")}
                              </Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddServiceOpen(false)}>
                              {pickLang(language, { ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                            </Button>
                            <Button
                              onClick={() => {
                                if (!newService.serviceTypeId || !newService.description || !newService.priceAmount) {
                                  toast.error(tToast("toast.fillRequiredFields"));
                                  return;
                                }
                                createServiceMutation.mutate({
                                  ...newService,
                                  customerId,
                                  costAmount: newService.costAmount || "0",
                                });
                              }}
                              disabled={createServiceMutation.isPending}
                            >
                              {createServiceMutation.isPending ? pickLang(language, { ku: "زیادکردن...", en: "Adding...", ar: "جارٍ الإضافة...", zh: "正在添加..." }) : pickLang(language, { ku: "زیادکردنی خزمەت", en: "Add Service", ar: "إضافة خدمة", zh: "添加服务" })}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>{pickLang(language, { ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                          <TableHead>{pickLang(language, { ku: "خزمەت", en: "Service", ar: "الخدمة", zh: "服务" })}</TableHead>
                          <TableHead>{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</TableHead>
                          <TableHead className="text-right">{pickLang(language, { ku: "تێچوو", en: "Cost", ar: "التكلفة", zh: "成本" })}</TableHead>
                          <TableHead className="text-right">{pickLang(language, { ku: "نرخ", en: "Price", ar: "السعر", zh: "价格" })}</TableHead>
                          <TableHead className="text-right">{pickLang(language, { ku: "قازانج", en: "Profit", ar: "الربح", zh: "利润" })}</TableHead>
                          <TableHead>{pickLang(language, { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extraServices?.map((service) => {
                          const profit = Number(service.priceAmount ?? 0) - Number(service.costAmount ?? 0);
                          return (
                            <TableRow key={service.id}>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(service.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {service.serviceType?.nameKu || service.serviceType?.nameEn || pickLang(language, { ku: "خزمەت", en: "Service", ar: "الخدمة", zh: "服务" })}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">{service.description}</TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                ${Number(service.costAmount ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                ${Number(service.priceAmount ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className={`text-right font-medium ${profit >= 0 ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300"}`}>
                                ${profit.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {service.isPaid ? (
                                  <Badge className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-0 text-xs">{pickLang(language, { ku: "پارەدراو", en: "Paid", ar: "مدفوع", zh: "已付款" })}</Badge>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                      markAsPaidMutation.mutate({
                                        id: service.id,
                                        paymentMethod: "cash",
                                        paidAmount: service.priceAmount ?? "0",
                                      })
                                    }
                                  >
                                    {pickLang(language, { ku: "نیشانکردن وەک پارەدراو", en: "Mark Paid", ar: "تحديد كمدفوع", zh: "标记为已付款" })}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!extraServices || extraServices.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12">
                              <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                              <p className="text-muted-foreground">{pickLang(language, { ku: "هێشتا هیچ خزمەتێکی زیادە نییە", en: "No extra services yet", ar: "لا توجد خدمات إضافية بعد", zh: "暂无额外服务" })}</p>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="finance" className="mt-4">
                <CustomerPendingOrdersSection customerId={customerId} />
                <CustomerFinanceTab
                  ledger={ledger as any}
                  invoices={invoices as any}
                  downloadingInvoiceId={cd.downloadingInvoiceId}
                  onViewInvoice={cd.handleViewInvoice}
                  onDownloadInvoice={cd.handleDownloadInvoice}
                  t={t}
                />
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <CustomerDocumentsTab
                  customer={customer as { passportUrl?: string; nationalIdUrl?: string; contractUrl?: string }}
                  uploadingDoc={cd.uploadingDoc}
                  passportInputRef={cd.passportInputRef}
                  nationalIdInputRef={cd.nationalIdInputRef}
                  contractInputRef={cd.contractInputRef}
                  onDocumentUpload={cd.handleDocumentUpload}
                  onDocumentDelete={cd.handleDocumentDelete}
                  t={t}
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <CustomerActivityTab activityLogs={activityLogs as any} t={t} />
              </TabsContent>

              <TabsContent value="fullPackage" className="mt-4">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{t("nav.fullPackage")}</CardTitle>
                        <CardDescription>{t("fullPackage.allOrders")}</CardDescription>
                      </div>
                      <Badge variant="secondary">{fullPackageOrders?.length ?? 0} {t("common.total")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fullPackageOrders && fullPackageOrders.length > 0 ? (
                      <div className="space-y-3">
                        {fullPackageOrders.map((order: any) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => setLocation(`/full-package/${order.id}`)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{order.orderCode}</p>
                                <p className="text-sm text-muted-foreground">{order.productName ?? t("common.noName")}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={order.status === "delivered" ? "default" : order.status === "pending" ? "secondary" : "outline"}>
                                {order.status}
                              </Badge>
                              <p className="text-sm font-medium mt-1">${Number(order.totalPrice ?? 0).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-muted-foreground">{t("fullPackage.noOrders")}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit Customer Dialog - full form matching create form */}
      <Dialog open={cd.isEditOpen} onOpenChange={cd.setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              {t("customers.editCustomer")}
            </DialogTitle>
            <DialogDescription>{t("customers.editCustomerDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={cd.handleEditSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">{t("customers.form.basicInfo")}</TabsTrigger>
                <TabsTrigger value="location">{t("customers.form.location")}</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* Customer Code - read only */}
                <div className="grid gap-2">
                  <Label>{t("customers.customerCode")}</Label>
                  <Input value={cd.editForm.customerCode} disabled className="h-11 bg-muted" />
                </div>

                {/* Full Name (English) */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-fullName">{t("customers.form.fullNameEn")} *</Label>
                  <Input
                    id="edit-fullName"
                    value={cd.editForm.fullName}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, fullName: e.target.value })}
                    required
                    className="h-11"
                  />
                </div>

                {/* Arabic & Kurdish names */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-fullNameArabic">{t("customers.form.nameArabic")}</Label>
                    <Input
                      id="edit-fullNameArabic"
                      value={cd.editForm.fullNameArabic}
                      onChange={(e) => cd.setEditForm({ ...cd.editForm, fullNameArabic: e.target.value })}
                      dir="rtl"
                      className="h-11"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-fullNameKurdish">{t("customers.form.nameKurdish")}</Label>
                    <Input
                      id="edit-fullNameKurdish"
                      value={cd.editForm.fullNameKurdish}
                      onChange={(e) => cd.setEditForm({ ...cd.editForm, fullNameKurdish: e.target.value })}
                      dir="rtl"
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Gender & Nationality */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t("customers.form.gender")}</Label>
                    <Select value={cd.editForm.gender} onValueChange={(v) => cd.setEditForm({ ...cd.editForm, gender: v as "male" | "female" | "" })}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("customers.form.selectGender")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                            {t("common.male")}
                          </div>
                        </SelectItem>
                        <SelectItem value="female">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                            {t("common.female")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("customers.form.nationality")}</Label>
                    <Select value={cd.editForm.nationality} onValueChange={(v) => cd.setEditForm({ ...cd.editForm, nationality: v })}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("customers.form.selectNationality")} />
                      </SelectTrigger>
                      <SelectContent>
                        {nationalities.map((nat: any) => (
                          <SelectItem key={nat.id} value={nat.id}>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                              {nat.nameKu} - {nat.nameEn}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Business Type */}
                <div className="grid gap-2">
                  <Label>{t("customers.form.businessType")}</Label>
                  <Select value={cd.editForm.businessType} onValueChange={(v) => cd.setEditForm({ ...cd.editForm, businessType: v })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t("customers.form.selectBusinessType")} />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((bt: any) => (
                        <SelectItem key={bt.id} value={bt.id}>
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                            {bt.nameKu} - {bt.nameEn}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service types (optional, multi-select) */}
                <div className="grid gap-2">
                  <Label>{pickLang(language, { ku: "جۆری خزمەت", en: "Service Type", ar: "نوع الخدمة", zh: "服务类型" })} <span className="text-muted-foreground font-normal">({pickLang(language, { ku: "ئیختیاری", en: "Optional", ar: "اختياري", zh: "可选" })})</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "full_package", label: pickLang(language, { ku: "پاکێجی تەواو", en: "Full Package", ar: "الباقة الكاملة", zh: "全包套餐" }) },
                      { value: "commission", label: pickLang(language, { ku: "کرین بە تێچوو", en: "Purchase at Cost", ar: "الشراء بالتكلفة", zh: "代购" }) },
                      { value: "self_order", label: pickLang(language, { ku: "سێلف ئۆردەر", en: "Self Order", ar: "طلب ذاتي", zh: "自助下单" }) },
                    ].map((st) => {
                      const active = cd.editForm.serviceTypes.includes(st.value);
                      return (
                        <Button
                          key={st.value}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className={active ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                          onClick={() => cd.setEditForm({
                            ...cd.editForm,
                            serviceTypes: active
                              ? cd.editForm.serviceTypes.filter((v: string) => v !== st.value)
                              : [...cd.editForm.serviceTypes, st.value],
                          })}
                        >
                          {st.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile & Secondary Mobile */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-mobileNumber">{t("customers.form.mobileNumber")}</Label>
                    <Input
                      id="edit-mobileNumber"
                      value={cd.editForm.mobileNumber}
                      onChange={(e) => cd.setEditForm({ ...cd.editForm, mobileNumber: e.target.value })}
                      type="tel"
                      className="h-11"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-secondaryMobile">{t("customers.form.secondaryMobile")}</Label>
                    <Input
                      id="edit-secondaryMobile"
                      value={cd.editForm.secondaryMobile}
                      onChange={(e) => cd.setEditForm({ ...cd.editForm, secondaryMobile: e.target.value })}
                      type="tel"
                      className="h-11"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">{t("customers.form.email")}</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={cd.editForm.email}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, email: e.target.value })}
                    className="h-11"
                  />
                </div>

                {/* Notes */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-notes">{t("common.notes")}</Label>
                  <Textarea
                    id="edit-notes"
                    value={cd.editForm.notes}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Active */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    checked={cd.editForm.isActive}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-800/60"
                  />
                  <Label htmlFor="edit-isActive" className="cursor-pointer">
                    {t("common.active")}
                  </Label>
                </div>
              </TabsContent>

              <TabsContent value="location" className="space-y-4 mt-4">
                {/* Governorate & City */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t("customers.form.governorate")}</Label>
                    <Select
                      value={cd.selectedGovernorate}
                      onValueChange={(value) => {
                        cd.setSelectedGovernorate(value);
                        const gov = cd.IRAQI_GOVERNORATES.find((g) => g.id === value);
                        cd.setEditForm({ ...cd.editForm, country: gov?.nameEn ?? "", city: "" });
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t("customers.form.selectGovernorate")} />
                      </SelectTrigger>
                      <SelectContent>
                        {cd.IRAQI_GOVERNORATES.map((gov) => (
                          <SelectItem key={gov.id} value={gov.id}>
                            {gov.nameKu} - {gov.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("customers.form.city")}</Label>
                    <select
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={cd.editForm.city}
                      onChange={(e) => cd.setEditForm({ ...cd.editForm, city: e.target.value })}
                      disabled={!cd.selectedGovernorate}
                    >
                      <option value="">{cd.selectedGovernorate ? t("customers.selectCity") : t("customers.selectGovernorateFirst")}</option>
                      {editFilteredCities.map((city) => (
                        <option key={`${city.governorateId}-${city.nameEn}`} value={city.nameEn}>
                          {city.nameKu} - {city.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* District */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-district">{t("customers.form.district")}</Label>
                  <Input
                    id="edit-district"
                    value={cd.editForm.district}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, district: e.target.value })}
                    className="h-11"
                    placeholder={pickLang(language, { ku: "بۆ نموونە: عەنکاوە", en: "e.g., Ankawa, Ainkawa", ar: "مثال: عنكاوا", zh: "例如：安卡瓦" })}
                  />
                </div>

                {/* Address */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">{t("customers.form.address")}</Label>
                  <Input
                    id="edit-address"
                    value={cd.editForm.address}
                    onChange={(e) => cd.setEditForm({ ...cd.editForm, address: e.target.value })}
                    className="h-11"
                    placeholder={t("customers.form.addressPlaceholder")}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => cd.setIsEditOpen(false)}>
                {t("forms.cancel")}
              </Button>
              <Button type="submit" disabled={cd.updateCustomerMutation.isPending}>
                {cd.updateCustomerMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t("messages.saving")}</>
                ) : (
                  <><Check className="h-4 w-4 me-2" />{t("forms.save")}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice View Dialog */}
      <Dialog open={cd.isInvoiceViewOpen} onOpenChange={cd.setIsInvoiceViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("invoices.invoiceDetails") ?? "Invoice Details"}
            </DialogTitle>
            <DialogDescription>
              {(cd.selectedInvoice as { invoiceNumber?: string })?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          {!!cd.selectedInvoice && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">
                    {t("invoices.invoice") ?? "Invoice"} #{(cd.selectedInvoice as { invoiceNumber?: string }).invoiceNumber}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("common.date")}: {new Date((cd.selectedInvoice as { createdAt?: string }).createdAt ?? "").toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {(cd.selectedInvoice as { status?: string }).status}
                </Badge>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">{t("customers.customer") ?? "Customer"}</h4>
                <p className="text-sm">{customer.fullName}</p>
                <p className="text-sm text-muted-foreground">{customer.customerCode}</p>
              </div>
              <Separator />
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t("common.total")}:</span>
                    <span className="text-primary">${(cd.selectedInvoice as { totalUsd?: string }).totalUsd}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => cd.setIsInvoiceViewOpen(false)}>
              {t("common.close") ?? "Close"}
            </Button>
            <Button
              onClick={() => cd.selectedInvoice && cd.handleDownloadInvoice((cd.selectedInvoice as { id: number }).id)}
              disabled={cd.downloadingInvoiceId === (cd.selectedInvoice as { id?: number })?.id}
            >
              {cd.downloadingInvoiceId === (cd.selectedInvoice as { id?: number })?.id ? (
                <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t("common.downloading") ?? "Downloading..."}</>
              ) : (
                <><Download className="h-4 w-4 me-2" />{t("common.downloadPDF") ?? "Download PDF"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
