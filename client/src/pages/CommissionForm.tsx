import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, DollarSign, Package, User, Percent, Info, ImageIcon, Check, ChevronsUpDown, Banknote, ArrowLeftRight, RefreshCw } from "lucide-react";
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

  // IQD converter state
  const [iqdPerUnit, setIqdPerUnit] = useState("");
  const [iqdTotal, setIqdTotal] = useState("");

  // Form state
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
    // Commission pricing
    itemPriceUsd: "",
    commissionFeeUsd: "",
  });

  // IQD exchange rate
  const { data: iqdRateData } = trpc.exchangeRates.getCurrent.useQuery({ currency: "IQD" });
  const iqdRate = parseFloat(iqdRateData?.rate?.toString() || "0");

  // Fetch customers and suppliers
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

  // Get selected customer name
  const selectedCustomer = customers?.find((c) => c.id.toString() === formData.customerId);

  // Create mutation
  const createMutation = trpc.fullPackage.create.useMutation({
    onSuccess: () => {
      toast.success("پەتی عمولە بە سەرکەوتوویی دروست کرا");
      utils.fullPackage.list.invalidate();
      setLocation("/commission");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 3-way sync: iqdPerUnit ↔ iqdTotal ↔ itemPriceUsd
  const qty = parseInt(formData.quantity) || 1;

  const syncFromPerUnit = (perUnit: string, q = qty) => {
    const v = parseFloat(perUnit) || 0;
    setIqdPerUnit(perUnit);
    setIqdTotal(v > 0 ? (v * q).toFixed(0) : "");
    setFormData(prev => ({ ...prev, itemPriceUsd: v > 0 && iqdRate > 0 ? (v / iqdRate).toFixed(4) : "" }));
  };

  const syncFromTotal = (total: string, q = qty) => {
    const v = parseFloat(total) || 0;
    setIqdTotal(total);
    setIqdPerUnit(v > 0 && q > 0 ? (v / q).toFixed(0) : "");
    setFormData(prev => ({ ...prev, itemPriceUsd: v > 0 && q > 0 && iqdRate > 0 ? (v / q / iqdRate).toFixed(4) : "" }));
  };

  const syncFromUsd = (usd: string, q = qty) => {
    setFormData(prev => ({ ...prev, itemPriceUsd: usd }));
    const v = parseFloat(usd) || 0;
    if (v > 0 && iqdRate > 0) {
      const perUnit = v * iqdRate;
      setIqdPerUnit(perUnit.toFixed(0));
      setIqdTotal((perUnit * q).toFixed(0));
    } else {
      setIqdPerUnit(""); setIqdTotal("");
    }
  };

  const handleQuantityChange = (val: string) => {
    const q = parseInt(val) || 1;
    if (iqdPerUnit) {
      syncFromPerUnit(iqdPerUnit, q);
      setFormData(prev => ({ ...prev, quantity: val }));
    } else if (iqdTotal) {
      syncFromTotal(iqdTotal, q);
      setFormData(prev => ({ ...prev, quantity: val }));
    } else {
      setFormData(prev => ({ ...prev, quantity: val }));
    }
  };

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

    if (!formData.productName) {
      toast.error("تکایە ناوی کاڵا داخڵ بکە");
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

    createMutation.mutate({
      customerId: parseInt(formData.customerId),
      supplierId: formData.supplierId && formData.supplierId !== "none" ? parseInt(formData.supplierId) : undefined,

      orderType: "commission",
      productName: formData.productName,
      productLink: formData.productLink || undefined,
      productImage: productImages[0] || undefined,
      productImages: productImages.length > 0 ? productImages : undefined,
      orderNumber: formData.orderNumber || undefined,
      productDescription: formData.productDescription || undefined,
      quantity: quantity,
      color: formData.color || undefined,
      size: formData.size || undefined,
      itemPriceUsd: formData.itemPriceUsd,
      commissionFeeUsd: formData.commissionFeeUsd,
      totalPrepaidUsd: totalPrepaid.toFixed(2),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/commission")}
            className="mb-4"
          >
            <ArrowRight className="h-4 w-4 ms-2" />
            گەڕانەوە
          </Button>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500 text-white mb-4">
              <Percent className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">پەتی عمولەی نوێ</h1>
            <p className="text-gray-600 mt-2">کڕیار نرخ دەزانێت، کۆمپانیا تەنها عمولە وەردەگرێت</p>
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
              <div>
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
                        placeholder="گەڕان بە ناو یان کۆد..."
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

              <div>
                <Label>فرۆشیار (ئارەزوومەندانە)</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="فرۆشیارێک هەڵبژێرە" />
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
                <div>
                  <Label>ناوی کاڵا *</Label>
                  <Input
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="ناوی کاڵا"
                  />
                </div>
                <div>
                  <Label>ئۆردەر نەمبەر</Label>
                  <Input
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    placeholder="ژمارەی ئۆردەر"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <Label>لینکی کاڵا</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ڕەنگ</Label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="ڕەنگ"
                  />
                </div>
                <div>
                  <Label>قەبارە</Label>
                  <Input
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="قەبارە"
                  />
                </div>
              </div>

              <div>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
                نرخەکان
              </CardTitle>
              <CardDescription>نرخی کاڵا و عمولەی کۆمپانیا</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* USD Price Row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>نرخی کاڵا (یەکە) $ *</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formData.itemPriceUsd}
                    onChange={(e) => syncFromUsd(e.target.value)}
                    placeholder="0.00"
                    dir="ltr"
                  />
                  {iqdPerUnit && iqdRate > 0 && (
                    <p className="text-[11px] text-orange-500 font-mono mt-1">≈ {Number(iqdPerUnit).toLocaleString("en-US")} IQD</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">نرخی هەر دانەیەک</p>
                </div>
                <div>
                  <Label>عموڵەی کڕین $ *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.commissionFeeUsd}
                    onChange={(e) => setFormData({ ...formData, commissionFeeUsd: e.target.value })}
                    placeholder="0.00"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">عموڵەی کۆمپانیا</p>
                </div>
                <div>
                  <Label>ژمارە *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder="1"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">ژمارەی کاڵا</p>
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
                      <p className="font-bold text-orange-900 text-sm">نرخی کاڵا بە ئارئیمبی</p>
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
                      ${(1 / iqdRate).toFixed(5)} = ١ IQD
                    </div>
                  )}
                </div>

                {/* Two IQD inputs + result */}
                <div className="bg-white px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Per-unit IQD */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-amber-700">نرخی ١ دانە بە ئارئیمبی</Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">IQD</span>
                        <Input
                          type="number"
                          min="0"
                          value={iqdPerUnit}
                          onChange={(e) => syncFromPerUnit(e.target.value)}
                          placeholder="٠"
                          className="pe-9 h-12 text-lg font-bold border-2 border-amber-200 focus:border-orange-400 bg-amber-50/40"
                          dir="ltr"
                          
                        />
                      </div>
                      <p className="text-xs text-amber-500">نرخی یەک دانەی کاڵا</p>
                    </div>

                    {/* Total IQD */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold text-orange-700">کۆی نرخ بە ئارئیمبی ({quantity} دانە)</Label>
                      <div className="relative">
                        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-orange-500 font-bold select-none">IQD</span>
                        <Input
                          type="number"
                          min="0"
                          value={iqdTotal}
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
                  {(parseFloat(iqdPerUnit) > 0 || parseFloat(iqdTotal) > 0) && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">١ دانە ئارئیمبی</p>
                        <p className="font-bold text-amber-700 font-mono">{Number(iqdPerUnit || 0).toLocaleString("en-US")} IQD</p>
                      </div>
                      <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                        <p className="text-[10px] text-orange-500 uppercase tracking-wide mb-1">کۆی {quantity} دانە</p>
                        <p className="font-bold text-orange-700 font-mono">{Number(iqdTotal || 0).toLocaleString("en-US")} IQD</p>
                      </div>
                      <div className="bg-gradient-to-b from-amber-500 to-orange-500 rounded-xl p-3 text-center shadow-sm">
                        <p className="text-[10px] text-amber-100 uppercase tracking-wide mb-1">نرخی $ یەک دانە</p>
                        <p className="font-bold text-white font-mono text-base">${formData.itemPriceUsd || "0.0000"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info about shipping */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">کۆستی گواستنەوە</p>
                  <p className="text-sm text-amber-700">
                    کۆستی گواستنەوە دواتر کاتێک پاکەت چوە ناو باچ حساب دەکرێت.
                    <br />
                    <strong>تێبینی:</strong> کۆستی گواستنەوە لەسەر کڕیار دەچێت.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">نرخی کاڵا (یەکە):</span>
                  <div className="text-right">
                    <span className="font-medium">${itemPrice.toFixed(4)}</span>
                    {iqdPerUnit && iqdRate > 0 && (
                      <p className="text-[10px] text-orange-500 font-mono">
                        ≈ {Number(iqdPerUnit).toLocaleString("en-US")} IQD
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">عمولەی کڕین:</span>
                  <span className="font-medium text-amber-600">${commissionFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ژمارە:</span>
                  <span className="font-medium">{quantity}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">کۆی پارەدانی پێشوەخت:</span>
                  <div className="text-right">
                    <span className="font-bold text-lg text-amber-600">${totalPrepaid.toFixed(2)}</span>
                    {iqdTotal && iqdRate > 0 && (
                      <p className="text-xs text-orange-500 font-mono">
                        ≈ {(totalPrepaid * iqdRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} IQD
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>قازانج (عمولە):</span>
                  <span className="font-medium">${(commissionFee * quantity).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full bg-amber-500 hover:bg-amber-600"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "چاوەڕوان بە..." : "دروستکردنی پەت"}
          </Button>
        </form>
      </div>
    </div>
  );
}
