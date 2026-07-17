import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, DollarSign, Package, User, Percent, ImageIcon, Check, ChevronsUpDown, ChevronUp, ChevronDown, Banknote, ArrowLeftRight, Save, Loader2, Link as LinkIcon, TrendingUp, Plane, Ship, Zap, Ruler, Scale, Calculator, Wallet, ScanBarcode } from "lucide-react";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import { StickyFormBar } from "@/components/forms/sticky-form-bar";
import { useTranslation } from "@/contexts/LanguageContext";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { toast } from "sonner";

// Lightweight section wrapper — small bold title + thin divider. Defined at
// MODULE level (not inside the component): a component declared inside another
// remounts on every render, which would blur inputs after each keystroke.
const accentText: Record<string, string> = {
  amber: "text-amber-600",
  sky: "text-sky-600",
  teal: "text-teal-600",
  slate: "text-slate-600",
};
// Step a numeric-string field up/down with a mouse click, clamped at min and
// rounded to `decimals` so float noise (0.1+0.2…) never lands in the input.
const stepValue = (raw: string, delta: number, decimals = 2, min = 0) => {
  const next = Math.max(min, (parseFloat(raw) || 0) + delta);
  return String(Number(next.toFixed(decimals)));
};

// Mouse-friendly ▲/▼ stepper rendered inside a numeric input's relative
// wrapper. The wrapper must be dir="ltr" (numbers are LTR) so `side` maps to a
// deterministic edge: put it on whichever side the ¥/$/kg suffix doesn't use.
const StepBtns = ({ onStep, side }: { onStep: (dir: 1 | -1) => void; side: "start" | "end" }) => (
  <div className={cn("absolute top-1/2 -translate-y-1/2 flex flex-col gap-[2px]", side === "end" ? "end-1" : "start-1")}>
    <button
      type="button"
      tabIndex={-1}
      aria-label="+"
      onClick={() => onStep(1)}
      className="flex h-[17px] w-6 items-center justify-center rounded border bg-muted/60 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
    >
      <ChevronUp className="h-3 w-3" />
    </button>
    <button
      type="button"
      tabIndex={-1}
      aria-label="−"
      onClick={() => onStep(-1)}
      className="flex h-[17px] w-6 items-center justify-center rounded border bg-muted/60 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
    >
      <ChevronDown className="h-3 w-3" />
    </button>
  </div>
);

