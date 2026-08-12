import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { Crown, Plus, Edit, Trash2, Users, Percent, DollarSign, CreditCard, Sparkles, Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

export default function VipCustomers() {
    const { t, language } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedVip, setSelectedVip] = useState<any>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  // Searchable customer picker — the plain dropdown was unusable once the
  // customer list grew; staff look people up by customer code.
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: vipCustomers, refetch } = trpc.vip.list.useQuery();
  const { data: customers } = trpc.customers.list.useQuery();
  
  const createMutation = trpc.vip.create.useMutation({
    onSuccess: () => {
      toast.success(t("toast.vipCustomerCreated"));
      setIsCreateOpen(false);
      setSelectedCustomerId("");
      setCustomerSearch("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateMutation = trpc.vip.update.useMutation({
    onSuccess: () => {
      toast.success(t("toast.vipCustomerUpdated"));
      setIsEditOpen(false);
      setSelectedVip(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const deleteMutation = trpc.vip.delete.useMutation({
    onSuccess: () => {
      toast.success(t("toast.vipStatusRemoved"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Get customers who are not already VIP
  const availableCustomers = customers?.filter(c =>
    !vipCustomers?.some(v => v.customerId === c.id)
  );

  // Narrow by customer code, name, or mobile. Matching happens here rather
  // than in <Command>'s own filter so a code search hits the code field
  // exactly instead of fuzzy-matching the rendered label.
  const filteredCustomers = (availableCustomers || []).filter((c: any) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    const name = (c.fullName || c.fullNameKurdish || "").toLowerCase();
    const code = (c.customerCode || "").toLowerCase();
    const phone = (c.mobileNumber || "").toLowerCase();
    return name.includes(q) || code.includes(q) || phone.includes(q);
  });

  const selectedCustomer = availableCustomers?.find(
    (c: any) => c.id.toString() === selectedCustomerId,
  );

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      customerId: parseInt(selectedCustomerId),
      tier: formData.get("tier") as "silver" | "gold" | "platinum",
      discountPercent: formData.get("discountPercent") as string || undefined,
      fixedPricePerKgAir: formData.get("fixedPricePerKgAir") as string || undefined,
      fixedPricePerKgSea: formData.get("fixedPricePerKgSea") as string || undefined,
      creditLimitUsd: formData.get("creditLimitUsd") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedVip) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedVip.id,
      tier: formData.get("tier") as "silver" | "gold" | "platinum",
      discountPercent: formData.get("discountPercent") as string || undefined,
      fixedPricePerKgAir: formData.get("fixedPricePerKgAir") as string || undefined,
      fixedPricePerKgSea: formData.get("fixedPricePerKgSea") as string || undefined,
      creditLimitUsd: formData.get("creditLimitUsd") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'from-slate-600 to-slate-800';
      case 'gold': return 'from-amber-400 to-orange-500';
      default: return 'from-slate-300 to-slate-400';
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'bg-gradient-to-r from-slate-600 to-slate-800 text-white';
      case 'gold': return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white';
      default: return 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-700 dark:text-slate-300';
    }
  };

  const silverCount = vipCustomers?.filter(v => v.tier === 'silver').length || 0;
  const goldCount = vipCustomers?.filter(v => v.tier === 'gold').length || 0;
  const platinumCount = vipCustomers?.filter(v => v.tier === 'platinum').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-6 w-6" />
                <span className="text-sm font-medium opacity-90">{pickLang(language, { ku: "ئەندامانی تایبەت", en: "Premium Members", ar: "أعضاء مميزون", zh: "尊享会员" })}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{pickLang(language, { ku: "کڕیارانی VIP", en: "VIP Customers", ar: "عملاء VIP", zh: "VIP 客户" })}</h1>
              <p className="text-white/80 max-w-lg">
                {pickLang(language, { ku: "بەڕێوەبردنی کڕیارانی تایبەت بە نرخ و سوودی تایبەت", en: "Manage premium customers with special pricing and benefits", ar: "إدارة العملاء المميزين بأسعار ومزايا خاصة", zh: "管理享有专属价格和权益的尊享客户" })}
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white dark:bg-card text-amber-600 dark:text-amber-300 hover:bg-white/90 shadow-lg">
                  <Plus className="h-4 w-4 me-2" />
                  {pickLang(language, { ku: "زیادکردنی VIP", en: "Add VIP", ar: "إضافة VIP", zh: "添加 VIP" })}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                    {pickLang(language, { ku: "زیادکردنی کڕیاری VIP", en: "Add VIP Customer", ar: "إضافة عميل VIP", zh: "添加 VIP 客户" })}
                  </DialogTitle>
                  <DialogDescription>
                    {pickLang(language, { ku: "پێدانی دۆخی VIP بە کڕیارێک بە نرخی تایبەت", en: "Grant VIP status to a customer with special pricing", ar: "منح حالة VIP لعميل بأسعار خاصة", zh: "授予客户 VIP 身份并提供专属价格" })}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "کڕیار هەڵبژێرە *", en: "Select Customer *", ar: "اختر العميل *", zh: "选择客户 *" })}</Label>
                      <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={customerOpen}
                            className="w-full justify-between h-11 font-normal"
                          >
                            {selectedCustomer
                              ? `${(selectedCustomer as any).fullName || (selectedCustomer as any).fullNameKurdish} (${(selectedCustomer as any).customerCode})`
                              : pickLang(language, { ku: "کڕیارێک هەڵبژێرە", en: "Choose a customer", ar: "اختر عميلاً", zh: "选择一个客户" })}
                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent variant="panel" className="w-[--radix-popover-trigger-width] p-0" align="start">
                          {/* shouldFilter={false} — we filter above so a code
                              search matches the code field, not the label. */}
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder={pickLang(language, { ku: "گەڕان بە کۆد، ناو یان مۆبایل...", en: "Search by code, name, or mobile...", ar: "البحث بالرمز أو الاسم أو الجوال...", zh: "按编号、姓名或手机搜索..." })}
                              value={customerSearch}
                              onValueChange={setCustomerSearch}
                            />
                            <CommandList>
                              <CommandEmpty>{pickLang(language, { ku: "کڕیار نەدۆزرایەوە", en: "No customer found", ar: "لم يُعثر على عميل", zh: "未找到客户" })}</CommandEmpty>
                              <CommandGroup>
                                {filteredCustomers.map((customer: any) => (
                                  <CommandItem
                                    key={customer.id}
                                    value={customer.id.toString()}
                                    onSelect={() => {
                                      setSelectedCustomerId(customer.id.toString());
                                      setCustomerOpen(false);
                                      setCustomerSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "me-2 h-4 w-4",
                                        selectedCustomerId === customer.id.toString() ? "opacity-100" : "opacity-0",
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{customer.fullName || customer.fullNameKurdish}</span>
                                      <span className="text-xs text-muted-foreground font-mono" dir="ltr">{customer.customerCode}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="tier">{pickLang(language, { ku: "ئاستی VIP *", en: "VIP Tier *", ar: "فئة VIP *", zh: "VIP 等级 *" })}</Label>
                      <Select name="tier" defaultValue="silver">
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="silver">🥈 {pickLang(language, { ku: "زیو", en: "Silver", ar: "فضي", zh: "白银" })}</SelectItem>
                          <SelectItem value="gold">🥇 {pickLang(language, { ku: "زێڕ", en: "Gold", ar: "ذهبي", zh: "黄金" })}</SelectItem>
                          <SelectItem value="platinum">💎 {pickLang(language, { ku: "پلاتین", en: "Platinum", ar: "بلاتيني", zh: "铂金" })}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="discountPercent">{pickLang(language, { ku: "داشکاندن ٪", en: "Discount %", ar: "نسبة الخصم ٪", zh: "折扣 %" })}</Label>
                        <Input id="discountPercent" name="discountPercent" type="number" step="0.01" min="0" max="100" className="h-11" placeholder={pickLang(language, { ku: "نموونە: ١٠", en: "e.g. 10", ar: "مثال: ١٠", zh: "例如 10" })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="creditLimitUsd">{pickLang(language, { ku: "سنووری قەرز ($)", en: "Credit Limit ($)", ar: "حد الائتمان ($)", zh: "信用额度 ($)" })}</Label>
                        <Input id="creditLimitUsd" name="creditLimitUsd" type="number" step="0.01" min="0" className="h-11" placeholder={pickLang(language, { ku: "نموونە: ١٠٠٠", en: "e.g. 1000", ar: "مثال: ١٠٠٠", zh: "例如 1000" })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="fixedPricePerKgAir">{pickLang(language, { ku: "نرخی جێگیر/کگ (ئاسمانی)", en: "Fixed Price/KG (Air)", ar: "سعر ثابت/كغ (جوي)", zh: "固定单价/公斤（空运）" })}</Label>
                        <Input id="fixedPricePerKgAir" name="fixedPricePerKgAir" type="number" step="0.01" min="0" className="h-11" placeholder={pickLang(language, { ku: "نموونە: ٥٫٠٠", en: "e.g. 5.00", ar: "مثال: ٥٫٠٠", zh: "例如 5.00" })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="fixedPricePerKgSea">{pickLang(language, { ku: "نرخی جێگیر/کگ (دەریایی)", en: "Fixed Price/KG (Sea)", ar: "سعر ثابت/كغ (بحري)", zh: "固定单价/公斤（海运）" })}</Label>
                        <Input id="fixedPricePerKgSea" name="fixedPricePerKgSea" type="number" step="0.01" min="0" className="h-11" placeholder={pickLang(language, { ku: "نموونە: ٢٫٠٠", en: "e.g. 2.00", ar: "مثال: ٢٫٠٠", zh: "例如 2.00" })} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">{pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}</Label>
                      <Input id="notes" name="notes" className="h-11" placeholder={pickLang(language, { ku: "هەر تێبینییەکی تایبەت...", en: "Any special notes...", ar: "أي ملاحظات خاصة...", zh: "任何特殊备注..." })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      {pickLang(language, { ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || !selectedCustomerId} className="bg-amber-500 hover:bg-amber-600">
                      {createMutation.isPending ? pickLang(language, { ku: "دروستکردن...", en: "Creating...", ar: "جارٍ الإنشاء...", zh: "创建中..." }) : pickLang(language, { ku: "زیادکردنی VIP", en: "Add VIP", ar: "إضافة VIP", zh: "添加 VIP" })}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "کۆی VIP", en: "Total VIP", ar: "إجمالي VIP", zh: "VIP 总数" })}</p>
                  <p className="text-3xl font-bold">{vipCustomers?.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                  <Crown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "زیو", en: "Silver", ar: "فضي", zh: "白银" })}</p>
                  <p className="text-3xl font-bold text-slate-500 dark:text-slate-400">{silverCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "زێڕ", en: "Gold", ar: "ذهبي", zh: "黄金" })}</p>
                  <p className="text-3xl font-bold text-amber-500 dark:text-amber-400">{goldCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{pickLang(language, { ku: "پلاتین", en: "Platinum", ar: "بلاتيني", zh: "铂金" })}</p>
                  <p className="text-3xl font-bold text-slate-600 dark:text-slate-300">{platinumCount}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* VIP List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vipCustomers?.map((vip) => {
            const customer = customers?.find(c => c.id === vip.customerId);
            return (
              <Card key={vip.id} className="border-0 shadow-lg overflow-hidden hover:shadow-xl transition-all group">
                <div className={`h-2 bg-gradient-to-r ${getTierColor(vip.tier)}`} />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getTierColor(vip.tier)} flex items-center justify-center text-white shadow-lg`}>
                        <Crown className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold">{customer?.fullName || `Customer #${vip.customerId}`}</p>
                        <Badge className={`text-xs border-0 ${getTierBadgeClass(vip.tier)}`}>
                          {vip.tier.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedVip(vip);
                          setIsEditOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(pickLang(language, { ku: "دۆخی VIP لەم کڕیارە بسڕیتەوە؟", en: "Remove VIP status from this customer?", ar: "إزالة حالة VIP من هذا العميل؟", zh: "移除此客户的 VIP 身份？" }))) {
                            deleteMutation.mutate({ id: vip.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <Percent className="h-4 w-4" />
                        <span className="text-xs font-medium">{pickLang(language, { ku: "داشکاندن", en: "Discount", ar: "خصم", zh: "折扣" })}</span>
                      </div>
                      <p className="font-bold text-lg">{vip.discountPercent || 0}%</p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                        <CreditCard className="h-4 w-4" />
                        <span className="text-xs font-medium">{pickLang(language, { ku: "سنووری قەرز", en: "Credit Limit", ar: "حد الائتمان", zh: "信用额度" })}</span>
                      </div>
                      <p className="font-bold text-lg">${vip.creditLimitUsd || 0}</p>
                    </div>
                    {vip.fixedPricePerKgAir && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">{pickLang(language, { ku: "ئاسمانی/کگ", en: "Air/KG", ar: "جوي/كغ", zh: "空运/公斤" })}</span>
                        </div>
                        <p className="font-bold text-lg">${vip.fixedPricePerKgAir}</p>
                      </div>
                    )}
                    {vip.fixedPricePerKgSea && (
                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium">{pickLang(language, { ku: "دەریایی/کگ", en: "Sea/KG", ar: "بحري/كغ", zh: "海运/公斤" })}</span>
                        </div>
                        <p className="font-bold text-lg">${vip.fixedPricePerKgSea}</p>
                      </div>
                    )}
                  </div>
                  
                  {vip.notes && (
                    <p className="text-sm text-muted-foreground mt-4 p-3 rounded-lg bg-muted/50">
                      {vip.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
          
          {(!vipCustomers || vipCustomers.length === 0) && (
            <Card className="col-span-full border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Crown className="h-16 w-16 mx-auto mb-4 text-amber-300" />
                <h3 className="text-lg font-semibold mb-2">{pickLang(language, { ku: "هێشتا هیچ کڕیارێکی VIP نییە", en: "No VIP Customers Yet", ar: "لا يوجد عملاء VIP بعد", zh: "暂无 VIP 客户" })}</h3>
                <p className="text-muted-foreground mb-4">
                  {pickLang(language, { ku: "یەکەم کڕیاری VIPت زیاد بکە بۆ پێدانی نرخ و سوودی تایبەت", en: "Add your first VIP customer to grant them special pricing and benefits", ar: "أضف أول عميل VIP لمنحه أسعارًا ومزايا خاصة", zh: "添加您的第一个 VIP 客户，为其提供专属价格和权益" })}
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600">
                  <Plus className="h-4 w-4 me-2" />
                  {pickLang(language, { ku: "زیادکردنی یەکەم VIP", en: "Add First VIP", ar: "إضافة أول VIP", zh: "添加首位 VIP" })}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                {pickLang(language, { ku: "دەستکاری کڕیاری VIP", en: "Edit VIP Customer", ar: "تعديل عميل VIP", zh: "编辑 VIP 客户" })}
              </DialogTitle>
              <DialogDescription>
                {pickLang(language, { ku: "نوێکردنەوەی نرخ و سوودی VIP", en: "Update VIP pricing and benefits", ar: "تحديث أسعار ومزايا VIP", zh: "更新 VIP 价格和权益" })}
              </DialogDescription>
            </DialogHeader>
            {selectedVip && (
              <form onSubmit={handleUpdate}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-tier">{pickLang(language, { ku: "ئاستی VIP *", en: "VIP Tier *", ar: "فئة VIP *", zh: "VIP 等级 *" })}</Label>
                    <Select name="tier" defaultValue={selectedVip.tier}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="silver">🥈 {pickLang(language, { ku: "زیو", en: "Silver", ar: "فضي", zh: "白银" })}</SelectItem>
                        <SelectItem value="gold">🥇 {pickLang(language, { ku: "زێڕ", en: "Gold", ar: "ذهبي", zh: "黄金" })}</SelectItem>
                        <SelectItem value="platinum">💎 {pickLang(language, { ku: "پلاتین", en: "Platinum", ar: "بلاتيني", zh: "铂金" })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-discountPercent">{pickLang(language, { ku: "داشکاندن ٪", en: "Discount %", ar: "نسبة الخصم ٪", zh: "折扣 %" })}</Label>
                      <Input id="edit-discountPercent" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={selectedVip.discountPercent || ""} className="h-11" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-creditLimitUsd">{pickLang(language, { ku: "سنووری قەرز ($)", en: "Credit Limit ($)", ar: "حد الائتمان ($)", zh: "信用额度 ($)" })}</Label>
                      <Input id="edit-creditLimitUsd" name="creditLimitUsd" type="number" step="0.01" min="0" defaultValue={selectedVip.creditLimitUsd || ""} className="h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fixedPricePerKgAir">{pickLang(language, { ku: "نرخی جێگیر/کگ (ئاسمانی)", en: "Fixed Price/KG (Air)", ar: "سعر ثابت/كغ (جوي)", zh: "固定单价/公斤（空运）" })}</Label>
                      <Input id="edit-fixedPricePerKgAir" name="fixedPricePerKgAir" type="number" step="0.01" min="0" defaultValue={selectedVip.fixedPricePerKgAir || ""} className="h-11" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-fixedPricePerKgSea">{pickLang(language, { ku: "نرخی جێگیر/کگ (دەریایی)", en: "Fixed Price/KG (Sea)", ar: "سعر ثابت/كغ (بحري)", zh: "固定单价/公斤（海运）" })}</Label>
                      <Input id="edit-fixedPricePerKgSea" name="fixedPricePerKgSea" type="number" step="0.01" min="0" defaultValue={selectedVip.fixedPricePerKgSea || ""} className="h-11" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-notes">{pickLang(language, { ku: "تێبینی", en: "Notes", ar: "ملاحظات", zh: "备注" })}</Label>
                    <Input id="edit-notes" name="notes" defaultValue={selectedVip.notes || ""} className="h-11" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                    {pickLang(language, { ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? pickLang(language, { ku: "پاشەکەوتکردن...", en: "Saving...", ar: "جارٍ الحفظ...", zh: "保存中..." }) : pickLang(language, { ku: "پاشەکەوتکردنی گۆڕانکارییەکان", en: "Save Changes", ar: "حفظ التغييرات", zh: "保存更改" })}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
