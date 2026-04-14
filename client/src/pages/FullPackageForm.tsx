import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import CompressedImageUpload from "@/components/CompressedImageUpload";
import {
  ArrowRight,
  Package,
  DollarSign,
  ShoppingBag,
  Save,
  Loader2,
  Link as LinkIcon,
  ImageIcon,
  User,
  TrendingUp,
  Check,
  ChevronsUpDown,
  Banknote,
  ArrowLeftRight,
  Plane,
  Ship,
  Zap,
  Ruler,
  Scale,
  Calculator,
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

export default function FullPackageForm() {
  const [, navigate] = useLocation();
  
  const utils = trpc.useUtils();

  // Customer search state
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);

  // ¥ converter state — purchase only (selling is in USD)
  const [rmbPerUnit, setIqdPerUnit] = useState("");
  const [rmbTotal, setIqdTotal] = useState("");

  const [formData, setFormData] = useState({
    customerId: "",
    supplierId: "",
    orderNumber: "",
    productName: "",
    productLink: "",
    productDescription: "",
    quantity: "1",
    color: "",
    size: "",
    productType: "",
    purchasePriceUsd: "",
    sellingPriceUsd: "",
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

  // Get selected customer
  const selectedCustomer = customers?.find((c) => c.id.toString() === formData.customerId);

  const createMutation = trpc.fullPackage.create.useMutation({
    onSuccess: () => {
      toast.success("پەتی فول پاکیج دروست کرا");
      utils.fullPackage.list.invalidate();
      navigate("/full-package");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerId) {
      toast.error("تکایە کڕیارێک هەڵبژێرە");
      return;
    }

    if (!formData.productName) {
      toast.error("تکایە ناوی کاڵا داخڵ بکە");
      return;
    }

    createMutation.mutate({
      customerId: parseInt(formData.customerId),
      supplierId: formData.supplierId ? parseInt(formData.supplierId) : undefined,
      orderType: "full_package",
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: productImages[0] || undefined,
      productImages: productImages.length > 0 ? productImages : undefined,
      orderNumber: formData.orderNumber || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: parseInt(formData.quantity) || 1,
      color: formData.color || undefined,
      size: formData.size || undefined,
      productType: formData.productType || undefined,
      purchasePriceUsd: formData.purchasePriceUsd || undefined,
      sellingPriceUsd: formData.sellingPriceUsd || undefined,
      notes: formData.notes || undefined,
      shippingType: formData.shippingType || undefined,
      weightKg: formData.weightKg || undefined,
      dimensionLength: formData.dimensionLength || undefined,
      dimensionWidth: formData.dimensionWidth || undefined,
      dimensionHeight: formData.dimensionHeight || undefined,
      volumeCbm: formData.volumeCbm || undefined,
    });
  };

  // 3-way sync: rmbPerUnit ↔ rmbTotal ↔ purchasePriceUsd
  const qty = parseInt(formData.quantity) || 1;

  const syncFromPerUnit = (perUnit: string, q = qty) => {
    const v = parseFloat(perUnit) || 0;
    setIqdPerUnit(perUnit);
    setIqdTotal(v > 0 ? (v * q).toFixed(0) : "");
    setFormData(prev => ({ ...prev, purchasePriceUsd: v > 0 && rmbRate > 0 ? (v / rmbRate).toFixed(4) : "" }));
  };

  const syncFromTotal = (total: string, q = qty) => {
    const v = parseFloat(total) || 0;
    setIqdTotal(total);
    setIqdPerUnit(v > 0 && q > 0 ? (v / q).toFixed(0) : "");
    setFormData(prev => ({ ...prev, purchasePriceUsd: v > 0 && q > 0 && rmbRate > 0 ? (v / q / rmbRate).toFixed(4) : "" }));
  };

  const syncFromUsd = (usd: string, q = qty) => {
    setFormData(prev => ({ ...prev, purchasePriceUsd: usd }));
    const v = parseFloat(usd) || 0;
    if (v > 0 && rmbRate > 0) {
      const perUnit = v * rmbRate;
      setIqdPerUnit(perUnit.toFixed(0));
      setIqdTotal((perUnit * q).toFixed(0));
    } else {
      setIqdPerUnit(""); setIqdTotal("");
    }
  };

  const handleQtyChange = (newQty: string) => {
    const q = parseInt(newQty) || 1;
    // Re-sync from whichever ¥ field is active
    if (rmbPerUnit) {
      syncFromPerUnit(rmbPerUnit, q);
      setFormData(prev => ({ ...prev, quantity: newQty }));
    } else if (rmbTotal) {
      syncFromTotal(rmbTotal, q);
      setFormData(prev => ({ ...prev, quantity: newQty }));
    } else {
      setFormData(prev => ({ ...prev, quantity: newQty }));
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

  // Calculate gross profit
  const purchasePrice = parseFloat(formData.purchasePriceUsd) || 0;
  const sellingPrice = parseFloat(formData.sellingPriceUsd) || 0;
  const grossProfit = sellingPrice - purchasePrice;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/full-package")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ShoppingBag className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">پەتی فول پاکیجی نوێ</h1>
              <p className="text-muted-foreground">کڕین و فرۆشتنەوە بە قازانج</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection with Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600" />
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

          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                زانیاری کاڵا
              </CardTitle>
              <CardDescription>زانیاری کاڵاکە داخڵ بکە</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ناوی کاڵا *</Label>
                  <Input
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="ناوی کاڵا"
                  />
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
                  accentColor="emerald"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                {/* Product Type */}
                <div className="space-y-2">
                  <Label>جۆری کاڵا</Label>
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

          {/* Pricing with Quantity */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-l from-emerald-50 to-green-50 border-b">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                نرخەکان و عەدەد
              </CardTitle>
              <CardDescription>
                نرخی کڕین و فرۆشتن داخڵ بکە - کۆستی گواستنەوە دواتر کاتی باچ حساب دەکرێت
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Quantity and Prices in one row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Quantity */}
                <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                  <Label className="text-sm font-medium text-slate-600 mb-2 block">عەدەد</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full"
                      onClick={() => handleQtyChange(Math.max(1, parseInt(formData.quantity) - 1).toString())}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => handleQtyChange(e.target.value)}
                      className="text-center text-2xl font-bold h-14 border-2"
                      dir="ltr"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-full"
                      onClick={() => handleQtyChange((parseInt(formData.quantity) + 1).toString())}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Purchase Price */}
                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200 space-y-2">
                  <Label className="text-sm font-medium text-amber-700 block">نرخی کڕین (یەک عەدەد)</Label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold">$</span>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={formData.purchasePriceUsd}
                      onChange={(e) => syncFromUsd(e.target.value)}
                      placeholder="0.00"
                      className="pr-8 text-left text-xl font-bold h-14 border-2 border-amber-300 bg-white"
                      dir="ltr"
                    />
                  </div>
                  {rmbPerUnit && rmbRate > 0 && (
                    <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                      <span className="text-[11px] text-orange-600">١ دانە بە یوانی چینی</span>
                      <span className="text-sm font-bold text-orange-700 font-mono">
                        {Number(rmbPerUnit).toLocaleString("en-US")} ¥
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-amber-600">نرخی کاڵا لە چین</p>
                </div>

                {/* Selling Price */}
                <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200 space-y-2">
                  <Label className="text-sm font-medium text-emerald-700 block">نرخی فرۆشتن (یەک عەدەد)</Label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sellingPriceUsd}
                      onChange={(e) => setFormData(prev => ({ ...prev, sellingPriceUsd: e.target.value }))}
                      placeholder="0.00"
                      className="pr-8 text-left text-xl font-bold h-14 border-2 border-emerald-300 bg-white"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-xs text-emerald-600">نرخی فرۆشتن بە کڕیار — بە دۆلار</p>
                </div>
              </div>

              {/* ── ¥ Converter Section (Purchase only) ── */}
              <div className={`rounded-2xl border-2 overflow-hidden ${rmbRate > 0 ? "border-orange-200" : "border-dashed border-gray-300"}`}>
                {/* Header */}
                <div className="bg-gradient-to-l from-orange-100 to-amber-50 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500 rounded-lg">
                      <Banknote className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-900 text-sm">نرخی کڕین بە یوانی چینی</p>
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

                {/* Two ¥ inputs: per-unit and total */}
                <div className="bg-white px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Per-unit ¥ */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-amber-700">نرخی ١ دانە بە یوانی چینی</Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                        <Input
                          type="number"
                          min="0"
                          value={rmbPerUnit}
                          onChange={(e) => syncFromPerUnit(e.target.value)}
                          placeholder="٠"
                          className="pe-9 h-12 text-lg font-bold border-2 border-amber-200 focus:border-orange-400 bg-amber-50/40"
                          dir="ltr"
                          
                        />
                      </div>
                      <p className="text-xs text-amber-500">نرخی یەک دانەی کاڵا</p>
                    </div>

                    {/* Total ¥ */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-orange-700">کۆی نرخ بە یوانی چینی ({qty} دانە)</Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">¥</span>
                        <Input
                          type="number"
                          min="0"
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

                  {/* Result row */}
                  {(parseFloat(rmbPerUnit) > 0 || parseFloat(rmbTotal) > 0) && (
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">١ دانە یوانی چینی</p>
                        <p className="font-bold text-amber-700 font-mono">
                          {Number(rmbPerUnit || 0).toLocaleString("en-US")} ¥
                        </p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                        <p className="text-[10px] text-orange-500 uppercase tracking-wide mb-1">کۆی {qty} دانە</p>
                        <p className="font-bold text-orange-700 font-mono">
                          {Number(rmbTotal || 0).toLocaleString("en-US")} ¥
                        </p>
                      </div>
                      <div className="bg-gradient-to-b from-amber-500 to-orange-500 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-[10px] text-amber-100 uppercase tracking-wide mb-1">نرخی $ یەک دانە</p>
                        <p className="font-bold text-white font-mono text-base">
                          ${formData.purchasePriceUsd || "0.0000"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Profit Preview with Quantity */}
              {(purchasePrice > 0 || sellingPrice > 0) && (
                <div className="bg-gradient-to-l from-emerald-100 via-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-emerald-300 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-500 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-bold text-lg text-emerald-800">پێشبینی قازانج</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-full border-2 border-emerald-300">
                      <span className="text-emerald-700 font-bold">{formData.quantity || 1} عەدەد</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Unit Purchase Price */}
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">نرخی کڕین (١ عەدەد)</p>
                      <p className="text-xl font-bold text-amber-600">${purchasePrice.toFixed(2)}</p>
                    </div>
                    
                    {/* Total Purchase Price */}
                    <div className="bg-amber-100 rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-amber-700 mb-1">کۆی کڕین ({formData.quantity || 1} عەدەد)</p>
                      <p className="text-xl font-bold text-amber-700">${(purchasePrice * (parseInt(formData.quantity) || 1)).toFixed(2)}</p>
                    </div>
                    
                    {/* Unit Selling Price */}
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-slate-500 mb-1">نرخی فرۆشتن (١ عەدەد)</p>
                      <p className="text-xl font-bold text-emerald-600">${sellingPrice.toFixed(2)}</p>
                    </div>
                    
                    {/* Total Selling Price */}
                    <div className="bg-emerald-200 rounded-xl p-4 text-center shadow-sm">
                      <p className="text-xs text-emerald-700 mb-1">کۆی فرۆشتن ({formData.quantity || 1} عەدەد)</p>
                      <p className="text-xl font-bold text-emerald-700">${(sellingPrice * (parseInt(formData.quantity) || 1)).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  {/* Profit Summary */}
                  <div className="mt-4 pt-4 border-t-2 border-emerald-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-emerald-700">قازانجی خاو (بەبێ گواستنەوە)</p>
                        <p className="text-xs text-slate-500">({sellingPrice.toFixed(2)} - {purchasePrice.toFixed(2)}) × {formData.quantity || 1}</p>
                      </div>
                      <div className={`text-3xl font-bold ${grossProfit * (parseInt(formData.quantity) || 1) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${(grossProfit * (parseInt(formData.quantity) || 1)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-center text-emerald-600 mt-3 bg-white/50 rounded-lg py-2">
                    💡 قازانجی خاوێن = قازانجی خاو - کۆستی گواستنەوە (دواتر کاتی باچ حساب دەکرێت)
                  </p>
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
                    <span className="text-xs text-muted-foreground ms-auto">کێشی پارەدان = max(ڕاستەقینە، ئەندازەیی)</span>
                  </div>
                  <div className="p-4 space-y-4 bg-white">
                    {/* Weight */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">کێشی ڕاستەقینە (کیلۆگرام)</Label>
                        <div className="relative">
                          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">kg</span>
                          <Input type="number" step="0.01" min="0" value={formData.weightKg}
                            onChange={e => setFormData(p => ({ ...p, weightKg: e.target.value }))}
                            placeholder="0.00" className="pe-10 h-11 font-mono" dir="ltr" />
                        </div>
                      </div>
                      {volumetricKg > 0 && (
                        <div className={`rounded-xl p-3 flex flex-col justify-center ${chargeableKg === volumetricKg ? "bg-amber-50 border border-amber-200" : "bg-sky-50 border border-sky-200"}`}>
                          <p className="text-[11px] text-muted-foreground">کێشی پارەدان</p>
                          <p className={`text-xl font-bold font-mono ${chargeableKg === volumetricKg ? "text-amber-700" : "text-sky-700"}`}>
                            {chargeableKg.toFixed(3)} kg
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {chargeableKg === volumetricKg ? "ئەندازەیی" : "ڕاستەقینە"} بە کار هاتووە
                          </p>
                        </div>
                      )}
                    </div>

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
            <Button type="button" variant="outline" onClick={() => navigate("/full-package")}>
              پاشگەزبوونەوە
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
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