const Section = ({ icon: Icon, title, hint, accent = "amber", children }: { icon: any; title: string; hint?: string; accent?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border bg-card p-3 sm:p-4">
    <div className="flex items-center gap-2 pb-2 mb-3 border-b">
      <Icon className={cn("h-4 w-4", accentText[accent] || accentText.amber)} />
      <h2 className="text-sm font-bold leading-none">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground ms-auto truncate">{hint}</span>}
    </div>
    {children}
  </section>
);

export default function CommissionForm() {
  const [, setLocation] = useLocation();
  const { t, language } = useTranslation();
  const utils = trpc.useUtils();

  // Customer search state
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  // Image state
  const [productImages, setProductImages] = useState<string[]>([]);

  // ¥ converter state
  const [rmbPerUnit, setIqdPerUnit] = useState("");
  const [rmbTotal, setIqdTotal] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    supplierId: "",
    orderNumber: "",
    trackingNumber: "",
    productLink: "",
    productDescription: "",
    quantity: "1",
    color: "",
    size: "",
    productType: "",
    // Commission pricing
    itemPriceUsd: "",
    commissionFeeUsd: "",
    // Advance payment (partial/full prepayment at order creation)
    advancePaidUsd: "",
    advancePaymentMethod: "CASH" as "CASH" | "BANK_TRANSFER" | "FIB" | "FASTPAY" | "ZAINCASH" | "ASIAHAWALA" | "CARD" | "OTHER",
    notes: "",
    // Shipping
    shippingType: "" as "" | "air_regular" | "air_irregular" | "sea",
    weightKg: "",
    dimensionLength: "",
    dimensionWidth: "",
    dimensionHeight: "",
    volumeCbm: "",
  });

  // "Filled" indicator — subtle green border + ring + tint when a field has a value
  const filledCls = (v: unknown) => (v !== undefined && v !== null && String(v).trim() !== "" ? "border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/40" : "");

  // ¥ exchange rate
  const { data: rmbRateData } = trpc.exchangeRates.getCurrent.useQuery({ currency: "RMB" });
  const rmbRate = parseFloat(rmbRateData?.rate?.toString() || "0");

  // Fetch customers and suppliers
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: colorAttrs } = trpc.productAttributes.list.useQuery({ type: "color" });
  const { data: sizeAttrs } = trpc.productAttributes.list.useQuery({ type: "size" });
  const { data: typeAttrs } = trpc.productAttributes.list.useQuery({ type: "productType" });

  // Filter customers based on search
  const filteredCustomers = customers?.filter((customer) => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    const name = (customer.fullName || customer.fullNameKurdish || "").toLowerCase();
    const code = (customer.customerCode || "").toLowerCase();
    const phone = (customer.mobileNumber || "").toLowerCase();
    return name.includes(search) || code.includes(search) || phone.includes(search);
  }) || [];

  // Get selected customer name
  const selectedCustomer = customers?.find((c) => c.id.toString() === formData.customerId);

  // Default to the last-used customer once, after customers load (never overwrite a manual choice)
  const didApplyLastCustomer = useRef(false);
  useEffect(() => {
    if (didApplyLastCustomer.current) return;
    if (!customers || customers.length === 0) return;
    if (formData.customerId) {
      didApplyLastCustomer.current = true;
      return;
    }
    const lastId = localStorage.getItem("wazn-last-commission-customer");
    if (!lastId) return;
    const match = customers.find((c) => c.id.toString() === lastId);
    if (match) {
      didApplyLastCustomer.current = true;
      setFormData((prev) => ({ ...prev, customerId: lastId }));
      setCustomerSearch(match.customerCode || match.fullName || "");
    }
  }, [customers, formData.customerId]);

  // Create mutation
  const createMutation = trpc.fullPackage.create.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "ئۆردەری کڕین بە تێچوو بە سەرکەوتوویی داخڵ کرا — خانەکان بۆ ئۆردەری دواتر ئامادەن", en: "Commission purchase order created successfully — fields are ready for the next order", ar: "تم إنشاء طلب الشراء بالعمولة بنجاح — الحقول جاهزة للطلب التالي", zh: "代购订单创建成功 — 字段已为下一个订单准备就绪" }));
      utils.fullPackage.list.invalidate();
      const keepCustomerId = formData.customerId;
      if (keepCustomerId) {
        localStorage.setItem("wazn-last-commission-customer", keepCustomerId);
      }
      // Keep the form open for rapid multi-order entry: reset every field for
      // the next order but KEEP the selected customer, so staff can enter all
      // of one customer's orders back-to-back without re-picking them. Exit is
      // a manual choice (the back button) — we intentionally don't navigate.
      setFormData({
        customerId: keepCustomerId,
        supplierId: "",
        orderNumber: "",
        trackingNumber: "",
        productLink: "",
        productDescription: "",
        quantity: "1",
        color: "",
        size: "",
        productType: "",
        itemPriceUsd: "",
        commissionFeeUsd: "",
        advancePaidUsd: "",
        advancePaymentMethod: "CASH",
        notes: "",
        shippingType: "",
        weightKg: "",
        dimensionLength: "",
        dimensionWidth: "",
        dimensionHeight: "",
        volumeCbm: "",
      });
      setProductImages([]);
      setIqdPerUnit("");
      setIqdTotal("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 3-way sync: rmbPerUnit ↔ rmbTotal ↔ itemPriceUsd
  const qty = parseInt(formData.quantity) || 1;

  const syncFromPerUnit = (perUnit: string, q = qty) => {
    const v = parseFloat(perUnit) || 0;
    setIqdPerUnit(perUnit);
    setIqdTotal(v > 0 ? (v * q).toFixed(2) : "");
    setFormData(prev => ({ ...prev, itemPriceUsd: v > 0 && rmbRate > 0 ? (v / rmbRate).toFixed(4) : "" }));
  };

  const syncFromTotal = (total: string, q = qty) => {
    const v = parseFloat(total) || 0;
    setIqdTotal(total);
    setIqdPerUnit(v > 0 && q > 0 ? (v / q).toFixed(2) : "");
    setFormData(prev => ({ ...prev, itemPriceUsd: v > 0 && q > 0 && rmbRate > 0 ? (v / q / rmbRate).toFixed(4) : "" }));
  };

  const syncFromUsd = (usd: string, q = qty) => {
    setFormData(prev => ({ ...prev, itemPriceUsd: usd }));
    const v = parseFloat(usd) || 0;
    if (v > 0 && rmbRate > 0) {
      const perUnit = v * rmbRate;
      setIqdPerUnit(perUnit.toFixed(2));
      setIqdTotal((perUnit * q).toFixed(2));
    } else {
      setIqdPerUnit(""); setIqdTotal("");
    }
  };

  const handleQuantityChange = (val: string) => {
    const q = parseInt(val) || 1;
    if (rmbPerUnit) {
      syncFromPerUnit(rmbPerUnit, q);
      setFormData(prev => ({ ...prev, quantity: val }));
    } else if (rmbTotal) {
      syncFromTotal(rmbTotal, q);
      setFormData(prev => ({ ...prev, quantity: val }));
    } else {
      setFormData(prev => ({ ...prev, quantity: val }));
    }
  };

  // Shipping calculations
  const actualKg = parseFloat(formData.weightKg) || 0;
  const dimL = parseFloat(formData.dimensionLength) || 0;
  const dimW = parseFloat(formData.dimensionWidth) || 0;
  const dimH = parseFloat(formData.dimensionHeight) || 0;
  const volumetricKg = dimL && dimW && dimH ? (dimL * dimW * dimH) / 6000 : 0;
  const chargeableKg = Math.max(actualKg, volumetricKg);
  const autoCbm = dimL && dimW && dimH ? (dimL * dimW * dimH) / 1_000_000 : 0;

  // Calculate totals
  const itemPrice = parseFloat(formData.itemPriceUsd) || 0;
  const commissionFee = parseFloat(formData.commissionFeeUsd) || 0;
  const quantity = parseInt(formData.quantity) || 1;
  const totalPrepaid = (itemPrice + commissionFee) * quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      toast.error(pickLang(language, { ku: "تکایە کڕیارێک هەڵبژێرە", en: "Please select a customer", ar: "يرجى اختيار عميل", zh: "请选择客户" }));
      return;
    }

    if (!formData.productType) {
      toast.error(pickLang(language, { ku: "تکایە جۆری کاڵا هەڵبژێرە", en: "Please select a product type", ar: "يرجى اختيار نوع المنتج", zh: "请选择商品类型" }));
      return;
    }

    if (!formData.itemPriceUsd || itemPrice <= 0) {
      toast.error(pickLang(language, { ku: "تکایە نرخی کاڵا داخڵ بکە", en: "Please enter the item price", ar: "يرجى إدخال سعر المنتج", zh: "请输入商品价格" }));
      return;
    }

    if (!formData.commissionFeeUsd || commissionFee <= 0) {
      toast.error(pickLang(language, { ku: "تکایە عمولەی کڕین داخڵ بکە", en: "Please enter the purchase commission", ar: "يرجى إدخال عمولة الشراء", zh: "请输入采购佣金" }));
      return;
    }

    if (!formData.shippingType) {
      toast.error(pickLang(language, { ku: "تکایە شێوازی گواستنەوە دیاری بکە", en: "Please choose a shipping method", ar: "يرجى تحديد طريقة الشحن", zh: "请选择运输方式" }));
      return;
    }

    createMutation.mutate({
      customerId: parseInt(formData.customerId),
      supplierId: formData.supplierId && formData.supplierId !== "none" ? parseInt(formData.supplierId) : undefined,

      orderType: "commission",
      productName: formData.productType,
      productLink: formData.productLink || undefined,
      productImage: productImages[0] || undefined,
      productImages: productImages.length > 0 ? productImages : undefined,
      orderNumber: formData.orderNumber || undefined,
      trackingNumber: formData.trackingNumber.trim() || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: quantity,
      color: formData.color || undefined,
      size: formData.size || undefined,
      productType: formData.productType || undefined,
      itemPriceUsd: formData.itemPriceUsd,
      commissionFeeUsd: formData.commissionFeeUsd,
      totalPrepaidUsd: totalPrepaid.toFixed(2),
      advancePaidUsd: formData.advancePaidUsd || undefined,
      advancePaymentMethod: formData.advancePaidUsd && parseFloat(formData.advancePaidUsd) > 0 ? formData.advancePaymentMethod : undefined,
      notes: formData.notes || undefined,
      shippingType: formData.shippingType || undefined,
      weightKg: formData.weightKg || undefined,
      dimensionLength: formData.dimensionLength || undefined,
      dimensionWidth: formData.dimensionWidth || undefined,
      dimensionHeight: formData.dimensionHeight || undefined,
      volumeCbm: formData.volumeCbm || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/commission")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Percent className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{pickLang(language, { ku: "ئۆردەری کڕین بە تێچووی نوێ", en: "New commission purchase order", ar: "طلب شراء بالعمولة جديد", zh: "新建代购订单" })}</h1>
              <p className="text-sm text-muted-foreground">{pickLang(language, { ku: "کڕیار نرخ دەزانێت، کۆمپانیا تەنها عمولە وەردەگرێت", en: "The customer knows the price; the company only takes a commission", ar: "العميل يعرف السعر، والشركة تأخذ العمولة فقط", zh: "客户知道价格，公司仅收取佣金" })}</p>
            </div>
          </div>
        </div>

        <form data-fast onSubmit={handleSubmit} className="space-y-3">
          {/* Customer Selection */}
          <Section icon={User} title={pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })} hint={pickLang(language, { ku: "کڕیارێک هەڵبژێرە بۆ ئەم ئۆردەرە", en: "Select a customer for this order", ar: "اختر عميلاً لهذا الطلب", zh: "为此订单选择客户" })} accent="amber">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{pickLang(language, { ku: "کڕیار *", en: "Customer *", ar: "العميل *", zh: "客户 *" })}</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className={cn("w-full justify-between h-10", filledCls(formData.customerId))}
                    >
                      {selectedCustomer
                        ? `${selectedCustomer.fullName || selectedCustomer.fullNameKurdish} (${selectedCustomer.customerCode})`
                        : pickLang(language, { ku: "کڕیارێک هەڵبژێرە...", en: "Select a customer...", ar: "اختر عميلاً...", zh: "选择客户..." })}
                      <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                    <Command>
                      <CommandInput
                        placeholder={pickLang(language, { ku: "گەڕان بە ناو، کۆد یان مۆبایل...", en: "Search by name, code, or mobile...", ar: "البحث بالاسم أو الرمز أو الجوال...", zh: "按姓名、编号或手机搜索..." })}
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>{pickLang(language, { ku: "کڕیار نەدۆزرایەوە", en: "No customer found", ar: "لم يُعثر على عميل", zh: "未找到客户" })}</CommandEmpty>
                        <CommandGroup>
                          {filteredCustomers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.fullName || customer.fullNameKurdish} ${customer.customerCode}`}
                              onSelect={() => {
                                setFormData({ ...formData, customerId: customer.id.toString() });
                                setCustomerOpen(false);
                                setCustomerSearch("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "me-2 h-4 w-4",
                                  formData.customerId === customer.id.toString()
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{customer.fullName || customer.fullNameKurdish}</span>
                                <span className="text-xs text-muted-foreground">{customer.customerCode}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{pickLang(language, { ku: "فرۆشیار", en: "Supplier", ar: "المورّد", zh: "供应商" })}</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                >
                  <SelectTrigger className={cn("h-10", filledCls(formData.supplierId && formData.supplierId !== "none" ? formData.supplierId : ""))}>
                    <SelectValue placeholder={pickLang(language, { ku: "فرۆشیارێک هەڵبژێرە (ئارەزوومەندانە)", en: "Select a supplier (optional)", ar: "اختر مورّداً (اختياري)", zh: "选择供应商（可选）" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{pickLang(language, { ku: "بێ فرۆشیار", en: "No supplier", ar: "بدون مورّد", zh: "无供应商" })}</SelectItem>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id.toString()}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* ── Shipping Method (moved to top) ── */}
          <Section icon={Plane} title={pickLang(language, { ku: "ریگاکانی گواستنەوە", en: "Shipping methods", ar: "طرق الشحن", zh: "运输方式" })} hint={pickLang(language, { ku: "ریگای گواستنەوەی کاڵاکە هەڵبژێرە", en: "Choose the shipping method for the item", ar: "اختر طريقة شحن المنتج", zh: "选择商品的运输方式" })} accent="sky">
            {/* Method Selector — compact horizontal pills */}
            <div className="grid grid-cols-3 gap-3">
              {/* Air Regular */}
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, shippingType: p.shippingType === "air_regular" ? "" : "air_regular", volumeCbm: "" }))}
                className={`relative flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${
                  formData.shippingType === "air_regular"
                    ? "border-sky-400 bg-sky-50 shadow-sm shadow-sky-100"
                    : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
                }`}
              >
                {formData.shippingType === "air_regular" && (
                  <span className="absolute top-1.5 end-1.5 w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                <div className={`p-1.5 rounded-lg shrink-0 ${formData.shippingType === "air_regular" ? "bg-sky-500" : "bg-gray-100"}`}>
                  <Plane className={`h-4 w-4 ${formData.shippingType === "air_regular" ? "text-white" : "text-gray-500"}`} />
                </div>
                <div className="text-start min-w-0">
                  <p className={`font-bold text-sm leading-tight truncate ${formData.shippingType === "air_regular" ? "text-sky-700" : "text-gray-700"}`}>{pickLang(language, { ku: "ئاسمانی ئاسایی", en: "Air Regular", ar: "جوي عادي", zh: "普通空运" })}</p>
                  <p className="text-[10px] text-muted-foreground">Air Regular</p>
                </div>
              </button>

              {/* Air Irregular */}
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, shippingType: p.shippingType === "air_irregular" ? "" : "air_irregular", volumeCbm: "" }))}
                className={`relative flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${
                  formData.shippingType === "air_irregular"
                    ? "border-amber-400 bg-amber-50 shadow-sm shadow-amber-100"
                    : "border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                }`}
              >
                {formData.shippingType === "air_irregular" && (
                  <span className="absolute top-1.5 end-1.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                <div className={`p-1.5 rounded-lg relative shrink-0 ${formData.shippingType === "air_irregular" ? "bg-amber-500" : "bg-gray-100"}`}>
                  <Plane className={`h-4 w-4 ${formData.shippingType === "air_irregular" ? "text-white" : "text-gray-500"}`} />
                  <Zap className={`h-2.5 w-2.5 absolute -bottom-0.5 -end-0.5 ${formData.shippingType === "air_irregular" ? "text-yellow-200" : "text-amber-400"}`} />
                </div>
                <div className="text-start min-w-0">
                  <p className={`font-bold text-sm leading-tight truncate ${formData.shippingType === "air_irregular" ? "text-amber-700" : "text-gray-700"}`}>{pickLang(language, { ku: "ئاسمانی مەرسیدار", en: "Air Irregular", ar: "جوي غير منتظم", zh: "特殊空运" })}</p>
                  <p className="text-[10px] text-muted-foreground">Air Irregular</p>
                </div>
              </button>

              {/* Sea */}
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, shippingType: p.shippingType === "sea" ? "" : "sea", weightKg: "", dimensionLength: "", dimensionWidth: "", dimensionHeight: "" }))}
                className={`relative flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all duration-200 ${
                  formData.shippingType === "sea"
                    ? "border-teal-400 bg-teal-50 shadow-sm shadow-teal-100"
                    : "border-gray-200 bg-white hover:border-teal-200 hover:bg-teal-50/40"
                }`}
              >
                {formData.shippingType === "sea" && (
                  <span className="absolute top-1.5 end-1.5 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                <div className={`p-1.5 rounded-lg shrink-0 ${formData.shippingType === "sea" ? "bg-teal-500" : "bg-gray-100"}`}>
                  <Ship className={`h-4 w-4 ${formData.shippingType === "sea" ? "text-white" : "text-gray-500"}`} />
                </div>
                <div className="text-start min-w-0">
                  <p className={`font-bold text-sm leading-tight truncate ${formData.shippingType === "sea" ? "text-teal-700" : "text-gray-700"}`}>{pickLang(language, { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" })}</p>
                  <p className="text-[10px] text-muted-foreground">Sea Freight</p>
                </div>
              </button>
            </div>
          </Section>

          {/* Product Info — compact multi-column grid */}
          <Section icon={Package} title={pickLang(language, { ku: "زانیاری کاڵا", en: "Product info", ar: "معلومات المنتج", zh: "商品信息" })} hint={pickLang(language, { ku: "زانیاری کاڵاکە داخڵ بکە", en: "Enter the product details", ar: "أدخل تفاصيل المنتج", zh: "输入商品详情" })} accent="amber">
            <div className="space-y-3">
              {/* Row 1: type / order# / tracking / link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{pickLang(language, { ku: "جۆری کاڵا *", en: "Product type *", ar: "نوع المنتج *", zh: "商品类型 *" })}</Label>
                  <Select
                    value={formData.productType}
                    onValueChange={(v) => setFormData({ ...formData, productType: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className={cn("h-10", filledCls(formData.productType))}>
                      <SelectValue placeholder={pickLang(language, { ku: "جۆر هەڵبژێرە", en: "Select type", ar: "اختر النوع", zh: "选择类型" })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{pickLang(language, { ku: "— بێ جۆر —", en: "— No type —", ar: "— بدون نوع —", zh: "— 无类型 —" })}</SelectItem>
                      {typeAttrs?.map(a => (
                        <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order number", ar: "رقم الطلب", zh: "订单编号" })}</Label>
                  <Input
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    placeholder={pickLang(language, { ku: "ژمارەی ئۆردەر", en: "Order number", ar: "رقم الطلب", zh: "订单编号" })}
                    className={cn("h-10", filledCls(formData.orderNumber))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <ScanBarcode className="h-3.5 w-3.5" />
                    {pickLang(language, { ku: "تراکینگ نەمبەر", en: "Tracking number", ar: "رقم التتبع", zh: "运单号" })} <span className="text-muted-foreground font-normal">{pickLang(language, { ku: "(ئیختیاری)", en: "(optional)", ar: "(اختياري)", zh: "（可选）" })}</span>
                  </Label>
                  <Input
                    value={formData.trackingNumber}
                    onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                    placeholder={pickLang(language, { ku: "ئەگەر ئێستا بەردەستە، داخڵی بکە", en: "Enter it if available now", ar: "أدخله إن كان متاحاً الآن", zh: "如已有请输入" })}
                    className={cn("h-10", filledCls(formData.trackingNumber))}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5" />
                    {pickLang(language, { ku: "لینکی کاڵا", en: "Product link", ar: "رابط المنتج", zh: "商品链接" })}
                  </Label>
                  <Input
                    value={formData.productLink}
                    onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                    placeholder="https://..."
                    className={cn("h-10", filledCls(formData.productLink))}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Row 2: color / size / image */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{pickLang(language, { ku: "ڕەنگ", en: "Color", ar: "اللون", zh: "颜色" })}</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(v) => setFormData({ ...formData, color: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className={cn("h-10", filledCls(formData.color))}>
                      <SelectValue placeholder={pickLang(language, { ku: "ڕەنگ هەڵبژێرە", en: "Select color", ar: "اختر اللون", zh: "选择颜色" })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{pickLang(language, { ku: "— بێ ڕەنگ —", en: "— No color —", ar: "— بدون لون —", zh: "— 无颜色 —" })}</SelectItem>
                      {colorAttrs?.map(a => (
                        <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{pickLang(language, { ku: "قەبارە", en: "Size", ar: "المقاس", zh: "尺寸" })}</Label>
                  <Select
                    value={formData.size}
                    onValueChange={(v) => setFormData({ ...formData, size: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className={cn("h-10", filledCls(formData.size))}>
                      <SelectValue placeholder={pickLang(language, { ku: "قەبارە هەڵبژێرە", en: "Select size", ar: "اختر المقاس", zh: "选择尺寸" })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{pickLang(language, { ku: "— بێ قەبارە —", en: "— No size —", ar: "— بدون مقاس —", zh: "— 无尺寸 —" })}</SelectItem>
                      {sizeAttrs?.map(a => (
                        <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {pickLang(language, { ku: "وێنەی کاڵا", en: "Product image", ar: "صورة المنتج", zh: "商品图片" })}
                  </Label>
                  <CompressedImageUpload
                    images={productImages}
                    onChange={setProductImages}
                    maxImages={5}
                    accentColor="amber"
                    compact
                  />
                </div>
              </div>

              {/* Row 3: description full width */}
              <div className="space-y-1.5">
                <Label className="text-xs">{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</Label>
                <Textarea
                  value={formData.productDescription}
                  onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                  placeholder={pickLang(language, { ku: "وەسفی کاڵا...", en: "Product description...", ar: "وصف المنتج...", zh: "商品描述..." })}
                  rows={2}
                  className={cn(filledCls(formData.productDescription))}
                />
              </div>
            </div>
          </Section>

          {/* Pricing & Quantity */}
          <Section icon={DollarSign} title={pickLang(language, { ku: "نرخەکان و عەدەد", en: "Pricing and quantity", ar: "الأسعار والكمية", zh: "价格和数量" })} hint={pickLang(language, { ku: "نرخی کاڵا، عمولەی کۆمپانیا و ژمارە", en: "Item price, company commission, and quantity", ar: "سعر المنتج وعمولة الشركة والكمية", zh: "商品价格、公司佣金和数量" })} accent="amber">
            <div className="space-y-3">

              {/* ¥ Converter Section — quantity inline + per-unit ¥ + total ¥ */}
              <div className={`rounded-xl border overflow-hidden ${rmbRate > 0 ? "border-orange-200" : "border-dashed border-gray-300"}`}>
                {/* Header — live rate hint */}
                <div className="bg-orange-50 px-3 py-2 flex items-center justify-between gap-2 border-b border-orange-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-orange-500 rounded-lg shrink-0">
                      <Banknote className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-orange-900 text-sm">{pickLang(language, { ku: "نرخی کاڵا بە یوانی چینی", en: "Item price in Chinese yuan", ar: "سعر المنتج باليوان الصيني", zh: "商品价格（人民币）" })}</p>
                      {rmbRate > 0 ? (
                        <p className="text-xs text-orange-700 truncate">
                          {pickLang(language, { ku: `نرخی بەراورد: ١ دۆلار = ${rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} یوانی چینی`, en: `Exchange rate: 1 USD = ${rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} CNY`, ar: `سعر الصرف: 1 دولار = ${rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} يوان صيني`, zh: `汇率：1 美元 = ${rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} 人民币` })}
                        </p>
                      ) : (
                        <p className="text-xs text-red-600">{pickLang(language, { ku: "تکایە نرخی بەراورد لە سیتینگی سیستەم داخڵ بکە", en: "Please set the exchange rate in system settings", ar: "يرجى إدخال سعر الصرف في إعدادات النظام", zh: "请在系统设置中设置汇率" })}</p>
                      )}
                    </div>
                  </div>
                  {rmbRate > 0 && (
                    <div className="flex items-center gap-1 bg-orange-100 border border-orange-300 rounded-lg px-2 py-1 text-xs font-mono text-orange-800 shrink-0">
                      <ArrowLeftRight className="h-3 w-3" />
                      ${(1 / rmbRate).toFixed(5)} = ١ ¥
                    </div>
                  )}
                </div>

                {/* 1. Quantity (compact inline) + 2. per-unit ¥ + 3. total ¥ */}
                <div className="bg-white px-3 py-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr] gap-3 items-end">
                    {/* 1. Quantity — compact stepper */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">{pickLang(language, { ku: "عەدەد *", en: "Quantity *", ar: "الكمية *", zh: "数量 *" })}</Label>
                      <div className="flex items-center gap-1 w-[10rem]">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-8 shrink-0 rounded-md"
                          onClick={() => handleQuantityChange(Math.max(1, parseInt(formData.quantity) - 1).toString())}
                        >
                          −
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) => handleQuantityChange(e.target.value)}
                          className={cn("text-center text-base font-bold h-10 px-1", filledCls(formData.quantity))}
                          dir="ltr"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-8 shrink-0 rounded-md"
                          onClick={() => handleQuantityChange((parseInt(formData.quantity) + 1).toString())}
                        >
                          ＋
                        </Button>
                      </div>
                    </div>

                    {/* 2. Per-unit ¥ */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-amber-700">{pickLang(language, { ku: "نرخی ١ دانە بە یوانی چینی", en: "Price per unit in Chinese yuan", ar: "سعر الوحدة باليوان الصيني", zh: "单件价格（人民币）" })}</Label>
                      <div className="relative" dir="ltr">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rmbPerUnit}
                          onChange={(e) => syncFromPerUnit(e.target.value)}
                          placeholder="٠"
                          className={cn("ps-9 pe-9 h-10 text-base font-bold border-amber-200 focus:border-orange-400 bg-amber-50/40", filledCls(rmbPerUnit))}
                          dir="ltr"
                        />
                        <StepBtns side="start" onStep={(d) => syncFromPerUnit(stepValue(rmbPerUnit, d))} />
                      </div>
                    </div>

                    {/* 3. Total ¥ */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-orange-700">{pickLang(language, { ku: `کۆی نرخ بە یوانی چینی (${quantity} دانە)`, en: `Total price in Chinese yuan (${quantity} units)`, ar: `إجمالي السعر باليوان الصيني (${quantity} قطعة)`, zh: `总价（人民币）（${quantity} 件）` })}</Label>
                      <div className="relative" dir="ltr">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rmbTotal}
                          onChange={(e) => syncFromTotal(e.target.value)}
                          placeholder="٠"
                          className={cn("ps-9 pe-9 h-10 text-base font-bold border-orange-200 focus:border-orange-400 bg-orange-50/40", filledCls(rmbTotal))}
                          dir="ltr"
                        />
                        <StepBtns side="start" onStep={(d) => syncFromTotal(stepValue(rmbTotal, d))} />
                      </div>
                    </div>
                  </div>

                  {/* Result */}
                  {(parseFloat(rmbPerUnit) > 0 || parseFloat(rmbTotal) > 0) && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-0.5">{pickLang(language, { ku: "١ دانە یوانی چینی", en: "1 unit CNY", ar: "وحدة واحدة يوان", zh: "单件人民币" })}</p>
                        <p className="font-bold text-amber-700 font-mono text-sm">{Number(rmbPerUnit || 0).toLocaleString("en-US")} ¥</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
                        <p className="text-[10px] text-orange-500 uppercase tracking-wide mb-0.5">{pickLang(language, { ku: `کۆی ${quantity} دانە`, en: `Total ${quantity} units`, ar: `إجمالي ${quantity} قطعة`, zh: `共 ${quantity} 件` })}</p>
                        <p className="font-bold text-orange-700 font-mono text-sm">{Number(rmbTotal || 0).toLocaleString("en-US")} ¥</p>
                      </div>
                      <div className="bg-gradient-to-b from-amber-500 to-orange-500 rounded-lg p-2 text-center shadow-sm">
                        <p className="text-[10px] text-amber-100 uppercase tracking-wide mb-0.5">{pickLang(language, { ku: "نرخی $ یەک دانە", en: "Unit price $", ar: "سعر الوحدة $", zh: "单件价格 $" })}</p>
                        <p className="font-bold text-white font-mono text-sm">${formData.itemPriceUsd || "0.0000"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Commission Fee + 5. Item Price ($) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-purple-700">{pickLang(language, { ku: "عموڵەی کڕین *", en: "Purchase commission *", ar: "عمولة الشراء *", zh: "采购佣金 *" })}</Label>
                  <div className="relative" dir="ltr">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-purple-600 font-bold">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.commissionFeeUsd}
                      onChange={(e) => setFormData({ ...formData, commissionFeeUsd: e.target.value })}
                      placeholder="0.00"
                      className={cn("ps-8 pe-9 text-start text-base font-bold h-10 border-purple-300 bg-white", filledCls(formData.commissionFeeUsd))}
                      dir="ltr"
                    />
                    <StepBtns side="end" onStep={(d) => setFormData((p) => ({ ...p, commissionFeeUsd: stepValue(p.commissionFeeUsd, d * 0.25) }))} />
                  </div>
                  <p className="text-[11px] text-purple-600">{pickLang(language, { ku: "قازانجی کۆمپانیا بۆ هەر دانەیەک", en: "Company profit per unit", ar: "ربح الشركة لكل وحدة", zh: "公司每件利润" })}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-700">{pickLang(language, { ku: "نرخی کاڵا (یەک دانە) *", en: "Item price (per unit) *", ar: "سعر المنتج (للوحدة) *", zh: "商品价格（单件）*" })}</Label>
                  <div className="relative" dir="ltr">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">$</span>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.itemPriceUsd}
                      onChange={(e) => syncFromUsd(e.target.value)}
                      placeholder="0.00"
                      className={cn("ps-8 pe-9 text-start text-base font-bold h-10 border-amber-300 bg-white", filledCls(formData.itemPriceUsd))}
                      dir="ltr"
                    />
                    <StepBtns side="end" onStep={(d) => syncFromUsd(stepValue(formData.itemPriceUsd, d, 4))} />
                  </div>
                  {rmbPerUnit && rmbRate > 0 && (
                    <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1 border border-orange-200">
                      <span className="text-[11px] text-orange-600">{pickLang(language, { ku: "١ دانە بە یوانی چینی", en: "1 unit in Chinese yuan", ar: "وحدة واحدة باليوان الصيني", zh: "单件人民币" })}</span>
                      <span className="text-sm font-bold text-orange-700 font-mono">{Number(rmbPerUnit).toLocaleString("en-US")} ¥</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Commission Income Preview — compact */}
              {(itemPrice > 0 || commissionFee > 0) && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                      <span className="font-bold text-sm text-amber-800">{pickLang(language, { ku: "پێشبینی پارەدان", en: "Payment preview", ar: "معاينة الدفع", zh: "付款预览" })}</span>
                    </div>
                    <span className="bg-white px-2.5 py-0.5 rounded-full border border-amber-300 text-amber-700 font-bold text-xs">{pickLang(language, { ku: `${formData.quantity || 1} عەدەد`, en: `${formData.quantity || 1} units`, ar: `${formData.quantity || 1} قطعة`, zh: `${formData.quantity || 1} 件` })}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                      <p className="text-[10px] text-slate-500 mb-0.5">{pickLang(language, { ku: "نرخی کاڵا (١ دانە)", en: "Item price (1 unit)", ar: "سعر المنتج (وحدة واحدة)", zh: "商品价格（单件）" })}</p>
                      <p className="text-base font-bold text-amber-600">${itemPrice.toFixed(2)}</p>
                    </div>
                    <div className="bg-amber-100 rounded-lg p-2 text-center shadow-sm">
                      <p className="text-[10px] text-amber-700 mb-0.5">{pickLang(language, { ku: `کۆی نرخ (${formData.quantity || 1} دانە)`, en: `Total price (${formData.quantity || 1} units)`, ar: `إجمالي السعر (${formData.quantity || 1} قطعة)`, zh: `总价（${formData.quantity || 1} 件）` })}</p>
                      <p className="text-base font-bold text-amber-700">${(itemPrice * quantity).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                      <p className="text-[10px] text-slate-500 mb-0.5">{pickLang(language, { ku: "عمولە (١ دانە)", en: "Commission (1 unit)", ar: "العمولة (وحدة واحدة)", zh: "佣金（单件）" })}</p>
                      <p className="text-base font-bold text-purple-600">${commissionFee.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-100 rounded-lg p-2 text-center shadow-sm">
                      <p className="text-[10px] text-purple-700 mb-0.5">{pickLang(language, { ku: `کۆی عمولە (${formData.quantity || 1} دانە)`, en: `Total commission (${formData.quantity || 1} units)`, ar: `إجمالي العمولة (${formData.quantity || 1} قطعة)`, zh: `总佣金（${formData.quantity || 1} 件）` })}</p>
                      <p className="text-base font-bold text-purple-700">${(commissionFee * quantity).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-amber-300 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700">{pickLang(language, { ku: "کۆی پارەدانی پێشوەخت", en: "Total prepayment", ar: "إجمالي الدفع المسبق", zh: "预付总额" })}</p>
                      <p className="text-[10px] text-slate-500">{pickLang(language, { ku: `(نرخ + عمولە) × ${formData.quantity || 1}`, en: `(price + commission) × ${formData.quantity || 1}`, ar: `(السعر + العمولة) × ${formData.quantity || 1}`, zh: `（价格 + 佣金）× ${formData.quantity || 1}` })}</p>
                    </div>
                    <div className="text-end">
                      <div className="text-xl font-bold text-amber-700">${totalPrepaid.toFixed(2)}</div>
                      {rmbTotal && rmbRate > 0 && (
                        <p className="text-[11px] text-orange-500 font-mono">
                          ≈ {(totalPrepaid * rmbRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} ¥
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-center text-amber-600 mt-2 bg-white/50 rounded-lg py-1">
                    💡 {pickLang(language, { ku: `قازانجی کۆمپانیا = $${(commissionFee * quantity).toFixed(2)} (عمولەی ${formData.quantity || 1} دانە)`, en: `Company profit = $${(commissionFee * quantity).toFixed(2)} (commission for ${formData.quantity || 1} units)`, ar: `ربح الشركة = $${(commissionFee * quantity).toFixed(2)} (عمولة ${formData.quantity || 1} قطعة)`, zh: `公司利润 = $${(commissionFee * quantity).toFixed(2)}（${formData.quantity || 1} 件的佣金）` })}
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* ── Advance Payment ── */}
          <Section icon={Wallet} title={pickLang(language, { ku: "پارەدانی پێشەکی (ئاختیاری)", en: "Advance payment (optional)", ar: "دفعة مقدمة (اختياري)", zh: "预付款（可选）" })} hint={pickLang(language, { ku: "ڕاستەوخۆ لە حسابی کڕیار کەم دەبێتەوە", en: "Deducted directly from the customer's account", ar: "يُخصم مباشرة من حساب العميل", zh: "直接从客户账户扣除" })} accent="teal">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-teal-700">{pickLang(language, { ku: "بڕی پارەی پێشەکی (USD)", en: "Advance amount (USD)", ar: "مبلغ الدفعة المقدمة (USD)", zh: "预付金额 (USD)" })}</Label>
                  <div className="relative" dir="ltr">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-teal-500 font-bold select-none">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      max={totalPrepaid.toFixed(2)}
                      value={formData.advancePaidUsd}
                      onChange={(e) => setFormData({ ...formData, advancePaidUsd: e.target.value })}
                      placeholder="0.00"
                      className={cn("ps-8 pe-9 h-10 text-base font-bold border-teal-200 focus:border-teal-400 bg-teal-50/40", filledCls(formData.advancePaidUsd))}
                      dir="ltr"
                    />
                    <StepBtns side="end" onStep={(d) => setFormData((p) => ({ ...p, advancePaidUsd: stepValue(p.advancePaidUsd, d) }))} />
                  </div>
                  <p className="text-[11px] text-teal-600">{pickLang(language, { ku: "بۆ بێ پارەدان دابمێنە بە 0", en: "Leave at 0 for no payment", ar: "اتركه 0 لعدم وجود دفعة", zh: "无付款则保留为 0" })}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-teal-700">{pickLang(language, { ku: "شێوازی پارەدان", en: "Payment method", ar: "طريقة الدفع", zh: "付款方式" })}</Label>
                  <Select
                    value={formData.advancePaymentMethod}
                    onValueChange={(v) => setFormData({ ...formData, advancePaymentMethod: v as any })}
                  >
                    <SelectTrigger className={cn("h-10 border-teal-200 bg-teal-50/40", filledCls(formData.advancePaymentMethod))}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">{pickLang(language, { ku: "کاش", en: "Cash", ar: "نقدًا", zh: "现金" })}</SelectItem>
                      <SelectItem value="BANK_TRANSFER">{pickLang(language, { ku: "گواستنەوەی بانک", en: "Bank transfer", ar: "تحويل بنكي", zh: "银行转账" })}</SelectItem>
                      <SelectItem value="FIB">FIB</SelectItem>
                      <SelectItem value="FASTPAY">FastPay</SelectItem>
                      <SelectItem value="ZAINCASH">ZainCash</SelectItem>
                      <SelectItem value="ASIAHAWALA">AsiaHawala</SelectItem>
                      <SelectItem value="CARD">{pickLang(language, { ku: "کارتی بانکی", en: "Bank card", ar: "بطاقة بنكية", zh: "银行卡" })}</SelectItem>
                      <SelectItem value="OTHER">{pickLang(language, { ku: "هیتر", en: "Other", ar: "أخرى", zh: "其他" })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {parseFloat(formData.advancePaidUsd || "0") > 0 && totalPrepaid > 0 && (
                <div className="rounded-xl bg-teal-50 p-3 border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{pickLang(language, { ku: "کۆی نرخ", en: "Total price", ar: "إجمالي السعر", zh: "总价" })}</span>
                    <span className="font-mono font-bold">${totalPrepaid.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-teal-700">{pickLang(language, { ku: "پارەی پێشەکی", en: "Advance payment", ar: "الدفعة المقدمة", zh: "预付款" })}</span>
                    <span className="font-mono font-bold text-teal-700">-${parseFloat(formData.advancePaidUsd || "0").toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-teal-200" />
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-slate-800">{pickLang(language, { ku: "ماوە بۆ پارەدان", en: "Remaining to pay", ar: "المتبقي للدفع", zh: "待付余额" })}</span>
                    <span className="font-mono font-bold text-xl text-emerald-700">
                      ${Math.max(0, totalPrepaid - parseFloat(formData.advancePaidUsd || "0")).toFixed(2)}
                    </span>
                  </div>
                  {parseFloat(formData.advancePaidUsd || "0") > totalPrepaid && (
                    <p className="text-xs text-red-600 font-medium">⚠️ {pickLang(language, { ku: "پارەی پێشەکی زیاترە لە کۆی نرخ", en: "Advance payment exceeds the total price", ar: "الدفعة المقدمة تتجاوز إجمالي السعر", zh: "预付款超过总价" })}</p>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* ── Weight & Size (moved to second-to-last; only when a shipping type is chosen) ── */}
          {formData.shippingType && (
            <Section icon={Scale} title={pickLang(language, { ku: "کێش و قەبارە", en: "Weight and size", ar: "الوزن والحجم", zh: "重量和尺寸" })} hint={pickLang(language, { ku: "کێش و قەبارەی کاڵا بۆ ژماردنی کرێی گواستنەوە", en: "Item weight and size for calculating shipping cost", ar: "وزن المنتج وحجمه لحساب تكلفة الشحن", zh: "用于计算运费的商品重量和尺寸" })} accent="sky">
              {/* Air fields */}
              <div className="mt-3 space-y-3">
                {(formData.shippingType === "air_regular" || formData.shippingType === "air_irregular") && (
                  <div className={`rounded-xl border overflow-hidden ${formData.shippingType === "air_irregular" ? "border-amber-200" : "border-sky-200"}`}>
                    <div className={`px-4 py-2 flex items-center gap-2 border-b ${formData.shippingType === "air_irregular" ? "bg-amber-50 border-amber-100" : "bg-sky-50 border-sky-100"}`}>
                      <Scale className={`h-4 w-4 ${formData.shippingType === "air_irregular" ? "text-amber-600" : "text-sky-600"}`} />
                      <span className="text-sm font-semibold">{pickLang(language, { ku: "کێش و قەبارە", en: "Weight and size", ar: "الوزن والحجم", zh: "重量和尺寸" })}</span>
                      <span className="text-xs text-muted-foreground ms-auto">{pickLang(language, { ku: "max(ڕاستەقینە، ئەندازەیی)", en: "max(actual, volumetric)", ar: "max(الفعلي، الحجمي)", zh: "max(实际, 体积)" })}</span>
                    </div>
                    <div className="p-3 space-y-3 bg-white">
                      {/* Weight */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">{pickLang(language, { ku: "کێشی ڕاستەقینە (کیلۆگرام)", en: "Actual weight (kilograms)", ar: "الوزن الفعلي (كيلوغرام)", zh: "实际重量（千克）" })}</Label>
                          <div className="relative" dir="ltr">
                            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                            <Input type="number" step="0.01" min="0" value={formData.weightKg}
                              onChange={e => setFormData(p => ({ ...p, weightKg: e.target.value }))}
                              placeholder="0.00" className={cn("ps-9 pe-10 h-10 font-mono", filledCls(formData.weightKg))} dir="ltr" />
                            <StepBtns side="start" onStep={(d) => setFormData((p) => ({ ...p, weightKg: stepValue(p.weightKg, d * 0.1) }))} />
                          </div>
                        </div>
                        {volumetricKg > 0 && (
                          <div className={`rounded-xl p-3 flex flex-col justify-center ${chargeableKg === volumetricKg ? "bg-amber-50 border border-amber-200" : "bg-sky-50 border border-sky-200"}`}>
                            <p className="text-[11px] text-muted-foreground">{pickLang(language, { ku: "کێشی پارەدان", en: "Chargeable weight", ar: "الوزن المحتسب", zh: "计费重量" })}</p>
                            <p className={`text-xl font-bold font-mono ${chargeableKg === volumetricKg ? "text-amber-700" : "text-sky-700"}`}>{chargeableKg.toFixed(3)} kg</p>
                            <p className="text-[10px] text-muted-foreground">{pickLang(language, { ku: `${chargeableKg === volumetricKg ? "ئەندازەیی" : "ڕاستەقینە"} بە کار هاتووە`, en: `${chargeableKg === volumetricKg ? "Volumetric" : "Actual"} used`, ar: `${chargeableKg === volumetricKg ? "الحجمي" : "الفعلي"} مُستخدم`, zh: `已使用${chargeableKg === volumetricKg ? "体积" : "实际"}` })}</p>
                          </div>
                        )}
                      </div>
                      <div>
                        {/* Dimensions */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Ruler className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">{pickLang(language, { ku: "قەبارە (سانتیمەتر) — ئارەزووی", en: "Dimensions (cm) — optional", ar: "الأبعاد (سم) — اختياري", zh: "尺寸（厘米）— 可选" })}</Label>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {[["dimensionLength", pickLang(language, { ku: "درێژی (L)", en: "Length (L)", ar: "الطول (L)", zh: "长度 (L)" })], ["dimensionWidth", pickLang(language, { ku: "پانی (W)", en: "Width (W)", ar: "العرض (W)", zh: "宽度 (W)" })], ["dimensionHeight", pickLang(language, { ku: "بەرزی (H)", en: "Height (H)", ar: "الارتفاع (H)", zh: "高度 (H)" })]].map(([field, label]) => (
                              <div key={field} className="space-y-1">
                                <Label className="text-xs text-muted-foreground">{label}</Label>
                                <div className="relative" dir="ltr">
                                  <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">cm</span>
                                  <Input type="number" step="0.1" min="0"
                                    value={formData[field as keyof typeof formData] as string}
                                    onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                                    placeholder="0" className={cn("ps-8 pe-8 h-10 font-mono text-sm", filledCls(formData[field as keyof typeof formData]))} dir="ltr" />
                                  <StepBtns side="start" onStep={(d) => setFormData((p) => ({ ...p, [field]: stepValue(p[field as keyof typeof p] as string, d, 1) }))} />
                                </div>
                              </div>
                            ))}
                          </div>
                          {volumetricKg > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {pickLang(language, { ku: `کێشی ئەندازەیی: (${dimL}×${dimW}×${dimH}) ÷ 6000 = `, en: `Volumetric weight: (${dimL}×${dimW}×${dimH}) ÷ 6000 = `, ar: `الوزن الحجمي: (${dimL}×${dimW}×${dimH}) ÷ 6000 = `, zh: `体积重量：(${dimL}×${dimW}×${dimH}) ÷ 6000 = ` })}<strong>{volumetricKg.toFixed(3)} kg</strong>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sea fields */}
                {formData.shippingType === "sea" && (
                  <div className="rounded-xl border border-teal-200 overflow-hidden">
                    <div className="px-4 py-2 flex items-center gap-2 bg-teal-50 border-b border-teal-100">
                      <Calculator className="h-4 w-4 text-teal-600" />
                      <span className="text-sm font-semibold text-teal-800">{pickLang(language, { ku: "قەبارەی CBM", en: "CBM volume", ar: "حجم CBM", zh: "CBM 体积" })}</span>
                      <span className="text-xs text-muted-foreground ms-auto">{pickLang(language, { ku: "١ CBM = ١٠٠cm × ١٠٠cm × ١٠٠cm", en: "1 CBM = 100cm × 100cm × 100cm", ar: "1 CBM = 100سم × 100سم × 100سم", zh: "1 CBM = 100cm × 100cm × 100cm" })}</span>
                    </div>
                    <div className="p-3 space-y-3 bg-white">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Direct CBM */}
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium">{pickLang(language, { ku: "CBM ڕاستەوخۆ", en: "Direct CBM", ar: "CBM مباشر", zh: "直接 CBM" })}</Label>
                          <div className="relative" dir="ltr">
                            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">m³</span>
                            <Input type="number" step="0.0001" min="0" value={formData.volumeCbm}
                              onChange={e => setFormData(p => ({ ...p, volumeCbm: e.target.value }))}
                              placeholder="0.0000" className={cn("ps-9 pe-10 h-10 font-mono", filledCls(formData.volumeCbm))} dir="ltr" />
                            <StepBtns side="start" onStep={(d) => setFormData((p) => ({ ...p, volumeCbm: stepValue(p.volumeCbm, d * 0.01, 4) }))} />
                          </div>
                          <p className="text-xs text-muted-foreground">{pickLang(language, { ku: "ئەگەر CBM دەزانیت", en: "If you know the CBM", ar: "إذا كنت تعرف CBM", zh: "如果你知道 CBM" })}</p>
                        </div>
                        {/* Auto CBM from dims */}
                        {autoCbm > 0 && (
                          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex flex-col justify-center">
                            <p className="text-[11px] text-teal-600">{pickLang(language, { ku: "CBM خۆکار", en: "Auto CBM", ar: "CBM تلقائي", zh: "自动 CBM" })}</p>
                            <p className="text-xl font-bold font-mono text-teal-700">{autoCbm.toFixed(4)} m³</p>
                            <button type="button" onClick={() => setFormData(p => ({ ...p, volumeCbm: autoCbm.toFixed(4) }))}
                              className="text-[11px] text-teal-600 underline text-start mt-1 hover:text-teal-800">
                              {pickLang(language, { ku: "بەکاربێنە ←", en: "Use ←", ar: "استخدم ←", zh: "使用 ←" })}
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Dimensions for CBM calc */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Ruler className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">{pickLang(language, { ku: "قەبارە بۆ حساب کردنی CBM — ئارەزووی", en: "Dimensions for CBM calculation — optional", ar: "الأبعاد لحساب CBM — اختياري", zh: "用于计算 CBM 的尺寸 — 可选" })}</Label>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[["dimensionLength", pickLang(language, { ku: "درێژی (L)", en: "Length (L)", ar: "الطول (L)", zh: "长度 (L)" })], ["dimensionWidth", pickLang(language, { ku: "پانی (W)", en: "Width (W)", ar: "العرض (W)", zh: "宽度 (W)" })], ["dimensionHeight", pickLang(language, { ku: "بەرزی (H)", en: "Height (H)", ar: "الارتفاع (H)", zh: "高度 (H)" })]].map(([field, label]) => (
                            <div key={field} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{label}</Label>
                              <div className="relative" dir="ltr">
                                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">cm</span>
                                <Input type="number" step="0.1" min="0"
                                  value={formData[field as keyof typeof formData] as string}
                                  onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                                  placeholder="0" className={cn("ps-8 pe-8 h-10 font-mono text-sm", filledCls(formData[field as keyof typeof formData]))} dir="ltr" />
                                <StepBtns side="start" onStep={(d) => setFormData((p) => ({ ...p, [field]: stepValue(p[field as keyof typeof p] as string, d, 1) }))} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Notes */}
          <Section icon={Save} title={pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })} accent="slate">
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={pickLang(language, { ku: "تێبینی...", en: "Notes...", ar: "ملاحظات...", zh: "备注..." })}
              rows={2}
              className={cn(filledCls(formData.notes))}
            />
          </Section>

          {/* Submit */}
          <StickyFormBar>
            <Button type="button" variant="outline" onClick={() => setLocation("/commission")}>
              {t("common.cancel") || pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ms-2" />
              ) : (
                <Save className="h-4 w-4 ms-2" />
              )}
              {t("common.save") || pickLang(language, { ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
            </Button>
          </StickyFormBar>
        </form>
      </div>
    </DashboardLayout>
  );
}
