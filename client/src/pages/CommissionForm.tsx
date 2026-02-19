import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, DollarSign, Package, User, Percent, Info, ImageIcon, Check, ChevronsUpDown } from "lucide-react";
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
            <ArrowRight className="h-4 w-4 ml-2" />
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
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                  "mr-2 h-4 w-4",
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>نرخی کاڵا (یەکە) $ *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.itemPriceUsd}
                    onChange={(e) => setFormData({ ...formData, itemPriceUsd: e.target.value })}
                    placeholder="0.00"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">نرخی کاڵاکە</p>
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
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="1"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground mt-1">ژمارەی کاڵا</p>
                </div>
              </div>

              {/* Info about shipping */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">کۆستی گواستنەوە</p>
                  <p className="text-sm text-amber-700">
                    کۆستی گواستنەوە دواتر کاتێک پاکەت چوە ناو باچ حساب دەکرێت بەپێی کێش و نرخی گواستنەوە.
                    <br />
                    <strong>تێبینی:</strong> کۆستی گواستنەوە لەسەر کڕیار دەچێت (نرخی فرۆشتن).
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>نرخی کاڵا (یەکە):</span>
                  <span className="font-medium">${itemPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>عمولەی کڕین:</span>
                  <span className="font-medium text-amber-600">${commissionFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>ژمارە:</span>
                  <span className="font-medium">{quantity}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">کۆی پارەدانی پێشوەخت:</span>
                  <span className="font-bold text-lg text-amber-600">${totalPrepaid.toFixed(2)}</span>
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
