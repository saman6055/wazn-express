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

  // IQD converter state
  const [iqdPurchaseTotal, setIqdPurchaseTotal] = useState("");
  const [iqdSellingTotal, setIqdSellingTotal] = useState("");

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
    purchasePriceUsd: "",
    sellingPriceUsd: "",
    notes: "",
  });

  // IQD exchange rate
  const { data: iqdRateData } = trpc.exchangeRates.getCurrent.useQuery({ currency: "IQD" });
  const iqdRate = parseFloat(iqdRateData?.rate?.toString() || "0");

  const { data: customers } = trpc.customers.list.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();

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
      purchasePriceUsd: formData.purchasePriceUsd || undefined,
      sellingPriceUsd: formData.sellingPriceUsd || undefined,
      notes: formData.notes || undefined,
    });
  };

  // IQD ↔ USD bidirectional handlers
  const qty = parseInt(formData.quantity) || 1;

  const handleIqdPurchaseChange = (val: string) => {
    setIqdPurchaseTotal(val);
    const iqdVal = parseFloat(val) || 0;
    if (iqdVal > 0 && iqdRate > 0) {
      setFormData(prev => ({ ...prev, purchasePriceUsd: (iqdVal / qty / iqdRate).toFixed(4) }));
    } else if (!val) {
      setFormData(prev => ({ ...prev, purchasePriceUsd: "" }));
    }
  };

  const handleUsdPurchaseChange = (val: string) => {
    setFormData(prev => ({ ...prev, purchasePriceUsd: val }));
    const usdVal = parseFloat(val) || 0;
    if (usdVal > 0 && iqdRate > 0) {
      setIqdPurchaseTotal((usdVal * qty * iqdRate).toFixed(0));
    } else {
      setIqdPurchaseTotal("");
    }
  };

  const handleIqdSellingChange = (val: string) => {
    setIqdSellingTotal(val);
    const iqdVal = parseFloat(val) || 0;
    if (iqdVal > 0 && iqdRate > 0) {
      setFormData(prev => ({ ...prev, sellingPriceUsd: (iqdVal / qty / iqdRate).toFixed(4) }));
    } else if (!val) {
      setFormData(prev => ({ ...prev, sellingPriceUsd: "" }));
    }
  };

  const handleUsdSellingChange = (val: string) => {
    setFormData(prev => ({ ...prev, sellingPriceUsd: val }));
    const usdVal = parseFloat(val) || 0;
    if (usdVal > 0 && iqdRate > 0) {
      setIqdSellingTotal((usdVal * qty * iqdRate).toFixed(0));
    } else {
      setIqdSellingTotal("");
    }
  };

  const handleQtyChange = (newQty: string) => {
    const q = parseInt(newQty) || 1;
    // Re-sync IQD fields when quantity changes
    const updatedData: typeof formData = { ...formData, quantity: newQty };
    if (iqdPurchaseTotal && iqdRate > 0) {
      updatedData.purchasePriceUsd = (parseFloat(iqdPurchaseTotal) / q / iqdRate).toFixed(4);
    }
    if (iqdSellingTotal && iqdRate > 0) {
      updatedData.sellingPriceUsd = (parseFloat(iqdSellingTotal) / q / iqdRate).toFixed(4);
    }
    setFormData(updatedData);
  };

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ڕەنگ</Label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="ڕەنگی کاڵا"
                  />
                </div>
                <div className="space-y-2">
                  <Label>قەبارە</Label>
                  <Input
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="قەبارەی کاڵا"
                  />
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
                      onChange={(e) => handleUsdPurchaseChange(e.target.value)}
                      placeholder="0.00"
                      className="pr-8 text-left text-xl font-bold h-14 border-2 border-amber-300 bg-white"
                      dir="ltr"
                    />
                  </div>
                  {iqdPurchaseTotal && iqdRate > 0 && (
                    <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                      <span className="text-[11px] text-orange-600">کۆی ئارئیمبی</span>
                      <span className="text-sm font-bold text-orange-700 font-mono">
                        {Number(iqdPurchaseTotal).toLocaleString("en-US")} ع
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
                      step="0.0001"
                      min="0"
                      value={formData.sellingPriceUsd}
                      onChange={(e) => handleUsdSellingChange(e.target.value)}
                      placeholder="0.00"
                      className="pr-8 text-left text-xl font-bold h-14 border-2 border-emerald-300 bg-white"
                      dir="ltr"
                    />
                  </div>
                  {iqdSellingTotal && iqdRate > 0 && (
                    <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
                      <span className="text-[11px] text-orange-600">کۆی ئارئیمبی</span>
                      <span className="text-sm font-bold text-orange-700 font-mono">
                        {Number(iqdSellingTotal).toLocaleString("en-US")} ع
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-emerald-600">نرخی فرۆشتن بە کڕیار</p>
                </div>
              </div>

              {/* ── IQD Converter Section ── */}
              <div className={`rounded-2xl border-2 overflow-hidden ${iqdRate > 0 ? "border-orange-200" : "border-dashed border-gray-300"}`}>
                {/* Header */}
                <div className="bg-gradient-to-l from-orange-100 to-amber-50 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-500 rounded-lg">
                      <Banknote className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-900 text-sm">گەردانەوەی ئارئیمبی بۆ دۆلار</p>
                      {iqdRate > 0 ? (
                        <p className="text-xs text-orange-700">
                          نرخی بەراورد: ١ دۆلار = {iqdRate.toLocaleString("en-US", { maximumFractionDigits: 0 })} ئارئیمبی
                        </p>
                      ) : (
                        <p className="text-xs text-red-600">تکایە نرخی بەراورد لە سیتینگی سیستەم داخڵ بکە</p>
                      )}
                    </div>
                  </div>
                  {iqdRate > 0 && (
                    <div className="flex items-center gap-1 bg-orange-100 border border-orange-300 rounded-lg px-2.5 py-1 text-xs font-mono text-orange-800">
                      <ArrowLeftRight className="h-3 w-3" />
                      ${(1 / iqdRate).toFixed(5)} = ١ ع
                    </div>
                  )}
                </div>

                {/* Two IQD inputs side by side */}
                <div className="bg-white px-5 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Purchase IQD */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-amber-700">
                        کۆی نرخی کڕین بە ئارئیمبی ({qty} دانە)
                      </Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">ع</span>
                        <Input
                          type="number"
                          min="0"
                          value={iqdPurchaseTotal}
                          onChange={(e) => handleIqdPurchaseChange(e.target.value)}
                          placeholder="٠"
                          className="pe-9 h-12 text-lg font-bold border-2 border-amber-200 focus:border-amber-400 bg-amber-50/30"
                          dir="ltr"
                          disabled={!iqdRate}
                        />
                      </div>
                      {parseFloat(iqdPurchaseTotal) > 0 && iqdRate > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
                            <p className="text-[10px] text-amber-500">١ دانە</p>
                            <p className="font-bold text-amber-700 text-sm font-mono">
                              {(parseFloat(iqdPurchaseTotal) / qty).toLocaleString("en-US", { maximumFractionDigits: 0 })} ع
                            </p>
                          </div>
                          <div className="bg-gradient-to-b from-amber-500 to-orange-500 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-amber-100">$ یەک دانە</p>
                            <p className="font-bold text-white text-sm font-mono">
                              ${(parseFloat(iqdPurchaseTotal) / qty / iqdRate).toFixed(4)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selling IQD */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-emerald-700">
                        کۆی نرخی فرۆشتن بە ئارئیمبی ({qty} دانە)
                      </Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">ع</span>
                        <Input
                          type="number"
                          min="0"
                          value={iqdSellingTotal}
                          onChange={(e) => handleIqdSellingChange(e.target.value)}
                          placeholder="٠"
                          className="pe-9 h-12 text-lg font-bold border-2 border-emerald-200 focus:border-emerald-400 bg-emerald-50/30"
                          dir="ltr"
                          disabled={!iqdRate}
                        />
                      </div>
                      {parseFloat(iqdSellingTotal) > 0 && iqdRate > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                            <p className="text-[10px] text-emerald-500">١ دانە</p>
                            <p className="font-bold text-emerald-700 text-sm font-mono">
                              {(parseFloat(iqdSellingTotal) / qty).toLocaleString("en-US", { maximumFractionDigits: 0 })} ع
                            </p>
                          </div>
                          <div className="bg-gradient-to-b from-emerald-500 to-green-600 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-green-100">$ یەک دانە</p>
                            <p className="font-bold text-white text-sm font-mono">
                              ${(parseFloat(iqdSellingTotal) / qty / iqdRate).toFixed(4)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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
