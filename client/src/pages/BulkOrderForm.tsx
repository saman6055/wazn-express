import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import {
  Package,
  DollarSign,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronsUpDown,
  Loader2,
  ArrowRight,
  ShoppingBag,
  Percent,
  ChevronDown,
  ChevronUp,
  GripVertical,
  PackagePlus,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Plane,
  Ship,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PhotoStack } from "@/components/PhotoStack";

type AdvancePaymentMethod = "CASH" | "BANK_TRANSFER" | "FIB" | "FASTPAY" | "ZAINCASH" | "ASIAHAWALA" | "CARD" | "OTHER";

interface OrderItem {
  id: string;
  productType: string;
  productLink: string;
  productDescription: string;
  productImages: string[];
  quantity: string;
  color: string;
  size: string;
  // Full Package fields
  purchasePriceUsd: string;
  sellingPriceUsd: string;
  // Commission fields
  itemPriceUsd: string;
  itemPriceCny: string; // ¥ price per unit (converts to itemPriceUsd via the RMB rate)
  commissionFeeUsd: string;
  // Advance payment
  advancePaidUsd: string;
  advancePaymentMethod: AdvancePaymentMethod;
  // Common
  notes: string;
  supplierId: string;
  orderNumber: string;
}

const emptyItem = (): OrderItem => ({
  id: crypto.randomUUID(),
  productType: "",
  productLink: "",
  productDescription: "",
  productImages: [],
  quantity: "1",
  color: "",
  size: "",
  purchasePriceUsd: "",
  sellingPriceUsd: "",
  itemPriceUsd: "",
  itemPriceCny: "",
  commissionFeeUsd: "",
  advancePaidUsd: "",
  advancePaymentMethod: "CASH",
  notes: "",
  supplierId: "",
  orderNumber: "",
});

