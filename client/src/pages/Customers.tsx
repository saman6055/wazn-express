import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { DEFAULT_RESET_PASSWORD } from "@shared/resetPassword";
import { useCustomers, useFilteredCustomers } from "@/hooks/useCustomers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Plus, Search, Eye, RotateCcw, Users, UserPlus, Crown, TrendingUp,
  Phone, Mail, MapPin, Filter, X, ChevronDown, Upload, FileText,
  CreditCard, FileCheck, DollarSign, Package, Wallet, User, Briefcase, Globe, Settings, Trash2
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { IRAQI_GOVERNORATES, IRAQI_CITIES } from "../../../shared/iraqi-cities";
import { CUSTOMER_CODE_PREFIXES } from "../../../shared/types";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { useAuth } from "@/_core/hooks/useAuth";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { FilterChips } from "@/components/ui/filter-chips";

// Default options - these can be customized in settings
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

// Form data interface
interface CustomerFormData {
  fullName: string;
  fullNameArabic: string;
  fullNameKurdish: string;
  gender: string;
  nationality: string;
  businessType: string;
  mobileNumber: string;
  secondaryMobile: string;
  password: string;
  email: string;
  governorate: string;
  city: string;
  district: string;
  address: string;
  codePrefix: string;
  useCustomCode: boolean;
  customCode: string;
  serviceTypes: string[];
}

const initialFormData: CustomerFormData = {
  fullName: "",
  fullNameArabic: "",
  fullNameKurdish: "",
  gender: "",
  nationality: "",
  businessType: "",
  mobileNumber: "",
  secondaryMobile: "",
  password: "",
  email: "",
  governorate: "",
  city: "",
  district: "",
  address: "",
  codePrefix: "AZ",
  useCustomCode: false,
  customCode: "",
  serviceTypes: [],
};

// Service types options (optional, multi-select) with Kurdish labels
const SERVICE_TYPE_OPTIONS: { value: "full_package" | "commission" | "self_order"; label: { ku: string; en: string; ar: string; zh: string } }[] = [
  { value: "full_package", label: { ku: "پاکێجی تەواو", en: "Full Package", ar: "الحزمة الكاملة", zh: "全套服务" } },
  { value: "commission", label: { ku: "کرین بە تێچوو", en: "Purchase at Cost", ar: "الشراء بالتكلفة", zh: "按成本采购" } },
  { value: "self_order", label: { ku: "سێلف ئۆردەر", en: "Self Order", ar: "طلب ذاتي", zh: "自助下单" } },
];

const getServiceTypeLabel = (language: string, value: string) => {
  const option = SERVICE_TYPE_OPTIONS.find((o) => o.value === value);
  return option ? pickLang(language, option.label) : value;
};

