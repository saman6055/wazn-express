import { useState, useMemo, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
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
  const { t } = useTranslation();
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

  const bulkCreateMutation = trpc.fullPackage.bulkCreate.useMutation({
    onSuccess: (data) => {
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
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              ) : (
                <AlertCircle className="w-10 h-10 text-amber-600" />
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {resultData.errors === 0 ? "تەواو بوو!" : "تەواو بوو بە هەندێ کێشە"}
              </h2>
              <p className="text-muted-foreground">
                {resultData.created} پەت بە سەرکەوتوویی دروست کران
              </p>
              {resultData.errors > 0 && (
                <p className="text-amber-600 mt-1">
                  {resultData.errors} پەت کێشەیان هەبوو
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
                دروستکردنی نوێ
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(isCommission ? "/commission" : "/full-package")}
              >
                گەڕانەوە بۆ داشبۆرد
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
                  دروستکردنی پەت بە کۆمەڵ
                </h1>
                <p className="text-sm opacity-80">
                  {isCommission ? "کڕین بە عمولە" : "فول پاکیج"} - {items.length} پەت
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
                گەڕانەوە
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
                <ShoppingBag className={cn("w-6 h-6", isCommission ? "text-amber-600" : "text-emerald-600")} />
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium text-muted-foreground mb-2 block">هەڵبژاردنی کڕیار *</Label>
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
                        <span className="text-muted-foreground">گەڕان بە ناو، کۆد، یان ژمارە...</span>
                      )}
                      <ChevronsUpDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent variant="panel" className="w-[400px]" align="start">
                    <Command>
                      <CommandInput
                        placeholder="گەڕان بە ناو، کۆد، یان ژمارە..."
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>هیچ کڕیارێک نەدۆزرایەوە</CommandEmpty>
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

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={addItem} size="sm" variant="outline" className="gap-1">
              <Plus className="w-4 h-4" />
              ڕیزی نوێ
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button onClick={expandAll} size="sm" variant="ghost" className="text-xs">
              کردنەوەی هەموو
            </Button>
            <Button onClick={collapseAll} size="sm" variant="ghost" className="text-xs">
              داخستنی هەموو
            </Button>
          </div>
          <Badge variant="secondary" className="text-sm">
            {summary.validItems} / {summary.totalItems} پەت پڕکراوە
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
                    <div className="w-8 h-8 rounded-lg overflow-hidden border shrink-0" onClick={e => e.stopPropagation()}>
                      <img src={item.productImages[0]} alt="" className="w-full h-full object-cover" />
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
                          <SelectValue placeholder="جۆری کاڵا *" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— بێ جۆر —</SelectItem>
                          {typeAttrs?.map(a => (
                            <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Input
                        placeholder="ژمارە"
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
                            placeholder="نرخی کاڵا ($)"
                            value={item.itemPriceUsd}
                            onChange={e => setItemUsd(item.id, e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder="عمولە ($)"
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
                            placeholder="نرخی کڕین ($)"
                            value={item.purchasePriceUsd}
                            onChange={e => updateItem(item.id, "purchasePriceUsd", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder="نرخی فرۆشتن ($)"
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
                        title="کۆپی"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        title="سڕینەوە"
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
                      <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-900/10 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-semibold text-orange-700 dark:text-orange-400">نرخی کاڵا بە یوانی چینی (¥)</Label>
                          {rmbRate > 0 ? (
                            <span className="text-[11px] font-mono text-orange-600">١ $ = {rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} ¥</span>
                          ) : (
                            <span className="text-[11px] text-red-600">نرخی گۆڕین لە سیتینگ دانەنراوە</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div className="relative">
                            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              dir="ltr"
                              placeholder="نرخی ١ دانە بە یوان"
                              value={item.itemPriceCny}
                              onChange={e => setItemCny(item.id, e.target.value)}
                              className="h-9 text-sm pe-8"
                            />
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted-foreground">= نرخی کاڵا: </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono" dir="ltr">${item.itemPriceUsd || "0.00"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">ڕەنگ</Label>
                        <Select
                          value={item.color}
                          onValueChange={(v) => updateItem(item.id, "color", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className="h-9 text-sm mt-1">
                            <SelectValue placeholder="ڕەنگ هەڵبژێرە" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— بێ ڕەنگ —</SelectItem>
                            {colorAttrs?.map(a => (
                              <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">قەبارە</Label>
                        <Select
                          value={item.size}
                          onValueChange={(v) => updateItem(item.id, "size", v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className="h-9 text-sm mt-1">
                            <SelectValue placeholder="قەبارە هەڵبژێرە" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— بێ قەبارە —</SelectItem>
                            {sizeAttrs?.map(a => (
                              <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ژمارەی ئۆردەر</Label>
                        <Input
                          placeholder="ژمارەی ئۆردەر"
                          value={item.orderNumber}
                          onChange={e => updateItem(item.id, "orderNumber", e.target.value)}
                          className="h-9 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">لینکی کاڵا</Label>
                        <Input
                          placeholder="https://..."
                          value={item.productLink}
                          onChange={e => updateItem(item.id, "productLink", e.target.value)}
                          className="h-9 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">دابینکەر</Label>
                        <Select
                          value={item.supplierId}
                          onValueChange={v => updateItem(item.id, "supplierId", v)}
                        >
                          <SelectTrigger className="h-9 text-sm mt-1">
                            <SelectValue placeholder="هەڵبژاردن" />
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
                        <Label className="text-xs text-muted-foreground">وەسف</Label>
                        <Textarea
                          placeholder="وەسفی کاڵا..."
                          value={item.productDescription}
                          onChange={e => updateItem(item.id, "productDescription", e.target.value)}
                          className="text-sm mt-1 min-h-[60px]"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-3">
                        <Label className="text-xs text-muted-foreground">تێبینی</Label>
                        <Textarea
                          placeholder="تێبینی..."
                          value={item.notes}
                          onChange={e => updateItem(item.id, "notes", e.target.value)}
                          className="text-sm mt-1 min-h-[60px]"
                        />
                      </div>
                      {/* Image Upload */}
                      <div className="col-span-2 md:col-span-3">
                        <Label className="text-xs text-muted-foreground mb-1 block">وێنەی کاڵا</Label>
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
                            <Wallet className="w-4 h-4 text-teal-600" />
                            <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">پارەدانی پێشەکی (ئاختیاری)</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-teal-700 dark:text-teal-400">بڕی پارەی پێشەکی ($)</Label>
                              <div className="relative mt-1">
                                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-teal-500 font-bold select-none text-sm">$</span>
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
                              <Label className="text-xs text-teal-700 dark:text-teal-400">شێوازی پارەدان</Label>
                              <Select
                                value={item.advancePaymentMethod}
                                onValueChange={(v) => updateItem(item.id, "advancePaymentMethod", v as AdvancePaymentMethod)}
                              >
                                <SelectTrigger className="h-9 text-sm mt-1 border-teal-200 dark:border-teal-900/50 bg-white dark:bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CASH">کاش</SelectItem>
                                  <SelectItem value="BANK_TRANSFER">گواستنەوەی بانک</SelectItem>
                                  <SelectItem value="FIB">FIB</SelectItem>
                                  <SelectItem value="FASTPAY">FastPay</SelectItem>
                                  <SelectItem value="ZAINCASH">ZainCash</SelectItem>
                                  <SelectItem value="ASIAHAWALA">AsiaHawala</SelectItem>
                                  <SelectItem value="CARD">کارتی بانکی</SelectItem>
                                  <SelectItem value="OTHER">هیتر</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {hasAdvance && (
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                              <span className="text-teal-700 dark:text-teal-400">
                                پێشەکی: <span className="font-mono font-bold">-${advanceNum.toFixed(2)}</span>
                              </span>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                ماوە: <span className="font-mono font-bold">${remaining.toFixed(2)}</span>
                              </span>
                            </div>
                          )}
                          {overpaid && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2">⚠️ پارەی پێشەکی زیاترە لە کۆی نرخ</p>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Item profit indicator */}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      {isCommission ? (
                        <>
                          <span className="text-muted-foreground">
                            کۆی پارەدان: <span className="font-semibold text-foreground">${itemTotal.toFixed(2)}</span>
                          </span>
                          <span className="text-green-600">
                            قازانج (عمولە): <span className="font-semibold">${itemProfit.toFixed(2)}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">
                            کۆی فرۆشتن: <span className="font-semibold text-foreground">${itemTotal.toFixed(2)}</span>
                          </span>
                          <span className={cn("font-semibold", itemProfit >= 0 ? "text-green-600" : "text-red-600")}>
                            قازانج: ${itemProfit.toFixed(2)}
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
            زیادکردنی پەتی نوێ
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
                  <div className="text-xs text-muted-foreground">کۆی پەتەکان</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.totalQuantity}</div>
                  <div className="text-xs text-muted-foreground">کۆی ژمارە</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                {isCommission ? (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">${summary.totalPrepaid.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">کۆی پارەدان</div>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">${summary.totalCommission.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">کۆی عمولە</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">${summary.totalPurchase.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">کۆی کڕین</div>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">${summary.totalSelling.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">کۆی فرۆشتن</div>
                    </div>
                    <Separator orientation="vertical" className="h-10" />
                    <div className="text-center">
                      <div className={cn("text-2xl font-bold", summary.totalProfit >= 0 ? "text-green-600" : "text-red-600")}>
                        ${summary.totalProfit.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">کۆی قازانج</div>
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
                    چاوەڕوان بە...
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-5 h-5 ms-2" />
                    دروستکردنی {summary.validItems} پەت
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
