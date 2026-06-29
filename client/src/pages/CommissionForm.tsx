import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, DollarSign, Package, User, Percent, ImageIcon, Check, ChevronsUpDown, Banknote, ArrowLeftRight, Save, Loader2, Link as LinkIcon, TrendingUp, Plane, Ship, Zap, Ruler, Scale, Calculator, Wallet } from "lucide-react";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function CommissionForm() {
  const [, setLocation] = useLocation();
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
      toast.success("پەتی عمولە بە سەرکەوتوویی دروست کرا");
      utils.fullPackage.list.invalidate();
      if (formData.customerId) {
        localStorage.setItem("wazn-last-commission-customer", formData.customerId);
      }
      setLocation("/commission");
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
      toast.error("تکایە کڕیارێک هەڵبژێرە");
      return;
    }

    if (!formData.productType) {
      toast.error("تکایە جۆری کاڵا هەڵبژێرە");
      return;
    }

    if (!formData.itemPriceUsd || itemPrice <= 0) {
      toast.error("تکایە نرخی کاڵا داخڵ بکە");
      return;
    }

    if (!formData.commissionFeeUsd || commissionFee <= 0) {
      toast.error("تکایە عمولەی کڕین داخڵ بکە");
      return;
    }

    if (!formData.shippingType) {
      toast.error("تکایە شێوازی گواستنەوە دیاری بکە");
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation("/commission")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Percent className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">پەتی عمولەی نوێ</h1>
              <p className="text-muted-foreground">کڕیار نرخ دەزانێت، کۆمپانیا تەنها عمولە وەردەگرێت</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-amber-600" />
                کڕیار
              </CardTitle>
              <CardDescription>کڕیارێک هەڵبژێرە بۆ ئەم پەتە</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>کڕیار *</Label>
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerOpen}
                        className="w-full justify-between"
                      >
                        {selectedCustomer
                          ? `${selectedCustomer.fullName || selectedCustomer.fullNameKurdish} (${selectedCustomer.customerCode})`
                          : "کڕیارێک هەڵبژێرە..."}
                        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent variant="panel" className="w-full min-w-[320px]" align="start">
                      <Command>
                        <CommandInput
                          placeholder="گەڕان بە ناو، کۆد یان مۆبایل..."
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>کڕیار نەدۆزرایەوە</CommandEmpty>
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
                <div className="space-y-2">
                  <Label>فرۆشیار</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="فرۆشیارێک هەڵبژێرە (ئارەزوومەندانە)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بێ فرۆشیار</SelectItem>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Product Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-600" />
                زانیاری کاڵا
              </CardTitle>
              <CardDescription>زانیاری کاڵاکە داخڵ بکە</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>جۆری کاڵا *</Label>
                  <Select
                    value={formData.productType}
                    onValueChange={(v) => setFormData({ ...formData, productType: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="جۆر هەڵبژێرە" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— بێ جۆر —</SelectItem>
                      {typeAttrs?.map(a => (
                        <SelectItem key={a.id} value={a.value}>{a.value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ئۆردەر نەمبەر</Label>
                  <Input
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    placeholder="ژمارەی ئۆردەر"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  لینکی کاڵا
                </Label>
                <Input
                  value={formData.productLink}
                  onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>

              {/* Image Upload Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  وێنەی کاڵا
                </Label>
                <CompressedImageUpload
                  images={productImages}
                  onChange={setProductImages}
                  maxImages={5}
                  accentColor="amber"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Color */}
                <div className="space-y-2">
                  <Label>ڕەنگ</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(v) => setFormData({ ...formData, color: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
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
                {/* Size */}
                <div className="space-y-2">
                  <Label>قەبارە</Label>
                  <Select
                    value={formData.size}
                    onValueChange={(v) => setFormData({ ...formData, size: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger>
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
              </div>

              <div className="space-y-2">
                <Label>وەسف</Label>
                <Textarea
                  value={formData.productDescription}
                  onChange={(e) => setFormData({ ...formData, productDescription: e.target.value })}
                  placeholder="وەسفی کاڵا..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-l from-amber-50 to-yellow-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
                نرخەکان و عەدەد
              </CardTitle>
              <CardDescription>نرخی کاڵا، عمولەی کۆمپانیا و ژمارە داخڵ بکە</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">

              {/* 1. Quantity */}
              <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                <Label className="text-sm font-medium text-slate-600 mb-2 block">عەدەد *</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => handleQuantityChange(Math.max(1, parseInt(formData.quantity) - 1).toString())}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="text-center text-2xl font-bold h-14 border-2"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => handleQuantityChange((parseInt(formData.quantity) + 1).toString())}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* 2 + 3. ¥ Converter Section (per-unit ¥ then total ¥) */}
              <div className={`rounded-2xl border-2 overflow-hidden ${rmbRate > 0 ? "border-orange-200" : "border-dashed border-gray-300"}`}>
                {/* Header — live rate hint */}
                <div className="bg-gradient-to-l from-orange-100 to-amber-50 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500 rounded-lg">
                      <Banknote className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-900 text-sm">نرخی کاڵا بە یوانی چینی</p>
                      {rmbRate > 0 ? (
                        <p className="text-xs text-orange-700">
                          نرخی بەراورد: ١ دۆلار = {rmbRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} یوانی چینی
                        </p>
                      ) : (
                        <p className="text-xs text-red-600">تکایە نرخی بەراورد لە سیتینگی سیستەم داخڵ بکە</p>
                      )}
                    </div>
                  </div>
                  {rmbRate > 0 && (
                    <div className="flex items-center gap-1 bg-orange-100 border border-orange-300 rounded-lg px-2.5 py-1 text-xs font-mono text-orange-800">
                      <ArrowLeftRight className="h-3 w-3" />
                      ${(1 / rmbRate).toFixed(5)} = ١ ¥
                    </div>
                  )}
                </div>

                {/* Two ¥ inputs + result */}
                <div className="bg-white px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* 2. Per-unit ¥ */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-amber-700">نرخی ١ دانە بە یوانی چینی</Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rmbPerUnit}
                          onChange={(e) => syncFromPerUnit(e.target.value)}
                          placeholder="٠"
                          className="pe-9 h-12 text-lg font-bold border-2 border-amber-200 focus:border-orange-400 bg-amber-50/40"
                          dir="ltr"

                        />
                      </div>
                      <p className="text-xs text-amber-500">نرخی یەک دانەی کاڵا</p>
                    </div>

                    {/* 3. Total ¥ */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-orange-700">کۆی نرخ بە یوانی چینی ({quantity} دانە)</Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rmbTotal}
                          onChange={(e) => syncFromTotal(e.target.value)}
                          placeholder="٠"
                          className="pe-9 h-12 text-lg font-bold border-2 border-orange-200 focus:border-orange-400 bg-orange-50/40"
                          dir="ltr"

                        />
                      </div>
                      <p className="text-xs text-orange-500">کۆی گشتی بۆ هەموو دانەکان</p>
                    </div>
                  </div>

                  {/* Result */}
                  {(parseFloat(rmbPerUnit) > 0 || parseFloat(rmbTotal) > 0) && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">١ دانە یوانی چینی</p>
                        <p className="font-bold text-amber-700 font-mono">{Number(rmbPerUnit || 0).toLocaleString("en-US")} ¥</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                        <p className="text-[10px] text-orange-500 uppercase tracking-wide mb-1">کۆی {quantity} دانە</p>
                        <p className="font-bold text-orange-700 font-mono">{Number(rmbTotal || 0).toLocaleString("en-US")} ¥</p>
                      </div>
                      <div className="bg-gradient-to-b from-amber-500 to-orange-500 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-[10px] text-amber-100 uppercase tracking-wide mb-1">نرخی $ یەک دانە</p>
                        <p className="font-bold text-white font-mono text-base">${formData.itemPriceUsd || "0.0000"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Commission Fee */}
              <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200 space-y-2">
                <Label className="text-sm font-medium text-purple-700 block">عموڵەی کڕین *</Label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-600 font-bold">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.commissionFeeUsd}
                    onChange={(e) => setFormData({ ...formData, commissionFeeUsd: e.target.value })}
                    placeholder="0.00"
                    className="pr-8 text-left text-xl font-bold h-14 border-2 border-purple-300 bg-white"
                    dir="ltr"
                  />
                </div>
                <p className="text-xs text-purple-600">قازانجی کۆمپانیا بۆ هەر دانەیەک</p>
              </div>

              {/* 5. Item Price ($) */}
              <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 space-y-2">
                <Label className="text-sm font-medium text-amber-700 block">نرخی کاڵا (یەک دانە) *</Label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">$</span>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.itemPriceUsd}
                    onChange={(e) => syncFromUsd(e.target.value)}
                    placeholder="0.00"
                    className="pr-8 text-left text-xl font-bold h-14 border-2 border-amber-300 bg-white"
                    dir="ltr"
                  />
                </div>
                {rmbPerUnit && rmbRate > 0 && (
                  <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                    <span className="text-[11px] text-orange-600">١ دانە بە یوانی چینی</span>
                    <span className="text-sm font-bold text-orange-700 font-mono">{Number(rmbPerUnit).toLocaleString("en-US")} ¥</span>
                  </div>
                )}
                <p className="text-xs text-amber-600">نرخی کاڵا بۆ کڕیار</p>
              </div>

              {/* Commission Income Preview */}
              {(itemPrice > 0 || commissionFee > 0) && (
                <div className="bg-gradient-to-l from-amber-100 via-yellow-50 to-amber-50 rounded-2xl p-6 border-2 border-amber-300 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-bold text-lg text-amber-800">پێشبینی پارەدان</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-full border-2 border-amber-300">
                      <span className="text-amber-700 font-bold">{formData.quantity || 1} عەدەد</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">نرخی کاڵا (١ دانە)</p>
                      <p className="text-xl font-bold text-amber-600">${itemPrice.toFixed(2)}</p>
                    </div>
                    <div className="bg-amber-100 rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-amber-700 mb-1">کۆی نرخ ({formData.quantity || 1} دانە)</p>
                      <p className="text-xl font-bold text-amber-700">${(itemPrice * quantity).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">عمولە (١ دانە)</p>
                      <p className="text-xl font-bold text-purple-600">${commissionFee.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-100 rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-purple-700 mb-1">کۆی عمولە ({formData.quantity || 1} دانە)</p>
                      <p className="text-xl font-bold text-purple-700">${(commissionFee * quantity).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t-2 border-amber-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-amber-700">کۆی پارەدانی پێشوەخت</p>
                        <p className="text-xs text-slate-500">(نرخ + عمولە) × {formData.quantity || 1}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-amber-700">${totalPrepaid.toFixed(2)}</div>
                        {rmbTotal && rmbRate > 0 && (
                          <p className="text-xs text-orange-500 font-mono mt-0.5">
                            ≈ {(totalPrepaid * rmbRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} ¥
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-center text-amber-600 mt-3 bg-white/50 rounded-lg py-2">
                    💡 قازانجی کۆمپانیا = ${(commissionFee * quantity).toFixed(2)} (عمولەی {formData.quantity || 1} دانە)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Advance Payment Section ── */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-l from-teal-50 to-emerald-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-teal-600" />
                پارەدانی پێشەکی (ئاختیاری)
              </CardTitle>
              <CardDescription>ئەگەر کڕیار بەشێک یان هەموو پارەکەی پێشوەخت داوە، بڕی پارەکە دابنێ — ڕاستەوخۆ لە حسابی کڕیار کەم دەبێتەوە</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-teal-700">بڕی پارەی پێشەکی (USD)</Label>
                  <div className="relative">
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-teal-500 font-bold select-none">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      max={totalPrepaid.toFixed(2)}
                      value={formData.advancePaidUsd}
                      onChange={(e) => setFormData({ ...formData, advancePaidUsd: e.target.value })}
                      placeholder="0.00"
                      className="ps-8 h-12 text-lg font-bold border-2 border-teal-200 focus:border-teal-400 bg-teal-50/40"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-xs text-teal-600">بۆ بێ پارەدان دابمێنە بە 0</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-teal-700">شێوازی پارەدان</Label>
                  <Select
                    value={formData.advancePaymentMethod}
                    onValueChange={(v) => setFormData({ ...formData, advancePaymentMethod: v as any })}
                  >
                    <SelectTrigger className="h-12 border-2 border-teal-200 bg-teal-50/40">
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

              {parseFloat(formData.advancePaidUsd || "0") > 0 && totalPrepaid > 0 && (
                <div className="rounded-xl bg-gradient-to-l from-teal-50 to-emerald-50 p-4 border-2 border-teal-200 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">کۆی نرخ</span>
                    <span className="font-mono font-bold">${totalPrepaid.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-teal-700">پارەی پێشەکی</span>
                    <span className="font-mono font-bold text-teal-700">-${parseFloat(formData.advancePaidUsd || "0").toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-teal-200" />
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-slate-800">ماوە بۆ پارەدان</span>
                    <span className="font-mono font-bold text-xl text-emerald-700">
                      ${Math.max(0, totalPrepaid - parseFloat(formData.advancePaidUsd || "0")).toFixed(2)}
                    </span>
                  </div>
                  {parseFloat(formData.advancePaidUsd || "0") > totalPrepaid && (
                    <p className="text-xs text-red-600 font-medium">⚠️ پارەی پێشەکی زیاترە لە کۆی نرخ</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Shipping Method ── */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-l from-sky-50 to-blue-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-sky-600" />
                ریگاکانی گواستنەوە
              </CardTitle>
              <CardDescription>ریگای گواستنەوەی کاڵاکە هەڵبژێرە</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">

              {/* Method Selector */}
              <div className="grid grid-cols-3 gap-3">
                {/* Air Regular */}
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, shippingType: p.shippingType === "air_regular" ? "" : "air_regular", volumeCbm: "" }))}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                    formData.shippingType === "air_regular"
                      ? "border-sky-400 bg-sky-50 shadow-md shadow-sky-100"
                      : "border-gray-200 bg-white hover:border-sky-200 hover:bg-sky-50/40"
                  }`}
                >
                  {formData.shippingType === "air_regular" && (
                    <span className="absolute top-2 end-2 w-5 h-5 bg-sky-500 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <div className={`p-3 rounded-xl ${formData.shippingType === "air_regular" ? "bg-sky-500" : "bg-gray-100"}`}>
                    <Plane className={`h-6 w-6 ${formData.shippingType === "air_regular" ? "text-white" : "text-gray-500"}`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold text-sm ${formData.shippingType === "air_regular" ? "text-sky-700" : "text-gray-700"}`}>ئاسمانی ئاسایی</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Air Regular</p>
                  </div>
                </button>

                {/* Air Irregular */}
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, shippingType: p.shippingType === "air_irregular" ? "" : "air_irregular", volumeCbm: "" }))}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                    formData.shippingType === "air_irregular"
                      ? "border-amber-400 bg-amber-50 shadow-md shadow-amber-100"
                      : "border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                  }`}
                >
                  {formData.shippingType === "air_irregular" && (
                    <span className="absolute top-2 end-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <div className={`p-3 rounded-xl relative ${formData.shippingType === "air_irregular" ? "bg-amber-500" : "bg-gray-100"}`}>
                    <Plane className={`h-6 w-6 ${formData.shippingType === "air_irregular" ? "text-white" : "text-gray-500"}`} />
                    <Zap className={`h-3 w-3 absolute -bottom-0.5 -end-0.5 ${formData.shippingType === "air_irregular" ? "text-yellow-200" : "text-amber-400"}`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold text-sm ${formData.shippingType === "air_irregular" ? "text-amber-700" : "text-gray-700"}`}>ئاسمانی مەرسیدار</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Air Irregular</p>
                  </div>
                </button>

                {/* Sea */}
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, shippingType: p.shippingType === "sea" ? "" : "sea", weightKg: "", dimensionLength: "", dimensionWidth: "", dimensionHeight: "" }))}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-200 ${
                    formData.shippingType === "sea"
                      ? "border-teal-400 bg-teal-50 shadow-md shadow-teal-100"
                      : "border-gray-200 bg-white hover:border-teal-200 hover:bg-teal-50/40"
                  }`}
                >
                  {formData.shippingType === "sea" && (
                    <span className="absolute top-2 end-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  <div className={`p-3 rounded-xl ${formData.shippingType === "sea" ? "bg-teal-500" : "bg-gray-100"}`}>
                    <Ship className={`h-6 w-6 ${formData.shippingType === "sea" ? "text-white" : "text-gray-500"}`} />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold text-sm ${formData.shippingType === "sea" ? "text-teal-700" : "text-gray-700"}`}>دەریایی</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sea Freight</p>
                  </div>
                </button>
              </div>

              {/* Air fields */}
              {(formData.shippingType === "air_regular" || formData.shippingType === "air_irregular") && (
                <div className={`rounded-2xl border-2 overflow-hidden ${formData.shippingType === "air_irregular" ? "border-amber-200" : "border-sky-200"}`}>
                  <div className={`px-4 py-2.5 flex items-center gap-2 ${formData.shippingType === "air_irregular" ? "bg-amber-50" : "bg-sky-50"}`}>
                    <Scale className={`h-4 w-4 ${formData.shippingType === "air_irregular" ? "text-amber-600" : "text-sky-600"}`} />
                    <span className="text-sm font-semibold">کێش و قەبارە</span>
                    <span className="text-xs text-muted-foreground ms-auto">max(ڕاستەقینە، ئەندازەیی)</span>
                  </div>
                  <div className="p-4 space-y-4 bg-white">
                    {/* Weight */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">کێشی ڕاستەقینە (کیلۆگرام)</Label>
                        <div className="relative">
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                          <Input type="number" step="0.01" min="0" value={formData.weightKg}
                            onChange={e => setFormData(p => ({ ...p, weightKg: e.target.value }))}
                            placeholder="0.00" className="pe-10 h-11 font-mono" dir="ltr" />
                        </div>
                      </div>
                      {volumetricKg > 0 && (
                        <div className={`rounded-xl p-3 flex flex-col justify-center ${chargeableKg === volumetricKg ? "bg-amber-50 border border-amber-200" : "bg-sky-50 border border-sky-200"}`}>
                          <p className="text-[11px] text-muted-foreground">کێشی پارەدان</p>
                          <p className={`text-xl font-bold font-mono ${chargeableKg === volumetricKg ? "text-amber-700" : "text-sky-700"}`}>{chargeableKg.toFixed(3)} kg</p>
                          <p className="text-[10px] text-muted-foreground">{chargeableKg === volumetricKg ? "ئەندازەیی" : "ڕاستەقینە"} بە کار هاتووە</p>
                        </div>
                      )}
                    </div>
                    <div>
                      {/* Dimensions */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Ruler className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">قەبارە (سانتیمەتر) — ئارەزووی</Label>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[["dimensionLength", "درێژی (L)"], ["dimensionWidth", "پانی (W)"], ["dimensionHeight", "بەرزی (H)"]].map(([field, label]) => (
                            <div key={field} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{label}</Label>
                              <div className="relative">
                                <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">cm</span>
                                <Input type="number" step="0.1" min="0"
                                  value={formData[field as keyof typeof formData] as string}
                                  onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                                  placeholder="0" className="pe-8 h-10 font-mono text-sm" dir="ltr" />
                              </div>
                            </div>
                          ))}
                        </div>
                        {volumetricKg > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            کێشی ئەندازەیی: ({dimL}×{dimW}×{dimH}) ÷ 6000 = <strong>{volumetricKg.toFixed(3)} kg</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sea fields */}
              {formData.shippingType === "sea" && (
                <div className="rounded-2xl border-2 border-teal-200 overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center gap-2 bg-teal-50">
                    <Calculator className="h-4 w-4 text-teal-600" />
                    <span className="text-sm font-semibold text-teal-800">قەبارەی CBM</span>
                    <span className="text-xs text-muted-foreground ms-auto">١ CBM = ١٠٠cm × ١٠٠cm × ١٠٠cm</span>
                  </div>
                  <div className="p-4 space-y-4 bg-white">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Direct CBM */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">CBM ڕاستەوخۆ</Label>
                        <div className="relative">
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">m³</span>
                          <Input type="number" step="0.0001" min="0" value={formData.volumeCbm}
                            onChange={e => setFormData(p => ({ ...p, volumeCbm: e.target.value }))}
                            placeholder="0.0000" className="pe-10 h-11 font-mono" dir="ltr" />
                        </div>
                        <p className="text-xs text-muted-foreground">ئەگەر CBM دەزانیت</p>
                      </div>
                      {/* Auto CBM from dims */}
                      {autoCbm > 0 && (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex flex-col justify-center">
                          <p className="text-[11px] text-teal-600">CBM خۆکار</p>
                          <p className="text-xl font-bold font-mono text-teal-700">{autoCbm.toFixed(4)} m³</p>
                          <button type="button" onClick={() => setFormData(p => ({ ...p, volumeCbm: autoCbm.toFixed(4) }))}
                            className="text-[11px] text-teal-600 underline text-start mt-1 hover:text-teal-800">
                            بەکاربێنە ←
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Dimensions for CBM calc */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">قەبارە بۆ حساب کردنی CBM — ئارەزووی</Label>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[["dimensionLength", "درێژی (L)"], ["dimensionWidth", "پانی (W)"], ["dimensionHeight", "بەرزی (H)"]].map(([field, label]) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{label}</Label>
                            <div className="relative">
                              <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">cm</span>
                              <Input type="number" step="0.1" min="0"
                                value={formData[field as keyof typeof formData] as string}
                                onChange={e => setFormData(p => ({ ...p, [field]: e.target.value }))}
                                placeholder="0" className="pe-8 h-10 font-mono text-sm" dir="ltr" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>تێبینی</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="تێبینی..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/commission")}>
              پاشگەزبوونەوە
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
              پاشەکەوتکردن
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