export default function Customers() {
    const { t, language } = useTranslation();
const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const {
    customers,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    refetch,
    createMutation,
    resetPasswordMutation,
    uploadDocumentMutation,
  } = useCustomers();

  const deleteCustomerMutation = trpc.customers.delete.useMutation({
    onSuccess: (data) => {
      toast.success(pickLang(language, {
        ku: `کڕیار بە سەرکەوتوویی سڕایەوە (${data.deletedData.packagesCount} پاکەت، ${data.deletedData.invoicesCount} وەسڵ)`,
        en: `Customer deleted successfully (${data.deletedData.packagesCount} packages, ${data.deletedData.invoicesCount} invoices)`,
        ar: `تم حذف العميل بنجاح (${data.deletedData.packagesCount} طرود، ${data.deletedData.invoicesCount} فواتير)`,
        zh: `客户删除成功（${data.deletedData.packagesCount} 个包裹，${data.deletedData.invoicesCount} 张发票）`,
      }));
      setIsDeleteOpen(false);
      setDeleteCustomerId(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // Advanced filters
  const [cityFilter, setCityFilter] = useState<string>("");
  const [governorateFilter, setGovernorateFilter] = useState<string>("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "positive" | "negative" | "zero">("all");
  const [vipFilter, setVipFilter] = useState<"all" | "vip" | "regular">("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<"all" | "full_package" | "commission" | "self_order">("all");
  
  // Form state - persisted across tab switches
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  
  // Fetch code prefixes
  const { data: codePrefixes } = trpc.customerCodePrefixes.list.useQuery({ activeOnly: true });
  const [nationalIdFile, setNationalIdFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  
  const passportInputRef = useRef<HTMLInputElement>(null);
  const nationalIdInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

  // Get custom options from settings (fallback to defaults)
  const { data: settingsData } = trpc.system.getSettings.useQuery();
  
  const nationalities = useMemo(() => {
    const customNationalities = settingsData?.find(s => s.settingKey === "nationalities")?.settingValue;
    if (customNationalities) {
      try {
        return JSON.parse(customNationalities);
      } catch {
        return DEFAULT_NATIONALITIES;
      }
    }
    return DEFAULT_NATIONALITIES;
  }, [settingsData]);

  const businessTypes = useMemo(() => {
    const customBusinessTypes = settingsData?.find(s => s.settingKey === "businessTypes")?.settingValue;
    if (customBusinessTypes) {
      try {
        return JSON.parse(customBusinessTypes);
      } catch {
        return DEFAULT_BUSINESS_TYPES;
      }
    }
    return DEFAULT_BUSINESS_TYPES;
  }, [settingsData]);
  
  const { data: vipCustomers } = trpc.vip.list.useQuery();

  const onCustomerCreateSuccess = () => {
    toast.success(t("customers.customerCreatedSuccess"));
    setIsCreateOpen(false);
    resetForm();
    refetch();
  };
  const onResetPasswordSuccess = () => {
    toast.success(t("customers.passwordResetSuccess"));
    setIsResetOpen(false);
  };
  const onMutationError = (error: { message: string }) => toast.error(error.message);

  const resetForm = () => {
    setFormData(initialFormData);
    setPassportFile(null);
    setNationalIdFile(null);
    setContractFile(null);
  };

  const updateFormData = (field: keyof CustomerFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleServiceType = (value: string) => {
    setFormData(prev => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(value)
        ? prev.serviceTypes.filter(v => v !== value)
        : [...prev.serviceTypes, value],
    }));
  };

  // Get cities for selected governorate in form
  const formCities = useMemo(() => {
    if (!formData.governorate) return [];
    const cities = IRAQI_CITIES.filter(city => city.governorateId === formData.governorate);
    return cities;
  }, [formData.governorate]);

  // Get cities for filter
  const filterCities = governorateFilter 
    ? IRAQI_CITIES.filter(city => city.governorateId === governorateFilter)
    : IRAQI_CITIES;

  const filteredCustomers = useFilteredCustomers(
    customers as any,
    vipCustomers?.map((v: any) => v.customerId),
    { search, statusFilter, cityFilter, governorateFilter, balanceFilter, vipFilter, serviceTypeFilter }
  );

  const activeCount = customers.filter((c) => c.isActive).length;
  const inactiveCount = customers.filter((c) => !c.isActive).length;
  const vipCount = vipCustomers?.length || 0;

  const hasActiveFilters = cityFilter || governorateFilter || balanceFilter !== "all" || vipFilter !== "all" || serviceTypeFilter !== "all";

  const clearAllFilters = () => {
    setCityFilter("");
    setGovernorateFilter("");
    setBalanceFilter("all");
    setVipFilter("all");
    setServiceTypeFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  // uploadDocumentMutation from useCustomers
  
  const uploadFileToS3 = async (file: File, docType: string): Promise<string | null> => {
    try {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            const result = await uploadDocumentMutation.mutateAsync({
              customerId: 0, // Temporary, will be updated after customer creation
              documentType: docType as "passport" | "nationalId" | "contract",
              fileData: base64,
              fileName: file.name,
              mimeType: file.type,
            });
            resolve(result.url);
          } catch (err) {
            console.error('Upload error:', err);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } catch {
      return null;
    }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Get values from DOM as fallback (for browser automation compatibility)
    const getFieldValue = (fieldName: keyof CustomerFormData, domId: string): string => {
      const stateValue = formData[fieldName];
      if (stateValue && typeof stateValue === 'string' && stateValue.trim()) {
        return stateValue;
      }
      const domElement = document.getElementById(domId) as HTMLInputElement | null;
      return domElement?.value || '';
    };
    
    const fullName = getFieldValue('fullName', 'fullName');
    const fullNameArabic = getFieldValue('fullNameArabic', 'fullNameArabic');
    const fullNameKurdish = getFieldValue('fullNameKurdish', 'fullNameKurdish');
    const mobileNumber = getFieldValue('mobileNumber', 'mobileNumber');
    const secondaryMobile = getFieldValue('secondaryMobile', 'secondaryMobile');
    const password = getFieldValue('password', 'password');
    const email = getFieldValue('email', 'email');
    const district = getFieldValue('district', 'district');
    const address = getFieldValue('address', 'address');
    const customCode = getFieldValue('customCode', 'customCode');
    
    // Validate required fields
    if (!fullName.trim()) {
      toast.error(t("customers.errors.nameRequired") || "Customer name is required");
      return;
    }
    if (!mobileNumber.trim()) {
      toast.error(t("customers.errors.mobileRequired") || "Mobile number is required");
      return;
    }
    if (!password.trim()) {
      toast.error(t("customers.errors.passwordRequired") || "Password is required");
      return;
    }
    
    // Upload documents first if any
    let passportUrl: string | undefined;
    let nationalIdUrl: string | undefined;
    let contractUrl: string | undefined;
    
    if (passportFile) {
      toast.info(t("customers.uploadingPassport"));
      const url = await uploadFileToS3(passportFile, "passport");
      if (url) passportUrl = url;
    }
    
    if (nationalIdFile) {
      toast.info(t("customers.uploadingNationalId"));
      const url = await uploadFileToS3(nationalIdFile, "nationalId");
      if (url) nationalIdUrl = url;
    }
    
    if (contractFile) {
      toast.info(t("customers.uploadingContract"));
      const url = await uploadFileToS3(contractFile, "contract");
      if (url) contractUrl = url;
    }
    
    createMutation.mutate(
      {
      fullName,
      fullNameArabic: fullNameArabic || undefined,
      fullNameKurdish: fullNameKurdish || undefined,
      gender: formData.gender as "male" | "female" | undefined,
      nationality: formData.nationality || undefined,
      businessType: formData.businessType || undefined,
      mobileNumber,
      secondaryMobile: secondaryMobile || undefined,
      password,
      email: email || undefined,
      country: "Iraq",
      city: formData.city || undefined,
      district: district || undefined,
      address: address || undefined,
      codePrefix: formData.codePrefix,
      customCode: formData.useCustomCode ? customCode : undefined,
      serviceTypes: formData.serviceTypes.length
        ? (formData.serviceTypes as ("full_package" | "commission" | "self_order")[])
        : undefined,
      passportUrl,
      nationalIdUrl,
      contractUrl,
    },
    { onSuccess: onCustomerCreateSuccess, onError: onMutationError }
    );
  };

  const handleResetPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    const formDataEl = new FormData(e.currentTarget);
    resetPasswordMutation.mutate(
      {
        id: selectedCustomerId,
        newPassword: formDataEl.get("newPassword") as string,
      },
      { onSuccess: onResetPasswordSuccess, onError: onMutationError }
    );
  };

  const isVip = (customerId: number) => vipCustomers?.some(v => v.customerId === customerId);
  const getVipTier = (customerId: number) => vipCustomers?.find(v => v.customerId === customerId)?.tier;

  return (
    <DashboardLayout>
      <div className="pro-page space-y-6">
        <PageHeader
          icon={Users}
          title={t("customers.title")}
          subtitle={t("customers.subtitle")}
          variant="solid"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setLocation("/settings/customer-options")}
                className="hidden sm:flex"
              >
                <Settings className="h-4 w-4 me-2" />
                {t("common.settings")}
              </Button>
              <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20">
                    <UserPlus className="h-4 w-4 me-2" />
                    {t("customers.addCustomer")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    {t("customers.addCustomer")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("customers.customerCodeAutoGenerated")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="basic">{t("customers.form.basicInfo")}</TabsTrigger>
                      <TabsTrigger value="location">{t("customers.form.location")}</TabsTrigger>
                      <TabsTrigger value="documents">{t("customers.form.documents")}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 mt-4">
                      {/* Code Prefix Selection */}
                      <div className="grid gap-2">
                        <Label>{t("customers.form.codePrefix")}</Label>
                        <Select value={formData.codePrefix} onValueChange={(v) => updateFormData("codePrefix", v)}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={t("customers.form.selectPrefix")} />
                          </SelectTrigger>
                          <SelectContent>
                            {codePrefixes?.map((prefix) => (
                              <SelectItem key={prefix.code} value={prefix.code}>
                                {prefix.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Example: {formData.codePrefix}0001(Name)
                        </p>
                      </div>

                      {/* Custom Code Toggle */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="useCustomCode"
                          checked={formData.useCustomCode}
                          onChange={(e) => updateFormData("useCustomCode", e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-800/60"
                        />
                        <Label htmlFor="useCustomCode" className="cursor-pointer">
                          {t("customers.form.useCustomCode") || "Use manual customer code"}
                        </Label>
                      </div>

                      {/* Custom Code Input */}
                      {formData.useCustomCode && (
                        <div className="grid gap-2">
                          <Label>{t("customers.form.customCode") || "Customer Code"}</Label>
                          <Input
                            value={formData.customCode}
                            onChange={(e) => updateFormData("customCode", e.target.value)}
                            placeholder="AZ0001(Name) or custom format"
                            className="h-11"
                          />
                          <p className="text-xs text-muted-foreground">
                            {t("customers.form.customCodeHint") || "Enter custom code manually (must be unique)"}
                          </p>
                        </div>
                      )}
                      
                      <div className="grid gap-2">
                        <Label htmlFor="fullName">{t("customers.form.fullNameEn")} *</Label>
                        <Input 
                          id="fullName" 
                          defaultValue={formData.fullName}
                          onChange={(e) => updateFormData("fullName", e.target.value)}
                          required 
                          className="h-11" 
                          placeholder={t("customers.form.namePlaceholder")} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="fullNameArabic">{t("customers.form.nameArabic")}</Label>
                          <Input 
                            id="fullNameArabic" 
                            value={formData.fullNameArabic}
                            onChange={(e) => updateFormData("fullNameArabic", e.target.value)}
                            dir="rtl" 
                            className="h-11" 
                            placeholder={t("auto.text_520fcd")} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="fullNameKurdish">{t("customers.form.nameKurdish")}</Label>
                          <Input 
                            id="fullNameKurdish" 
                            value={formData.fullNameKurdish}
                            onChange={(e) => updateFormData("fullNameKurdish", e.target.value)}
                            dir="rtl" 
                            className="h-11" 
                            placeholder={t("customers.form.nameKurdish")} 
                          />
                        </div>
                      </div>
                      
                      {/* Gender and Nationality Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("customers.form.gender")}</Label>
                          <Select value={formData.gender} onValueChange={(v) => updateFormData("gender", v)}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={t("customers.form.selectGender")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-blue-500" />
                                  {t("common.male")}
                                </div>
                              </SelectItem>
                              <SelectItem value="female">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-pink-500" />
                                  {t("common.female")}
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("customers.form.nationality")}</Label>
                          <Select value={formData.nationality} onValueChange={(v) => updateFormData("nationality", v)}>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={t("customers.form.selectNationality")} />
                            </SelectTrigger>
                            <SelectContent>
                              {nationalities.map((nat: any) => (
                                <SelectItem key={nat.id} value={nat.id}>
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-emerald-500" />
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
                        <Select value={formData.businessType} onValueChange={(v) => updateFormData("businessType", v)}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={t("customers.form.selectBusinessType")} />
                          </SelectTrigger>
                          <SelectContent>
                            {businessTypes.map((bt: any) => (
                              <SelectItem key={bt.id} value={bt.id}>
                                <div className="flex items-center gap-2">
                                  <Briefcase className="h-4 w-4 text-amber-500" />
                                  {bt.nameKu} - {bt.nameEn}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Service Types (optional, multi-select) */}
                      <div className="grid gap-2">
                        <Label>{pickLang(language, { ku: "جۆری خزمەت (ئیختیاری)", en: "Service Type (optional)", ar: "نوع الخدمة (اختياري)", zh: "服务类型（可选）" })}</Label>
                        <div className="flex flex-wrap gap-2">
                          {SERVICE_TYPE_OPTIONS.map((option) => {
                            const selected = formData.serviceTypes.includes(option.value);
                            return (
                              <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                onClick={() => toggleServiceType(option.value)}
                                className={selected ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                              >
                                {pickLang(language, option.label)}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="mobileNumber">{t("customers.form.mobileNumber")} *</Label>
                          <Input 
                            id="mobileNumber" 
                            defaultValue={formData.mobileNumber}
                            onChange={(e) => updateFormData("mobileNumber", e.target.value)}
                            type="tel" 
                            required 
                            className="h-11" 
                            placeholder="+964 750 123 4567" 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="secondaryMobile">{t("customers.form.secondaryMobile")}</Label>
                          <Input 
                            id="secondaryMobile" 
                            value={formData.secondaryMobile}
                            onChange={(e) => updateFormData("secondaryMobile", e.target.value)}
                            type="tel" 
                            className="h-11" 
                            placeholder="+964 770 123 4567" 
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="password">{t("customers.form.password")} *</Label>
                          <Input 
                            id="password" 
                            defaultValue={formData.password}
                            onChange={(e) => updateFormData("password", e.target.value)}
                            type="password" 
                            required 
                            minLength={6} 
                            className="h-11" 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="email">{t("customers.form.email")}</Label>
                          <Input 
                            id="email" 
                            value={formData.email}
                            onChange={(e) => updateFormData("email", e.target.value)}
                            type="email" 
                            className="h-11" 
                            placeholder="customer@email.com" 
                          />
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="location" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>{t("customers.form.governorate")}</Label>
                          <Select 
                            value={formData.governorate} 
                            onValueChange={(value) => {
                              updateFormData("governorate", value);
                              updateFormData("city", ""); // Reset city when governorate changes
                            }}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={t("customers.form.selectGovernorate")} />
                            </SelectTrigger>
                            <SelectContent>
                              {IRAQI_GOVERNORATES.map((gov) => (
                                <SelectItem key={gov.id} value={gov.id}>
                                  {gov.nameKu} - {gov.nameEn}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("customers.form.city")} *</Label>
                          <select
                            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.city}
                            onChange={(e) => updateFormData("city", e.target.value)}
                            disabled={!formData.governorate}
                          >
                            <option value="">{formData.governorate ? t("customers.selectCity") : t("customers.selectGovernorateFirst")}</option>
                            {formData.governorate && IRAQI_CITIES.filter(city => city.governorateId === formData.governorate).map((city) => (
                              <option key={`${city.governorateId}-${city.nameEn}`} value={city.nameEn}>
                                {city.nameKu} - {city.nameEn}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="district">{t("customers.form.district")}</Label>
                        <Input 
                          id="district" 
                          value={formData.district}
                          onChange={(e) => updateFormData("district", e.target.value)}
                          className="h-11" 
                          placeholder="e.g., Ankawa, Ainkawa" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="address">{t("customers.form.address")}</Label>
                        <Input 
                          id="address" 
                          value={formData.address}
                          onChange={(e) => updateFormData("address", e.target.value)}
                          className="h-11" 
                          placeholder={t("customers.form.addressPlaceholder")} 
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="documents" className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("customers.form.documentsDescription")}
                      </p>
                      
                      {/* Passport Upload */}
                      <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium">{t("customers.form.passport")}</p>
                              <p className="text-xs text-muted-foreground">
                                {passportFile ? passportFile.name : t("common.noFileSelected")}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <input
                              ref={passportInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => passportInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 me-1" />
                              {t("common.upload")}
                            </Button>
                            {passportFile && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPassportFile(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* National ID Upload */}
                      <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <p className="font-medium">{t("customers.form.nationalId")}</p>
                              <p className="text-xs text-muted-foreground">
                                {nationalIdFile ? nationalIdFile.name : t("common.noFileSelected")}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <input
                              ref={nationalIdInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => setNationalIdFile(e.target.files?.[0] || null)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => nationalIdInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 me-1" />
                              {t("common.upload")}
                            </Button>
                            {nationalIdFile && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setNationalIdFile(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Contract Upload */}
                      <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                              <FileCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <p className="font-medium">{t("customers.form.contract")}</p>
                              <p className="text-xs text-muted-foreground">
                                {contractFile ? contractFile.name : t("common.noFileSelected")}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <input
                              ref={contractInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => contractInputRef.current?.click()}
                            >
                              <Upload className="h-4 w-4 me-1" />
                              {t("common.upload")}
                            </Button>
                            {contractFile && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setContractFile(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                        {t("customers.form.documentsUploadNote")}
                      </p>
                    </TabsContent>
                  </Tabs>
                  
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? t("common.creating") : t("customers.addCustomer")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            </>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("customers.stats.total")}</p>
                  <p className="text-3xl font-bold">{customers.length}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("customers.stats.active")}</p>
                  <p className="text-3xl font-bold text-green-600">{activeCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-lg shadow-green-200 dark:shadow-green-900/30">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("customers.stats.inactive")}</p>
                  <p className="text-3xl font-bold text-slate-500">{inactiveCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white shadow-lg shadow-slate-200 dark:shadow-slate-900/30">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t("customers.stats.vip")}</p>
                  <p className="text-3xl font-bold text-amber-600">{vipCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
                  <Crown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customers Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("customers.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                  >
                    {t("common.all")} ({customers.length})
                  </Button>
                  <Button
                    variant={statusFilter === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("active")}
                    className={statusFilter === "active" ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {t("common.active")} ({activeCount})
                  </Button>
                  <Button
                    variant={statusFilter === "inactive" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("inactive")}
                  >
                    {t("common.inactive")} ({inactiveCount})
                  </Button>
                </div>
              </div>
              
              {/* {t("common.advancedFilters")} */}
              <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-fit">
                    <Filter className="h-4 w-4 me-2" />
                    {t("common.advancedFilters")}
                    <ChevronDown className={`h-4 w-4 ms-2 transition-transform ${isFiltersOpen ? "rotate-180" : ""}`} />
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ms-2 h-5 px-1.5">
                        {[cityFilter, governorateFilter, balanceFilter !== "all", vipFilter !== "all", serviceTypeFilter !== "all"].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="grid gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">{t("customers.form.governorate")}</Label>
                        <Select value={governorateFilter} onValueChange={(v) => {
                          setGovernorateFilter(v);
                          setCityFilter("");
                        }}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t("customers.allGovernorates")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_gov">{t("customers.allGovernorates")}</SelectItem>
                            {IRAQI_GOVERNORATES.map((gov) => (
                              <SelectItem key={gov.id} value={gov.id}>
                                {gov.nameKu} - {gov.nameEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("customers.form.city")}</Label>
                        <Select value={cityFilter} onValueChange={setCityFilter} disabled={!governorateFilter || governorateFilter === "all_gov"}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t("customers.allCities")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all_city">{t("customers.allCities")}</SelectItem>
                            {filterCities.map((city) => (
                              <SelectItem key={`${city.governorateId}-${city.nameEn}`} value={city.nameEn}>
                                {city.nameKu} - {city.nameEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("common.balance")}</Label>
                        <Select value={balanceFilter} onValueChange={(v: any) => setBalanceFilter(v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t("customers.allBalances")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("customers.allBalances")}</SelectItem>
                            <SelectItem value="positive">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                {t("customers.positiveBalance")}
                              </div>
                            </SelectItem>
                            <SelectItem value="negative">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                {t("customers.negativeBalance")}
                              </div>
                            </SelectItem>
                            <SelectItem value="zero">{t("customers.zeroBalance")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t("customers.customerType")}</Label>
                        <Select value={vipFilter} onValueChange={(v: any) => setVipFilter(v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t("customers.allTypes")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("customers.allTypes")}</SelectItem>
                            <SelectItem value="vip">
                              <div className="flex items-center gap-2">
                                <Crown className="h-3 w-3 text-amber-500" />
                                {t("customers.vipOnly")}
                              </div>
                            </SelectItem>
                            <SelectItem value="regular">{t("customers.regularOnly")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{pickLang(language, { ku: "جۆری خزمەت", en: "Service Type", ar: "نوع الخدمة", zh: "服务类型" })}</Label>
                        <Select value={serviceTypeFilter} onValueChange={(v: any) => setServiceTypeFilter(v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={pickLang(language, { ku: "هەموو جۆرەکان", en: "All Types", ar: "جميع الأنواع", zh: "所有类型" })} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{pickLang(language, { ku: "هەموو جۆرەکان", en: "All Types", ar: "جميع الأنواع", zh: "所有类型" })}</SelectItem>
                            {SERVICE_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {pickLang(language, option.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {hasActiveFilters && (
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground">
                          <X className="h-4 w-4 me-1" />
                          {t("common.clearFilters")}
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Active filter chips */}
              <FilterChips
                chips={[
                  ...(search
                    ? [{
                        id: "search",
                        label: `${t("common.search") || pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" })}: ${search}`,
                        onRemove: () => setSearch(""),
                      }]
                    : []),
                  ...(statusFilter !== "all"
                    ? [{
                        id: "status",
                        label: statusFilter === "active" ? t("common.active") : t("common.inactive"),
                        onRemove: () => setStatusFilter("all"),
                      }]
                    : []),
                  ...(governorateFilter && governorateFilter !== "all_gov"
                    ? [{
                        id: "governorate",
                        label: `${t("customers.form.governorate")}: ${
                          IRAQI_GOVERNORATES.find((g) => g.id === governorateFilter)?.nameKu ?? governorateFilter
                        }`,
                        onRemove: () => {
                          setGovernorateFilter("");
                          setCityFilter("");
                        },
                      }]
                    : []),
                  ...(cityFilter && cityFilter !== "all_city"
                    ? [{
                        id: "city",
                        label: `${t("customers.form.city")}: ${cityFilter}`,
                        onRemove: () => setCityFilter(""),
                      }]
                    : []),
                  ...(balanceFilter !== "all"
                    ? [{
                        id: "balance",
                        label:
                          balanceFilter === "positive"
                            ? t("customers.positiveBalance")
                            : balanceFilter === "negative"
                            ? t("customers.negativeBalance")
                            : t("customers.zeroBalance"),
                        onRemove: () => setBalanceFilter("all"),
                      }]
                    : []),
                  ...(vipFilter !== "all"
                    ? [{
                        id: "vip",
                        label: vipFilter === "vip" ? t("customers.vipOnly") : t("customers.regularOnly"),
                        onRemove: () => setVipFilter("all"),
                      }]
                    : []),
                  ...(serviceTypeFilter !== "all"
                    ? [{
                        id: "serviceType",
                        label: `${t("customers.serviceType") || pickLang(language, { ku: "جۆری خزمەت", en: "Service Type", ar: "نوع الخدمة", zh: "服务类型" })}: ${getServiceTypeLabel(language, serviceTypeFilter)}`,
                        onRemove: () => setServiceTypeFilter("all"),
                      }]
                    : []),
                ]}
                onClearAll={clearAllFilters}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{t("customers.title")}</TableHead>
                  <TableHead>{t("common.contact")}</TableHead>
                  <TableHead>{t("customers.form.location")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={customer.fullName ?? ""} size={40} className="ring-2 ring-primary/10" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{customer.fullName}</p>
                            {isVip(customer.id) && (
                              <Badge className={`text-[10px] px-1.5 py-0 border-0 ${
                                getVipTier(customer.id) === 'platinum' ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white' :
                                getVipTier(customer.id) === 'gold' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' :
                                'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700 dark:text-slate-300'
                              }`}>
                                <Crown className="h-2.5 w-2.5 me-0.5" />
                                {getVipTier(customer.id)?.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{customer.customerCode}</p>
                          {(customer as any).createdAt && (
                            <p className="text-[10px] text-muted-foreground">
                              {t("customers.joined") || pickLang(language, { ku: "بەشداربوو", en: "Joined", ar: "انضم", zh: "加入于" })}{" "}
                              <RelativeTime date={(customer as any).createdAt} />
                            </p>
                          )}
                          {Array.isArray((customer as any).serviceTypes) && (customer as any).serviceTypes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(customer as any).serviceTypes.map((st: string) => (
                                <Badge key={st} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {getServiceTypeLabel(language, st)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {customer.mobileNumber}
                        </div>
                        {(customer as any).email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {(customer as any).email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.city ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {customer.city}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={customer.isActive ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setLocation(`/customers/${customer.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedCustomerId(customer.id);
                            setIsResetOpen(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => {
                              setDeleteCustomerId(customer.id);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground">{t("customers.noCustomersFound")}</p>
                      {hasActiveFilters && (
                        <Button variant="link" onClick={clearAllFilters} className="mt-2">
                          {t("common.clearFilters")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Reset Password Dialog */}
        <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-amber-500" />
                {t("customers.resetPassword")}
              </DialogTitle>
              <DialogDescription>
                {t("customers.resetPasswordDescription")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">{t("customers.newPassword")}</Label>
                  {/* Pre-filled with the office default and shown rather than
                      masked: this is read down the phone to a customer who is
                      already stuck, and a reset nobody can read back is a
                      second phone call. */}
                  <Input id="newPassword" name="newPassword" defaultValue={DEFAULT_RESET_PASSWORD} type="text" required minLength={6} className="h-11" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={resetPasswordMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
                  {resetPasswordMutation.isPending ? t("common.processing") : t("customers.resetPassword")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* Delete Customer Confirmation Dialog (Super Admin Only) */}
        {isSuperAdmin && (
          <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  {pickLang(language, { ku: "سڕینەوەی کڕیار", en: "Delete Customer", ar: "حذف العميل", zh: "删除客户" })}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-right space-y-2">
                  <p className="font-semibold text-red-500">
                    {pickLang(language, { ku: "ئایا دڵنیایت لە سڕینەوەی ئەم کڕیارە؟", en: "Are you sure you want to delete this customer?", ar: "هل أنت متأكد من حذف هذا العميل؟", zh: "确定要删除此客户吗？" })}
                  </p>
                  <p>
                    {pickLang(language, { ku: "ئەم کارە ناگەڕێتەوە. هەموو داتای پەیوەندیدار (وەسڵ، پارەدانەکان، خزمەتگوزاریەکان، مامەڵەکان) دەسڕێنەوە.", en: "This action cannot be undone. All related data (invoices, payments, services, transactions) will be deleted.", ar: "لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع البيانات المرتبطة (الفواتير، المدفوعات، الخدمات، المعاملات).", zh: "此操作无法撤销。所有相关数据（发票、付款、服务、交易）都将被删除。" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pickLang(language, { ku: "تێبینی: پاکەتەکان ناسڕێنەوە بەڵام ناوی کڕیار لەسەریان لادەبردرێت.", en: "Note: Packages will not be deleted but the customer name will be removed from them.", ar: "ملاحظة: لن يتم حذف الطرود ولكن سيتم إزالة اسم العميل منها.", zh: "注意：包裹不会被删除，但会从中移除客户姓名。" })}
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>
                  {pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteCustomerMutation.isPending}
                  onClick={() => {
                    if (deleteCustomerId) {
                      deleteCustomerMutation.mutate({ id: deleteCustomerId });
                    }
                  }}
                >
                  {deleteCustomerMutation.isPending
                    ? pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." })
                    : pickLang(language, { ku: "بەڵێ، بسڕەوە", en: "Yes, delete", ar: "نعم، احذف", zh: "是的，删除" })}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </DashboardLayout>
  );
}