export default function BulkOrderForm() {
  const { t, language } = useTranslation();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderType = (params.get("type") || "full_package") as "full_package" | "commission";
  
  const isCommission = orderType === "commission";
  const utils = trpc.useUtils();

  // ¥ exchange rate (RMB per 1 USD) — lets each commission item's price be
  // entered in Chinese Yuan and converted to USD, like the single-order form.
  const { data: rmbRateData } = trpc.exchangeRates.getCurrent.useQuery({ currency: "RMB" });
  const rmbRate = parseFloat(rmbRateData?.rate?.toString() || "0");

  // Customer search
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");

  // Shipping type (required for the whole batch)
  const [shippingType, setShippingType] = useState<"" | "air_regular" | "air_irregular" | "sea">("");

  // Items state
  const [items, setItems] = useState<OrderItem[]>([emptyItem(), emptyItem()]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Result state
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<{ created: number; errors: number } | null>(null);

  const { data: customers } = trpc.customers.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: colorAttrs } = trpc.productAttributes.list.useQuery({ type: "color" });
  const { data: sizeAttrs } = trpc.productAttributes.list.useQuery({ type: "size" });
  const { data: typeAttrs } = trpc.productAttributes.list.useQuery({ type: "productType" });

  const filteredCustomers = customers?.filter((customer) => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    const name = (customer.fullName || customer.fullNameKurdish || "").toLowerCase();
    const code = (customer.customerCode || "").toLowerCase();
    const phone = (customer.mobileNumber || "").toLowerCase();
    return name.includes(search) || code.includes(search) || phone.includes(search);
  }) || [];

  const selectedCustomer = customers?.find((c) => c.id.toString() === customerId);

  // One-time restore of the last-used customer once the list has loaded.
  // Never overwrite a customer the user already picked.
  const restoredCustomerRef = useRef(false);
  useEffect(() => {
    if (restoredCustomerRef.current) return;
    if (!customers || customers.length === 0) return;
    restoredCustomerRef.current = true;
    if (customerId) return;
    const savedId = localStorage.getItem("wazn-last-commission-customer");
    if (!savedId) return;
    const customer = customers.find((c) => c.id.toString() === savedId);
    if (!customer) return;
    setCustomerId(savedId);
    setCustomerSearch(customer.customerCode || customer.fullName || "");
  }, [customers, customerId]);

  const bulkCreateMutation = trpc.fullPackage.bulkCreate.useMutation({
    onSuccess: (data) => {
      // Remember the last customer (shared key with the single commission form).
      if (customerId) localStorage.setItem("wazn-last-commission-customer", customerId);
      setResultData({ created: data.created.length, errors: data.errors.length });
      setShowResult(true);
      utils.fullPackage.list.invalidate();
      toast.success(t("toast.packagesCreatedCount", { count: data.created.length }));
      if (data.errors.length > 0) {
        toast.warning(t("toast.packagesHadErrors", { count: data.errors.length }));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Item management
  const addItem = useCallback(() => {
    setItems(prev => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      if (prev.length <= 1) {
        toast.error(t("toast.atLeastOnePackageRequired"));
        return prev;
      }
      return prev.filter(item => item.id !== id);
    });
  }, []);

  const duplicateItem = useCallback((id: string) => {
    setItems(prev => {
      const source = prev.find(item => item.id === id);
      if (!source) return prev;
      const newItem = { ...source, id: crypto.randomUUID() };
      const index = prev.findIndex(item => item.id === id);
      const newItems = [...prev];
      newItems.splice(index + 1, 0, newItem);
      return newItems;
    });
  }, []);

  const updateItem = useCallback(<K extends keyof OrderItem>(id: string, field: K, value: OrderItem[K]) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  }, []);

  // Bidirectional ¥ ↔ $ for an item's price: editing one keeps the other in
  // sync via the RMB rate (itemPriceUsd is the source of truth sent on submit).
  const setItemUsd = useCallback((id: string, usd: string) => {
    const v = parseFloat(usd) || 0;
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, itemPriceUsd: usd, itemPriceCny: v > 0 && rmbRate > 0 ? (v * rmbRate).toFixed(2) : "" }
      : it));
  }, [rmbRate]);

  const setItemCny = useCallback((id: string, cny: string) => {
    const v = parseFloat(cny) || 0;
    setItems(prev => prev.map(it => it.id === id
      ? { ...it, itemPriceCny: cny, itemPriceUsd: v > 0 && rmbRate > 0 ? (v / rmbRate).toFixed(4) : "" }
      : it));
  }, [rmbRate]);

  const updateItemImages = useCallback((id: string, images: string[]) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, productImages: images } : item
    ));
  }, []);

  // Summary calculations
  const summary = useMemo(() => {
    let totalPurchase = 0;
    let totalSelling = 0;
    let totalCommission = 0;
    let totalItemPrice = 0;
    let totalQuantity = 0;
    let validItems = 0;

    items.forEach(item => {
      const qty = parseInt(item.quantity) || 0;
      totalQuantity += qty;
      
      if (item.productType) {
        validItems++;
      }

      if (isCommission) {
        const itemPrice = parseFloat(item.itemPriceUsd) || 0;
        const commFee = parseFloat(item.commissionFeeUsd) || 0;
        totalItemPrice += itemPrice * qty;
        totalCommission += commFee * qty;
      } else {
        const purchase = parseFloat(item.purchasePriceUsd) || 0;
        const selling = parseFloat(item.sellingPriceUsd) || 0;
        totalPurchase += purchase * qty;
        totalSelling += selling * qty;
      }
    });

    return {
      totalPurchase,
      totalSelling,
      totalProfit: isCommission ? totalCommission : (totalSelling - totalPurchase),
      totalCommission,
      totalItemPrice,
      totalPrepaid: totalItemPrice + totalCommission,
      totalQuantity,
      validItems,
      totalItems: items.length,
    };
  }, [items, isCommission]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const expandAll = useCallback(() => {
    setExpandedItems(items.map(i => i.id));
  }, [items]);

  const collapseAll = useCallback(() => {
    setExpandedItems([]);
  }, []);

  const handleSubmit = () => {
    if (!customerId) {
      toast.error(t("toast.selectCustomer"));
      return;
    }

    if (!shippingType) {
      toast.error(pickLang(language, { ku: "تکایە شێوازی گواستنەوە دیاری بکە", en: "Please select a shipping method", ar: "يرجى اختيار طريقة الشحن", zh: "请选择运输方式" }));
      return;
    }

    const validItems = items.filter(item => item.productType);
    if (validItems.length === 0) {
      toast.error(t("toast.fillAtLeastOnePackage"));
      return;
    }

    // Validate each item
    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      if (isCommission && !item.itemPriceUsd) {
        toast.error(t("toast.packagePriceRequired", { index: i + 1 }));
        return;
      }
    }

    bulkCreateMutation.mutate({
      customerId: parseInt(customerId),
      orderType,
      items: validItems.map(item => ({
        productName: item.productType,
        productType: item.productType || undefined,
        productLink: item.productLink || undefined,
        productImage: item.productImages[0] || undefined,
        productImages: item.productImages.length > 0 ? item.productImages : undefined,
        productDescription: item.productDescription || undefined,
        quantity: parseInt(item.quantity) || 1,
        color: item.color || undefined,
        size: item.size || undefined,
        supplierId: item.supplierId ? parseInt(item.supplierId) : undefined,
        orderNumber: item.orderNumber || undefined,
        notes: item.notes || undefined,
        // Full Package fields
        purchasePriceUsd: !isCommission && item.purchasePriceUsd ? item.purchasePriceUsd : undefined,
        sellingPriceUsd: !isCommission && item.sellingPriceUsd ? item.sellingPriceUsd : undefined,
        // Commission fields
        itemPriceUsd: isCommission ? item.itemPriceUsd || undefined : undefined,
        commissionFeeUsd: isCommission ? item.commissionFeeUsd || undefined : undefined,
        // Advance payment
        advancePaidUsd: item.advancePaidUsd || undefined,
        advancePaymentMethod: item.advancePaidUsd && parseFloat(item.advancePaidUsd) > 0 ? item.advancePaymentMethod : undefined,
        // Shipping type (applies to the whole batch)
        shippingType: shippingType || undefined,
      })),
    });
  };

  // Success result screen
  if (showResult && resultData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto flex items-center justify-center",
              resultData.errors === 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
            )}>
              {resultData.errors === 0 ? (
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-300" />
              ) : (
                <AlertCircle className="w-10 h-10 text-amber-600 dark:text-amber-300" />
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {resultData.errors === 0
                  ? pickLang(language, { ku: "تەواو بوو!", en: "Done!", ar: "تم بنجاح!", zh: "完成!" })
                  : pickLang(language, { ku: "تەواو بوو بە هەندێ کێشە", en: "Completed with some issues", ar: "اكتمل مع بعض المشكلات", zh: "完成但有部分问题" })}
              </h2>
              <p className="text-muted-foreground">
                {pickLang(language, { ku: `${resultData.created} ئۆردەر بە سەرکەوتوویی دروست کران`, en: `${resultData.created} orders created successfully`, ar: `تم إنشاء ${resultData.created} طلب بنجاح`, zh: `已成功创建 ${resultData.created} 个订单` })}
              </p>
              {resultData.errors > 0 && (
                <p className="text-amber-600 dark:text-amber-300 mt-1">
                  {pickLang(language, { ku: `${resultData.errors} ئۆردەر کێشەیان هەبوو`, en: `${resultData.errors} orders had issues`, ar: `${resultData.errors} طلب واجهت مشكلات`, zh: `${resultData.errors} 个订单存在问题` })}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setShowResult(false);
                  setResultData(null);
                  setItems([emptyItem(), emptyItem()]);
                }}
              >
                <Plus className="w-4 h-4 ms-2" />
                {pickLang(language, { ku: "دروستکردنی نوێ", en: "Create new", ar: "إنشاء جديد", zh: "新建" })}
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(isCommission ? "/commission" : "/full-package")}
              >
                {pickLang(language, { ku: "گەڕانەوە بۆ داشبۆرد", en: "Back to dashboard", ar: "العودة إلى لوحة التحكم", zh: "返回仪表板" })}
                <ArrowRight className="w-4 h-4 me-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950" dir="rtl">
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-20 border-b backdrop-blur-sm",
        isCommission 
          ? "bg-gradient-to-l from-amber-500/90 to-orange-500/90 text-white" 
          : "bg-gradient-to-l from-emerald-600/90 to-green-600/90 text-white"
      )}>
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <PackagePlus className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  {pickLang(language, { ku: "دروستکردنی ئۆردەر بە کۆمەڵ", en: "Create bulk order", ar: "إنشاء طلب بالجملة", zh: "批量创建订单" })}
                </h1>
                <p className="text-sm opacity-80">
                  {isCommission
                    ? pickLang(language, { ku: "کڕین بە تێچوو", en: "Commission purchase", ar: "شراء بعمولة", zh: "代购" })
                    : pickLang(language, { ku: "پاکێجی تەواو", en: "Full package", ar: "الباقة الكاملة", zh: "全包" })} - {pickLang(language, { ku: `${items.length} ئۆردەر`, en: `${items.length} orders`, ar: `${items.length} طلب`, zh: `${items.length} 个订单` })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => navigate(isCommission ? "/commission" : "/full-package")}
              >
                {pickLang(language, { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" })}
                <ArrowRight className="w-4 h-4 me-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6 max-w-5xl mx-auto">
        {/* Customer Selection Card */}
        <Card className="border-2 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                isCommission ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"
              )}>
                <ShoppingBag className={cn("w-6 h-6", isCommission ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300")} />
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">{pickLang(language, { ku: "هەڵبژاردنی کڕیار *", en: "Select customer *", ar: "اختيار العميل *", zh: "选择客户 *" })}</Label>
                <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerOpen}
                      className="w-full justify-between h-12 text-base"
                    >
                      {selectedCustomer ? (
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{selectedCustomer.customerCode}</Badge>
                          {selectedCustomer.fullName || selectedCustomer.fullNameKurdish}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{pickLang(language, { ku: "گەڕان بە ناو، کۆد، یان ژمارە...", en: "Search by name, code, or number...", ar: "البحث بالاسم أو الرمز أو الرقم...", zh: "按姓名、编号或号码搜索..." })}</span>
                      )}
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent variant="panel" className="w-[400px]" align="start">
                    <Command>
                      <CommandInput
                        placeholder={pickLang(language, { ku: "گەڕان بە ناو، کۆد، یان ژمارە...", en: "Search by name, code, or number...", ar: "البحث بالاسم أو الرمز أو الرقم...", zh: "按姓名、编号或号码搜索..." })}
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>{pickLang(language, { ku: "هیچ کڕیارێک نەدۆزرایەوە", en: "No customers found", ar: "لم يتم العثور على عملاء", zh: "未找到客户" })}</CommandEmpty>
                        <CommandGroup>
                          {filteredCustomers.slice(0, 50).map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={`${customer.fullName} ${customer.customerCode} ${customer.mobileNumber}`}
                              onSelect={() => {
                                setCustomerId(customer.id.toString());
                                setCustomerOpen(false);
                              }}
                            >
                              <Check className={cn("ms-2 h-4 w-4", customerId === customer.id.toString() ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium">{customer.fullName || customer.fullNameKurdish}</span>
                                <span className="text-xs text-muted-foreground">
                                  {customer.customerCode} • {customer.mobileNumber}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Type Selector */}
        <div>
          <Label className="text-sm font-medium text-muted-foreground mb-2 block">{pickLang(language, { ku: "شێوازی گواستنەوە *", en: "Shipping method *", ar: "طريقة الشحن *", zh: "运输方式 *" })}</Label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "air_regular", label: pickLang(language, { ku: "ئاسمانی ئاسایی", en: "Regular air", ar: "جوي عادي", zh: "普通空运" }), icon: Plane },
              { value: "air_irregular", label: pickLang(language, { ku: "ئاسمانی مەرسیدار", en: "Express air", ar: "جوي سريع", zh: "加急空运" }), icon: Plane },
              { value: "sea", label: pickLang(language, { ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" }), icon: Ship },
            ] as const).map((opt) => {
              const Icon = opt.icon;
              const active = shippingType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setShippingType(opt.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all",
                    active
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                      : "border-border bg-background text-muted-foreground hover:border-emerald-300 hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={addItem} size="sm" variant="outline" className="gap-1">
              <Plus className="w-4 h-4" />
              {pickLang(language, { ku: "ڕیزی نوێ", en: "New row", ar: "صف جديد", zh: "新增行" })}
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button onClick={expandAll} size="sm" variant="ghost" className="text-xs">
              {pickLang(language, { ku: "کردنەوەی هەموو", en: "Expand all", ar: "توسيع الكل", zh: "全部展开" })}
            </Button>
            <Button onClick={collapseAll} size="sm" variant="ghost" className="text-xs">
              {pickLang(language, { ku: "داخستنی هەموو", en: "Collapse all", ar: "طي الكل", zh: "全部收起" })}
            </Button>
          </div>
          <Badge variant="secondary" className="text-sm">
            {pickLang(language, { ku: `${summary.validItems} / ${summary.totalItems} ئۆردەر پڕکراوە`, en: `${summary.validItems} / ${summary.totalItems} orders filled`, ar: `${summary.validItems} / ${summary.totalItems} طلب مكتمل`, zh: `${summary.validItems} / ${summary.totalItems} 个订单已填写` })}
          </Badge>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {items.map((item, index) => {
            const isExpanded = expandedItems.includes(item.id);
            const itemQty = parseInt(item.quantity) || 1;
            
            let itemTotal = 0;
            let itemProfit = 0;
            if (isCommission) {
              const price = parseFloat(item.itemPriceUsd) || 0;
              const comm = parseFloat(item.commissionFeeUsd) || 0;
              itemTotal = (price + comm) * itemQty;
              itemProfit = comm * itemQty;
            } else {
              const purchase = parseFloat(item.purchasePriceUsd) || 0;
              const selling = parseFloat(item.sellingPriceUsd) || 0;
              itemTotal = selling * itemQty;
              itemProfit = (selling - purchase) * itemQty;
            }

            return (
              <Card
                key={item.id}
                className={cn(
                  "transition-all duration-200",
                  item.productType
                    ? "border-r-4"
                    : "border-r-4 border-r-gray-200 dark:border-r-gray-700",
                  item.productType && (isCommission ? "border-r-amber-500" : "border-r-emerald-500")
                )}
              >
                {/* Compact Row Header */}
                <div 
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(item.id)}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                    isCommission ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  )}>
                    {index + 1}
                  </div>

                  {/* Image thumbnail indicator */}
                  {item.productImages.length > 0 && (
                    <div onClick={e => e.stopPropagation()}>
                      <PhotoStack photos={item.productImages} className="w-8 h-8 rounded-lg border" />
                    </div>
                  )}
                  
                  {/* Inline quick fields */}
                  <div className="flex-1 grid grid-cols-12 gap-2 items-center" onClick={e => e.stopPropagation()}>
                    <div className="col-span-4">
                      <Select
                        value={item.productType}
                        onValueChange={(v) => updateItem(item.id, "productType", v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={pickLang(language, { ku: "جۆری کاڵا *", en: "Product type *", ar: "نوع المنتج *", zh: "商品类型 *" })} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{pickLang(language, { ku: "— بێ جۆر —", en: "— None —", ar: "— بدون —", zh: "— 无 —" })}</SelectItem>
                          {typeAttrs?.map(a => (
                            <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Input
                        placeholder={pickLang(language, { ku: "ژمارە", en: "Qty", ar: "الكمية", zh: "数量" })}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", e.target.value)}
                        className="h-9 text-sm text-center"
                      />
                    </div>
                    {isCommission ? (
                      <>
                        <div className="col-span-2">
                          <Input
                            placeholder={pickLang(language, { ku: "نرخی کاڵا ($)", en: "Item price ($)", ar: "سعر المنتج ($)", zh: "商品价格 ($)" })}
                            value={item.itemPriceUsd}
                            onChange={e => setItemUsd(item.id, e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder={pickLang(language, { ku: "عمولە ($)", en: "Commission ($)", ar: "العمولة ($)", zh: "佣金 ($)" })}
                            value={item.commissionFeeUsd}
                            onChange={e => updateItem(item.id, "commissionFeeUsd", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-2">
                          <Input
                            placeholder={pickLang(language, { ku: "نرخی کڕین ($)", en: "Purchase price ($)", ar: "سعر الشراء ($)", zh: "采购价 ($)" })}
                            value={item.purchasePriceUsd}
                            onChange={e => updateItem(item.id, "purchasePriceUsd", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder={pickLang(language, { ku: "نرخی فرۆشتن ($)", en: "Selling price ($)", ar: "سعر البيع ($)", zh: "售价 ($)" })}
                            value={item.sellingPriceUsd}
                            onChange={e => updateItem(item.id, "sellingPriceUsd", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-span-2 text-left">
                      <span className="text-sm font-semibold">
                        ${itemTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); duplicateItem(item.id); }}
                        title={pickLang(language, { ku: "کۆپی", en: "Copy", ar: "نسخ", zh: "复制" })}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 dark:text-red-400 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        title={pickLang(language, { ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t bg-muted/10">
                    {/* ¥ → $ converter for the item price (commission only) */}
                    {isCommission && (
                      <div className="mt-3 rounded-lg border border-orange-200 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-900/10 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-semibold text-orange-700 dark:text-orange-400">{pickLang(language, { ku: "نرخی کاڵا بە یوانی چینی (¥)", en: "Item price in Chinese Yuan (¥)", ar: "سعر المنتج باليوان الصيني (¥)", zh: "商品价格（人民币 ¥）" })}</Label>
                          {rmbRate > 0 ? (
                            <span className="text-[11px] font-mono text-orange-600 dark:text-orange-300">١ $ = {rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} ¥</span>
                          ) : (
                            <span className="text-[11px] text-red-600 dark:text-red-300">{pickLang(language, { ku: "نرخی گۆڕین لە سیتینگ دانەنراوە", en: "Exchange rate not set in settings", ar: "لم يتم تعيين سعر الصرف في الإعدادات", zh: "设置中未设定汇率" })}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 dark:text-orange-400 font-bold select-none">¥</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              dir="ltr"
                              placeholder={pickLang(language, { ku: "نرخی ١ دانە بە یوان", en: "Price per unit in Yuan", ar: "سعر الوحدة باليوان", zh: "单件人民币价格" })}
                              value={item.itemPriceCny}
                              onChange={e => setItemCny(item.id, e.target.value)}
                              className="h-9 text-sm pl-8"
                            />
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground">{pickLang(language, { ku: "= نرخی کاڵا: ", en: "= Item price: ", ar: "= سعر المنتج: ", zh: "= 商品价格：" })}</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono" dir="ltr">${item.itemPriceUsd || "0.00"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "ڕەنگ", en: "Color", ar: "اللون", zh: "颜色" })}</Label>
                        <Select
                          value={item.color}
                          onValueChange={(v) => updateItem(item.id, "color", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className="h-9 text-sm mt-1">
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
                      <div>
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "قەبارە", en: "Size", ar: "المقاس", zh: "尺寸" })}</Label>
                        <Select
                          value={item.size}
                          onValueChange={(v) => updateItem(item.id, "size", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className="h-9 text-sm mt-1">
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
                      <div>
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "ژمارەی ئۆردەر", en: "Order number", ar: "رقم الطلب", zh: "订单号" })}</Label>
                        <Input
                          placeholder={pickLang(language, { ku: "ژمارەی ئۆردەر", en: "Order number", ar: "رقم الطلب", zh: "订单号" })}
                          value={item.orderNumber}
                          onChange={e => updateItem(item.id, "orderNumber", e.target.value)}
                          className="h-9 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "لینکی کاڵا", en: "Product link", ar: "رابط المنتج", zh: "商品链接" })}</Label>
                        <Input
                          placeholder="https://..."
                          value={item.productLink}
                          onChange={e => updateItem(item.id, "productLink", e.target.value)}
                          className="h-9 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "دابینکەر", en: "Supplier", ar: "المورّد", zh: "供应商" })}</Label>
                        <Select
                          value={item.supplierId}
                          onValueChange={v => updateItem(item.id, "supplierId", v)}
                        >
                          <SelectTrigger className="h-9 text-sm mt-1">
                            <SelectValue placeholder={pickLang(language, { ku: "هەڵبژاردن", en: "Select", ar: "اختيار", zh: "选择" })} />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers?.map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "وەسف", en: "Description", ar: "الوصف", zh: "描述" })}</Label>
                        <Textarea
                          placeholder={pickLang(language, { ku: "وەسفی کاڵا...", en: "Product description...", ar: "وصف المنتج...", zh: "商品描述..." })}
                          value={item.productDescription}
                          onChange={e => updateItem(item.id, "productDescription", e.target.value)}
                          className="text-sm mt-1 min-h-[60px]"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <Label className="text-xs text-muted-foreground">{pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}</Label>
                        <Textarea
                          placeholder={pickLang(language, { ku: "تێبینی...", en: "Notes...", ar: "ملاحظات...", zh: "备注..." })}
                          value={item.notes}
                          onChange={e => updateItem(item.id, "notes", e.target.value)}
                          className="text-sm mt-1 min-h-[60px]"
                        />
                      </div>
                      {/* Image Upload */}
                      <div className="col-span-2 md:col-span-3">
                        <Label className="text-xs text-muted-foreground mb-1 block">{pickLang(language, { ku: "وێنەی کاڵا", en: "Product image", ar: "صورة المنتج", zh: "商品图片" })}</Label>
                        <CompressedImageUpload
                          images={item.productImages}
                          onChange={(imgs) => updateItemImages(item.id, imgs)}
                          maxImages={3}
                          compact
                          accentColor={isCommission ? "amber" : "emerald"}
                        />
                      </div>
                    </div>

                    {/* Advance Payment Section */}
                    {(() => {
                      const advanceNum = parseFloat(item.advancePaidUsd || "0");
                      const hasAdvance = advanceNum > 0 && itemTotal > 0;
                      const remaining = Math.max(0, itemTotal - advanceNum);
                      const overpaid = advanceNum > itemTotal && itemTotal > 0;
                      return (
                        <div className="mt-3 rounded-lg border-2 border-teal-200 dark:border-teal-900/50 bg-gradient-to-l from-teal-50/60 to-emerald-50/60 dark:from-teal-950/20 dark:to-emerald-950/20 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Wallet className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                            <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">{pickLang(language, { ku: "پارەدانی پێشەکی (ئاختیاری)", en: "Advance payment (optional)", ar: "دفعة مقدمة (اختياري)", zh: "预付款（可选）" })}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-teal-700 dark:text-teal-400">{pickLang(language, { ku: "بڕی پارەی پێشەکی ($)", en: "Advance amount ($)", ar: "مبلغ الدفعة المقدمة ($)", zh: "预付金额 ($)" })}</Label>
                              <div className="relative mt-1">
                                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-teal-500 dark:text-teal-400 font-bold select-none text-sm">$</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.advancePaidUsd}
                                  onChange={e => updateItem(item.id, "advancePaidUsd", e.target.value)}
                                  placeholder="0.00"
                                  className="ps-7 h-9 text-sm border-teal-200 dark:border-teal-900/50 bg-white dark:bg-background"
                                  dir="ltr"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-teal-700 dark:text-teal-400">{pickLang(language, { ku: "شێوازی پارەدان", en: "Payment method", ar: "طريقة الدفع", zh: "支付方式" })}</Label>
                              <Select
                                value={item.advancePaymentMethod}
                                onValueChange={(v) => updateItem(item.id, "advancePaymentMethod", v as AdvancePaymentMethod)}
                              >
                                <SelectTrigger className="h-9 text-sm mt-1 border-teal-200 dark:border-teal-900/50 bg-white dark:bg-background">
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
                          {hasAdvance && (
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                              <span className="text-teal-700 dark:text-teal-400">
                                {pickLang(language, { ku: "پێشەکی:", en: "Advance:", ar: "المقدّم:", zh: "预付：" })} <span className="font-mono font-bold">-${advanceNum.toFixed(2)}</span>
                              </span>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                {pickLang(language, { ku: "ماوە:", en: "Remaining:", ar: "المتبقي:", zh: "剩余：" })} <span className="font-mono font-bold">${remaining.toFixed(2)}</span>
                              </span>
                            </div>
                          )}
                          {overpaid && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2">⚠️ {pickLang(language, { ku: "پارەی پێشەکی زیاترە لە کۆی نرخ", en: "Advance exceeds the total price", ar: "الدفعة المقدمة تتجاوز إجمالي السعر", zh: "预付款超过总价" })}</p>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Item profit indicator */}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      {isCommission ? (
                        <>
                          <span className="text-muted-foreground">
                            {pickLang(language, { ku: "کۆی پارەدان:", en: "Total payment:", ar: "إجمالي الدفع:", zh: "付款总额：" })} <span className="font-semibold text-foreground">${itemTotal.toFixed(2)}</span>
                          </span>
                          <span className="text-green-600 dark:text-green-300">
                            {pickLang(language, { ku: "قازانج (عمولە):", en: "Profit (commission):", ar: "الربح (العمولة):", zh: "利润（佣金）：" })} <span className="font-semibold">${itemProfit.toFixed(2)}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">
                            {pickLang(language, { ku: "کۆی فرۆشتن:", en: "Total selling:", ar: "إجمالي البيع:", zh: "销售总额：" })} <span className="font-semibold text-foreground">${itemTotal.toFixed(2)}</span>
                          </span>
                          <span className={cn("font-semibold", itemProfit >= 0 ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300")}>
                            {pickLang(language, { ku: "قازانج:", en: "Profit:", ar: "الربح:", zh: "利润：" })} ${itemProfit.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Add New Item Button */}
          <Button
            variant="outline"
            className="w-full h-14 border-2 border-dashed text-muted-foreground hover:text-foreground"
            onClick={addItem}
          >
            <Plus className="w-5 h-5 ms-2" />
            {pickLang(language, { ku: "زیادکردنی ئۆردەری نوێ", en: "Add new order", ar: "إضافة طلب جديد", zh: "添加新订单" })}
          </Button>
        </div>

        {/* Summary Card - Sticky Bottom */}
        <Card className={cn(
          "sticky bottom-4 shadow-xl border-2",
          isCommission ? "border-amber-200 dark:border-amber-800" : "border-emerald-200 dark:border-emerald-800"
        )}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Stats */}
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.totalItems}</div>
                  <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی ئۆردەرەکان", en: "Total orders", ar: "إجمالي الطلبات", zh: "订单总数" })}</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.totalQuantity}</div>
                  <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی ژمارە", en: "Total quantity", ar: "إجمالي الكمية", zh: "总数量" })}</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                {isCommission ? (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">${summary.totalPrepaid.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی پارەدان", en: "Total payment", ar: "إجمالي الدفع", zh: "付款总额" })}</div>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-300">${summary.totalCommission.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی عمولە", en: "Total commission", ar: "إجمالي العمولة", zh: "佣金总额" })}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-300">${summary.totalPurchase.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی کڕین", en: "Total purchase", ar: "إجمالي الشراء", zh: "采购总额" })}</div>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">${summary.totalSelling.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی فرۆشتن", en: "Total selling", ar: "إجمالي البيع", zh: "销售总额" })}</div>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <div className={cn("text-2xl font-bold", summary.totalProfit >= 0 ? "text-green-600 dark:text-green-300" : "text-red-600 dark:text-red-300")}>
                        ${summary.totalProfit.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{pickLang(language, { ku: "کۆی قازانج", en: "Total profit", ar: "إجمالي الربح", zh: "利润总额" })}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Submit Button */}
              <Button
                size="lg"
                className={cn(
                  "min-w-[200px] h-12 text-base font-bold",
                  isCommission 
                    ? "bg-amber-500 hover:bg-amber-600" 
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
                onClick={handleSubmit}
                disabled={bulkCreateMutation.isPending || summary.validItems === 0 || !customerId}
              >
                {bulkCreateMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 ms-2 animate-spin" />
                    {pickLang(language, { ku: "چاوەڕوان بە...", en: "Please wait...", ar: "يرجى الانتظار...", zh: "请稍候..." })}
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-5 h-5 ms-2" />
                    {pickLang(language, { ku: `دروستکردنی ${summary.validItems} ئۆردەر`, en: `Create ${summary.validItems} orders`, ar: `إنشاء ${summary.validItems} طلب`, zh: `创建 ${summary.validItems} 个订单` })}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
