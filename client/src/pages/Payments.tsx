import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  CreditCard, Plus, Search, DollarSign, Banknote, 
  Wallet, Building, TrendingUp, Calendar, User
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export default function Payments() {
    const { t, language } = useTranslation();
const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  
  // Use ledger system for payments
  const { data: recentTransactions, refetch } = trpc.ledger.getRecentTransactions.useQuery({ limit: 100 });
  const { data: customers } = trpc.customers.list.useQuery();
  
  // Filter to get only payment transactions (CREDIT_PAYMENT type)
  const payments = recentTransactions?.filter(t => t.transactionType === 'CREDIT_PAYMENT') || [];
  
  const createMutation = trpc.ledger.recordPayment.useMutation({
    onSuccess: () => {
      toast.success(pickLang(language, { ku: "پارەدان بە سەرکەوتوویی تۆمارکرا", en: "Payment recorded successfully", ar: "تم تسجيل الدفعة بنجاح", zh: "付款已成功记录" }));
      setIsCreateOpen(false);
      setSelectedCustomerId("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const filteredPayments = payments?.filter(p => {
    const matchesSearch = !search || 
      (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.transactionNumber || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const totalPayments = payments?.reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;
  const cashPayments = payments?.filter(p => (p.description || '').toLowerCase().includes('cash')).reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;
  const bankPayments = payments?.filter(p => (p.description || '').toLowerCase().includes('bank')).reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;
  const cardPayments = payments?.filter(p => (p.description || '').toLowerCase().includes('card')).reduce((sum, p) => sum + Math.abs(Number(p.amountUsd || 0)), 0) || 0;

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customer = customers?.find(c => c.id === parseInt(selectedCustomerId));
    if (!customer) {
      toast.error(pickLang(language, { ku: "کڕیار نەدۆزرایەوە", en: "Customer not found", ar: "لم يتم العثور على العميل", zh: "未找到客户" }));
      return;
    }
    // Map payment method to ledger format
    const methodMap: Record<string, 'CASH' | 'BANK_TRANSFER' | 'FIB' | 'FASTPAY' | 'ZAINCASH' | 'ASIAHAWALA' | 'CARD' | 'OTHER'> = {
      'cash': 'CASH',
      'bank_transfer': 'BANK_TRANSFER',
      'card': 'CARD',
      'mobile_money': 'FASTPAY',
      'other': 'OTHER'
    };
    createMutation.mutate({
      customerId: parseInt(selectedCustomerId),
      customerCode: customer.customerCode || '',
      amountUsd: parseFloat(formData.get("amountUsd") as string) || 0,
      amountIqd: 0,
      paymentMethod: methodMap[formData.get("paymentMethod") as string] || 'CASH',
      receiptNumber: formData.get("referenceNumber") as string || undefined,
      notes: formData.get("notes") as string || undefined,
    });
  };

  const getMethodIcon = (description: string) => {
    const desc = (description || '').toLowerCase();
    if (desc.includes('cash')) return <Banknote className="h-4 w-4" />;
    if (desc.includes('bank')) return <Building className="h-4 w-4" />;
    if (desc.includes('card')) return <CreditCard className="h-4 w-4" />;
    if (desc.includes('mobile') || desc.includes('fastpay') || desc.includes('zaincash')) return <Wallet className="h-4 w-4" />;
    return <DollarSign className="h-4 w-4" />;
  };

  const getMethodColor = (description: string) => {
    const desc = (description || '').toLowerCase();
    if (desc.includes('cash')) return 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400';
    if (desc.includes('bank')) return 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400';
    if (desc.includes('card')) return 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400';
    if (desc.includes('mobile') || desc.includes('fastpay') || desc.includes('zaincash')) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-950/30 dark:text-slate-400';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNCAxNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-6 w-6" />
                <span className="text-sm font-medium opacity-90">{pickLang(language, { ku: "بەڕێوەبردنی دارایی", en: "Financial Management", ar: "الإدارة المالية", zh: "财务管理" })}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{pickLang(language, { ku: "پارەدانەکان", en: "Payments", ar: "المدفوعات", zh: "付款" })}</h1>
              <p className="text-white/80 max-w-lg">
                {pickLang(language, { ku: "تۆمارکردن و بەدواداچوونی پارەدانی کڕیاران", en: "Record and track customer payments", ar: "تسجيل ومتابعة مدفوعات العملاء", zh: "记录并跟踪客户付款" })}
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white dark:bg-card text-green-600 dark:text-green-300 hover:bg-white/90 shadow-lg">
                  <Plus className="h-4 w-4 me-2" />
                  {pickLang(language, { ku: "تۆمارکردنی پارەدان", en: "Record Payment", ar: "تسجيل دفعة", zh: "记录付款" })}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-500 dark:text-green-400" />
                    {pickLang(language, { ku: "تۆمارکردنی پارەدان", en: "Record Payment", ar: "تسجيل دفعة", zh: "记录付款" })}
                  </DialogTitle>
                  <DialogDescription>
                    {pickLang(language, { ku: "تۆمارکردنی پارەدانێکی نوێ لە کڕیارەوە", en: "Record a new payment from a customer", ar: "تسجيل دفعة جديدة من عميل", zh: "记录来自客户的新付款" })}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>{pickLang(language, { ku: "کڕیار هەڵبژێرە *", en: "Select Customer *", ar: "اختر العميل *", zh: "选择客户 *" })}</Label>
                      <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={pickLang(language, { ku: "کڕیارێک هەڵبژێرە", en: "Choose a customer", ar: "اختر عميلاً", zh: "选择一位客户" })} />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id.toString()}>
                              {customer.fullName} ({customer.customerCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="amountUsd">{pickLang(language, { ku: "بڕ (دۆلار) *", en: "Amount (USD) *", ar: "المبلغ (دولار) *", zh: "金额（美元）*" })}</Label>
                        <Input id="amountUsd" name="amountUsd" type="number" step="0.01" min="0.01" required className="h-11" placeholder="0.00" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="paymentMethod">{pickLang(language, { ku: "شێوازی پارەدان *", en: "Payment Method *", ar: "طريقة الدفع *", zh: "付款方式 *" })}</Label>
                        <Select name="paymentMethod" defaultValue="cash">
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">💵 {pickLang(language, { ku: "کاش", en: "Cash", ar: "نقدي", zh: "现金" })}</SelectItem>
                            <SelectItem value="bank_transfer">🏦 {pickLang(language, { ku: "گواستنەوەی بانکی", en: "Bank Transfer", ar: "تحويل بنكي", zh: "银行转账" })}</SelectItem>
                            <SelectItem value="card">💳 {pickLang(language, { ku: "کارت", en: "Card", ar: "بطاقة", zh: "卡" })}</SelectItem>
                            <SelectItem value="mobile_money">📱 {pickLang(language, { ku: "پارەی مۆبایل", en: "Mobile Money", ar: "محفظة الهاتف", zh: "移动支付" })}</SelectItem>
                            <SelectItem value="other">📋 {pickLang(language, { ku: "هیتر", en: "Other", ar: "أخرى", zh: "其他" })}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="referenceNumber">{pickLang(language, { ku: "ژمارەی ئاماژە", en: "Reference Number", ar: "الرقم المرجعي", zh: "参考编号" })}</Label>
                      <Input id="referenceNumber" name="referenceNumber" className="h-11" placeholder={pickLang(language, { ku: "ناسنامەی مامەڵە یان ژمارەی پسوولە", en: "Transaction ID or receipt number", ar: "معرّف المعاملة أو رقم الإيصال", zh: "交易 ID 或收据编号" })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">{pickLang(language, { ku: "تێبینییەکان", en: "Notes", ar: "ملاحظات", zh: "备注" })}</Label>
                      <Input id="notes" name="notes" className="h-11" placeholder={pickLang(language, { ku: "هەر تێبینییەکی زیادە...", en: "Any additional notes...", ar: "أي ملاحظات إضافية...", zh: "任何附加备注……" })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      {pickLang(language, { ku: "هەڵوەشاندنەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || !selectedCustomerId} className="bg-green-500 hover:bg-green-600">
                      {createMutation.isPending ? pickLang(language, { ku: "تۆمار دەکرێت...", en: "Recording...", ar: "جارٍ التسجيل...", zh: "记录中……" }) : pickLang(language, { ku: "تۆمارکردنی پارەدان", en: "Record Payment", ar: "تسجيل دفعة", zh: "记录付款" })}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: "کۆی پارەدانەکان", en: "Total Payments", ar: "إجمالي المدفوعات", zh: "付款总额" })}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-300">${totalPayments.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: "کاش", en: "Cash", ar: "نقدي", zh: "现金" })}</p>
                  <p className="text-2xl font-bold">${cashPayments.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Banknote className="h-6 w-6 text-green-600 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{pickLang(language, { ku: "گواستنەوەی بانکی", en: "Bank Transfer", ar: "تحويل بنكي", zh: "银行转账" })}</p>
                  <p className="text-2xl font-bold">${bankPayments.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Card</p>
                  <p className="text-2xl font-bold">${cardPayments.toFixed(2)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Recent payment transactions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search payments..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 w-[250px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments?.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getMethodColor(payment.description || '')}>
                            {getMethodIcon(payment.description || '')}
                            <span className="ms-1">{payment.description || 'Payment'}</span>
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">
                          {payment.transactionNumber || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-green-600 dark:text-green-300">
                          ${Math.abs(Number(payment.amountUsd || 0)).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
