import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { 
  Building2, Plus, Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw,
  CreditCard, Banknote, PiggyBank, MoreVertical, Edit, Trash2,
  ArrowLeftRight, DollarSign, History, AlertTriangle, Eye, Star, Search,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BankAccounts() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [viewingAccountId, setViewingAccountId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("accounts");
  const [txSearchQuery, setTxSearchQuery] = useState("");
  
  const [newAccount, setNewAccount] = useState({
    accountName: "", accountNameKu: "", accountType: "bank" as 'cash' | 'bank' | 'mobile_wallet',
    accountNumber: "", bankName: "", initialBalance: "0",
    currency: "USD" as 'USD' | 'IQD', description: "", isPrimary: false,
  });

  const [editAccount, setEditAccount] = useState({
    id: 0, accountName: "", accountNameKu: "", bankName: "",
    accountNumber: "", description: "", isPrimary: false, isActive: true,
  });

  const [transfer, setTransfer] = useState({
    fromAccountId: "", toAccountId: "", amount: "", description: "",
  });

  const [transaction, setTransaction] = useState({
    accountId: "", transactionType: "deposit" as 'deposit' | 'withdrawal' | 'adjustment',
    amount: "", description: "", referenceNumber: "", notes: "",
  });

  // Queries
  const { data: accounts, isLoading: accountsLoading } = trpc.cashAccounts.list.useQuery();
  const { data: summary, isLoading: summaryLoading } = trpc.cashAccounts.getSummary.useQuery();
  const { data: viewingTransactions, isLoading: txLoading } = trpc.cashAccounts.getTransactions.useQuery(
    { accountId: viewingAccountId || 0, limit: 100 },
    { enabled: !!viewingAccountId }
  );

  // Mutations
  const createMutation = trpc.cashAccounts.create.useMutation({
    onSuccess: () => {
      toast.success(t("bankAccounts.accountAdded") || "هەژمار زیادکرا");
      setIsAddOpen(false);
      resetNewAccount();
      utils.cashAccounts.list.invalidate();
      utils.cashAccounts.getSummary.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.cashAccounts.update.useMutation({
    onSuccess: () => {
      toast.success(t("common.saved") || "پاشەکەوتکرا");
      setIsEditOpen(false);
      utils.cashAccounts.list.invalidate();
      utils.cashAccounts.getSummary.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.cashAccounts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("common.deleted") || "سڕایەوە");
      setIsDeleteOpen(false);
      setSelectedAccountId(null);
      utils.cashAccounts.list.invalidate();
      utils.cashAccounts.getSummary.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const transferMutation = trpc.cashAccounts.transfer.useMutation({
    onSuccess: () => {
      toast.success(t("bankAccounts.transferSuccessful") || "گواستنەوە سەرکەوتوو بوو");
      setIsTransferOpen(false);
      resetTransfer();
      utils.cashAccounts.list.invalidate();
      utils.cashAccounts.getSummary.invalidate();
      utils.cashAccounts.getTransactions.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const recordTransactionMutation = trpc.cashAccounts.recordTransaction.useMutation({
    onSuccess: () => {
      toast.success(t("bankAccounts.transactionRecorded") || "مامەڵە تۆمارکرا");
      setIsTransactionOpen(false);
      resetTransaction();
      utils.cashAccounts.list.invalidate();
      utils.cashAccounts.getSummary.invalidate();
      utils.cashAccounts.getTransactions.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  // Helpers
  const resetNewAccount = () => setNewAccount({
    accountName: "", accountNameKu: "", accountType: "bank",
    accountNumber: "", bankName: "", initialBalance: "0",
    currency: "USD", description: "", isPrimary: false,
  });
  const resetTransfer = () => setTransfer({ fromAccountId: "", toAccountId: "", amount: "", description: "" });
  const resetTransaction = () => setTransaction({
    accountId: "", transactionType: "deposit", amount: "", description: "", referenceNumber: "", notes: "",
  });

  const activeAccounts = useMemo(() => accounts?.filter(a => a.isActive) || [], [accounts]);
  const cashAccounts_ = useMemo(() => activeAccounts.filter(a => a.accountType === 'cash'), [activeAccounts]);
  const bankAccountsList = useMemo(() => activeAccounts.filter(a => a.accountType === 'bank'), [activeAccounts]);
  const walletAccounts = useMemo(() => activeAccounts.filter(a => a.accountType === 'mobile_wallet'), [activeAccounts]);

  const totalBalance = summary?.totalBalance || 0;
  const cashBalance = summary?.totalCash || 0;
  const bankBalance = summary?.totalBank || 0;
  const walletBalance = useMemo(() => walletAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0), [walletAccounts]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cash': return <Banknote className="h-5 w-5" />;
      case 'bank': return <Building2 className="h-5 w-5" />;
      case 'mobile_wallet': return <CreditCard className="h-5 w-5" />;
      default: return <Wallet className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'cash': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'bank': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'mobile_wallet': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeBorderColor = (type: string) => {
    switch (type) {
      case 'cash': return 'border-t-emerald-500';
      case 'bank': return 'border-t-blue-500';
      case 'mobile_wallet': return 'border-t-purple-500';
      default: return 'border-t-gray-500';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'cash': return t("bankAccounts.cashBox") || "سندوقی پارە";
      case 'bank': return t("bankAccounts.bankAccount") || "هەژماری بانک";
      case 'mobile_wallet': return t("bankAccounts.mobileWallet") || "جزدانی مۆبایل";
      default: return type;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'deposit': t("bankAccounts.deposit") || "داخل",
      'withdrawal': t("bankAccounts.withdrawal") || "دەرهێنان",
      'transfer_in': t("bankAccounts.transferIn") || "گواستنەوە (هاتن)",
      'transfer_out': t("bankAccounts.transferOut") || "گواستنەوە (چوون)",
      'customer_payment': t("bankAccounts.customerPayment") || "پارەدانی کڕیار",
      'expense': t("bankAccounts.expense") || "خەرجی",
      'debt_payment': t("bankAccounts.debtPayment") || "پارەدانی قەرز",
      'partner_deposit': t("bankAccounts.partnerDeposit") || "داخلی هاوبەش",
      'partner_withdrawal': t("bankAccounts.partnerWithdrawal") || "دەرهێنانی هاوبەش",
      'adjustment': t("bankAccounts.adjustment") || "ڕێکخستن",
    };
    return labels[type] || type;
  };

  const getTransactionIcon = (type: string) => {
    if (['deposit', 'transfer_in', 'customer_payment', 'partner_deposit'].includes(type))
      return <ArrowDownLeft className="h-4 w-4 text-emerald-600" />;
    if (['withdrawal', 'transfer_out', 'expense', 'debt_payment', 'partner_withdrawal'].includes(type))
      return <ArrowUpRight className="h-4 w-4 text-red-600" />;
    return <RefreshCw className="h-4 w-4 text-blue-600" />;
  };

  const isIncome = (type: string) => ['deposit', 'transfer_in', 'customer_payment', 'partner_deposit'].includes(type);

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  // Handlers
  const handleAddAccount = () => {
    if (!newAccount.accountName.trim()) { toast.error("ناوی هەژمار پێویستە"); return; }
    createMutation.mutate({
      accountName: newAccount.accountName,
      accountNameKu: newAccount.accountNameKu || undefined,
      accountType: newAccount.accountType,
      bankName: newAccount.bankName || undefined,
      accountNumber: newAccount.accountNumber || undefined,
      currency: newAccount.currency,
      initialBalance: newAccount.initialBalance || '0',
      description: newAccount.description || undefined,
      isPrimary: newAccount.isPrimary,
    });
  };

  const handleEditAccount = () => {
    updateMutation.mutate({
      id: editAccount.id,
      accountName: editAccount.accountName || undefined,
      accountNameKu: editAccount.accountNameKu || undefined,
      bankName: editAccount.bankName || undefined,
      accountNumber: editAccount.accountNumber || undefined,
      description: editAccount.description || undefined,
      isPrimary: editAccount.isPrimary,
      isActive: editAccount.isActive,
    });
  };

  const handleTransfer = () => {
    const amount = parseFloat(transfer.amount);
    if (!transfer.fromAccountId || !transfer.toAccountId || !amount || amount <= 0) {
      toast.error("هەموو خانەکان پڕبکەرەوە"); return;
    }
    if (transfer.fromAccountId === transfer.toAccountId) {
      toast.error("ناتوانیت بۆ هەمان حساب بگوازیتەوە"); return;
    }
    transferMutation.mutate({
      fromAccountId: parseInt(transfer.fromAccountId),
      toAccountId: parseInt(transfer.toAccountId),
      amount,
      description: transfer.description || undefined,
    });
  };

  const handleRecordTransaction = () => {
    const amount = parseFloat(transaction.amount);
    if (!transaction.accountId || !amount || amount <= 0) {
      toast.error("هەموو خانەکان پڕبکەرەوە"); return;
    }
    recordTransactionMutation.mutate({
      accountId: parseInt(transaction.accountId),
      transactionType: transaction.transactionType,
      amount: amount.toFixed(2),
      description: transaction.description || undefined,
      transactionDate: new Date(),
      referenceNumber: transaction.referenceNumber || undefined,
      notes: transaction.notes || undefined,
    });
  };

  const openEditDialog = (account: any) => {
    setEditAccount({
      id: account.id, accountName: account.accountName || '',
      accountNameKu: account.accountNameKu || '', bankName: account.bankName || '',
      accountNumber: account.accountNumber || '', description: account.description || '',
      isPrimary: account.isPrimary || false, isActive: account.isActive,
    });
    setIsEditOpen(true);
  };

  const viewAccountTransactions = (accountId: number) => {
    setViewingAccountId(accountId);
    setActiveTab("transactions");
  };

  const viewingAccount = useMemo(() => accounts?.find(a => a.id === viewingAccountId), [accounts, viewingAccountId]);

  const filteredTransactions = useMemo(() => {
    if (!viewingTransactions) return [];
    if (!txSearchQuery) return viewingTransactions;
    const q = txSearchQuery.toLowerCase();
    return viewingTransactions.filter((tx: any) =>
      tx.description?.toLowerCase().includes(q) ||
      tx.referenceNumber?.toLowerCase().includes(q) ||
      tx.notes?.toLowerCase().includes(q) ||
      getTransactionTypeLabel(tx.transactionType).toLowerCase().includes(q)
    );
  }, [viewingTransactions, txSearchQuery]);

  if (accountsLoading || summaryLoading) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-blue-600 via-blue-700 to-cyan-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("bankAccounts.pageTitle") || "بەڕێوەبردنی حسابەکان"}</h1>
              <p className="text-blue-100 text-sm">{t("bankAccounts.pageSubtitle") || "بەڕێوەبردنی سندوق، بانک، و جزدانی مۆبایل"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setIsTransactionOpen(true)}>
              <DollarSign className="h-4 w-4 ml-2" />
              {t("bankAccounts.recordTransaction") || "تۆمارکردنی مامەڵە"}
            </Button>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => setIsTransferOpen(true)}>
              <ArrowLeftRight className="h-4 w-4 ml-2" />
              {t("bankAccounts.transfer") || "گواستنەوە"}
            </Button>
            <Button className="bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
              onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              {t("bankAccounts.addAccount") || "زیادکردنی هەژمار"}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{t("bankAccounts.totalBalance") || "کۆی باڵانس"}</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalBalance)}</p>
                <p className="text-xs text-emerald-500 mt-1">{activeAccounts.length} {t("bankAccounts.activeAccounts") || "حسابی چالاک"}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <PiggyBank className="h-5 w-5 md:h-6 md:w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{t("bankAccounts.cashBox") || "سندوقی پارە"}</p>
                <p className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(cashBalance)}</p>
                <p className="text-xs text-green-500 mt-1">{cashAccounts_.length} {t("bankAccounts.account") || "هەژمار"}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Banknote className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{t("bankAccounts.bankAccount") || "بانک"}</p>
                <p className="text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(bankBalance)}</p>
                <p className="text-xs text-blue-500 mt-1">{bankAccountsList.length} {t("bankAccounts.account") || "هەژمار"}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">{t("bankAccounts.mobileWallet") || "جزدانی مۆبایل"}</p>
                <p className="text-xl md:text-2xl font-bold text-purple-700 dark:text-purple-400">{formatCurrency(walletBalance)}</p>
                <p className="text-xs text-purple-500 mt-1">{walletAccounts.length} {t("bankAccounts.account") || "هەژمار"}</p>
              </div>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <CreditCard className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="accounts" className="text-sm font-medium">
            <Wallet className="h-4 w-4 ml-2" />
            {t("bankAccounts.allAccounts") || "هەموو حسابەکان"}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-sm font-medium">
            <History className="h-4 w-4 ml-2" />
            {t("bankAccounts.transactionHistory") || "مێژووی مامەڵەکان"}
          </TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4 mt-4">
          {/* Cash Accounts */}
          {cashAccounts_.length > 0 && (
            <AccountSection
              icon={<Banknote className="h-4 w-4 text-emerald-600" />}
              title={t("bankAccounts.cashBox") || "سندوقی پارە"}
              count={cashAccounts_.length}
              colorClass="bg-emerald-100 dark:bg-emerald-900/30"
              accounts={cashAccounts_}
              getTypeIcon={getTypeIcon} getTypeColor={getTypeColor}
              getTypeBorderColor={getTypeBorderColor} getTypeName={getTypeName}
              formatCurrency={formatCurrency} onEdit={openEditDialog}
              onDelete={(id: number) => { setSelectedAccountId(id); setIsDeleteOpen(true); }}
              onViewTransactions={viewAccountTransactions}
              onRecordTransaction={(id: number) => { setTransaction(prev => ({...prev, accountId: id.toString()})); setIsTransactionOpen(true); }}
              t={t}
            />
          )}

          {/* Bank Accounts */}
          {bankAccountsList.length > 0 && (
            <AccountSection
              icon={<Building2 className="h-4 w-4 text-blue-600" />}
              title={t("bankAccounts.bankAccount") || "هەژمارە بانکییەکان"}
              count={bankAccountsList.length}
              colorClass="bg-blue-100 dark:bg-blue-900/30"
              accounts={bankAccountsList}
              getTypeIcon={getTypeIcon} getTypeColor={getTypeColor}
              getTypeBorderColor={getTypeBorderColor} getTypeName={getTypeName}
              formatCurrency={formatCurrency} onEdit={openEditDialog}
              onDelete={(id: number) => { setSelectedAccountId(id); setIsDeleteOpen(true); }}
              onViewTransactions={viewAccountTransactions}
              onRecordTransaction={(id: number) => { setTransaction(prev => ({...prev, accountId: id.toString()})); setIsTransactionOpen(true); }}
              t={t}
            />
          )}

          {/* Mobile Wallets */}
          {walletAccounts.length > 0 && (
            <AccountSection
              icon={<CreditCard className="h-4 w-4 text-purple-600" />}
              title={t("bankAccounts.mobileWallet") || "جزدانی مۆبایل"}
              count={walletAccounts.length}
              colorClass="bg-purple-100 dark:bg-purple-900/30"
              accounts={walletAccounts}
              getTypeIcon={getTypeIcon} getTypeColor={getTypeColor}
              getTypeBorderColor={getTypeBorderColor} getTypeName={getTypeName}
              formatCurrency={formatCurrency} onEdit={openEditDialog}
              onDelete={(id: number) => { setSelectedAccountId(id); setIsDeleteOpen(true); }}
              onViewTransactions={viewAccountTransactions}
              onRecordTransaction={(id: number) => { setTransaction(prev => ({...prev, accountId: id.toString()})); setIsTransactionOpen(true); }}
              t={t}
            />
          )}

          {/* Empty State */}
          {activeAccounts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{t("bankAccounts.noAccounts") || "هیچ حسابێک نییە"}</h3>
                <p className="text-muted-foreground text-sm mb-4">{t("bankAccounts.noAccountsDesc") || "یەکەم حسابت زیاد بکە بۆ دەستپێکردنی بەڕێوەبردنی دارایی"}</p>
                <Button onClick={() => setIsAddOpen(true)}>
                  <Plus className="h-4 w-4 ml-2" />
                  {t("bankAccounts.addAccount") || "زیادکردنی هەژمار"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm mb-2 block">{t("bankAccounts.selectAccount") || "هەژمار هەڵبژێرە"}</Label>
                  <Select value={viewingAccountId?.toString() || ""} onValueChange={(v) => setViewingAccountId(parseInt(v))}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder={t("bankAccounts.selectAccountToView") || "هەژمارێک هەڵبژێرە بۆ بینینی مامەڵەکان"} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map(acc => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          <span className="flex items-center gap-2">
                            {getTypeIcon(acc.accountType)}
                            {acc.accountNameKu || acc.accountName} ({formatCurrency(acc.currentBalance)})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {viewingAccountId && (
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t("common.search") || "گەڕان..."} value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)} className="pr-10 h-11 w-60" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {viewingAccount && (
            <Card className="bg-gradient-to-l from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${getTypeColor(viewingAccount.accountType)}`}>
                      {getTypeIcon(viewingAccount.accountType)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{viewingAccount.accountNameKu || viewingAccount.accountName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {viewingAccount.bankName || getTypeName(viewingAccount.accountType)}
                        {viewingAccount.accountNumber && ` • ${viewingAccount.accountNumber}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">{t("bankAccounts.currentBalance") || "باڵانسی ئێستا"}</p>
                    <p className={`text-2xl font-bold ${Number(viewingAccount.currentBalance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(viewingAccount.currentBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {viewingAccountId ? (
            txLoading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : filteredTransactions.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {filteredTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            isIncome(tx.transactionType) ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                            tx.transactionType === 'adjustment' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {getTransactionIcon(tx.transactionType)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{getTransactionTypeLabel(tx.transactionType)}</p>
                            <p className="text-xs text-muted-foreground">{tx.description || tx.notes || '—'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(tx.transactionDate)}
                              {tx.referenceNumber && ` • ${tx.referenceNumber}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          <span className={`font-bold text-sm ${
                            isIncome(tx.transactionType) ? 'text-emerald-600' :
                            tx.transactionType === 'adjustment' ? 'text-blue-600' : 'text-red-600'
                          }`}>
                            {isIncome(tx.transactionType) ? '+' : '-'}{formatCurrency(tx.amount)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {t("bankAccounts.balanceAfter") || "باڵانس:"} {formatCurrency(tx.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("bankAccounts.noTransactionsFound") || "مامەڵە نەدۆزرایەوە"}</p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t("bankAccounts.selectAccountToView") || "هەژمارێک هەڵبژێرە بۆ بینینی مامەڵەکان"}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ========== DIALOGS ========== */}

      {/* Add Account Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-500" />
              {t("bankAccounts.addAccount") || "زیادکردنی هەژمار"}
            </DialogTitle>
            <DialogDescription>{t("bankAccounts.addAccountDesc") || "زیادکردنی هەژماری نوێ"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("bankAccounts.accountName") || "ناوی هەژمار"} *</Label>
                <Input value={newAccount.accountName}
                  onChange={(e) => setNewAccount({...newAccount, accountName: e.target.value})}
                  placeholder={t("bankAccounts.enterAccountName") || "ناوی هەژمار بنووسە"} />
              </div>
              <div className="space-y-2">
                <Label>{t("bankAccounts.accountNameKu") || "ناوی کوردی"}</Label>
                <Input value={newAccount.accountNameKu}
                  onChange={(e) => setNewAccount({...newAccount, accountNameKu: e.target.value})}
                  placeholder="ناوی کوردی" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("bankAccounts.accountType") || "جۆری هەژمار"} *</Label>
                <Select value={newAccount.accountType} onValueChange={(v: 'cash' | 'bank' | 'mobile_wallet') => setNewAccount({...newAccount, accountType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("bankAccounts.cashBox") || "سندوقی پارە"}</SelectItem>
                    <SelectItem value="bank">{t("bankAccounts.bankAccount") || "هەژماری بانک"}</SelectItem>
                    <SelectItem value="mobile_wallet">{t("bankAccounts.mobileWallet") || "جزدانی مۆبایل"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("bankAccounts.currency") || "دراو"}</Label>
                <Select value={newAccount.currency} onValueChange={(v: 'USD' | 'IQD') => setNewAccount({...newAccount, currency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="IQD">IQD (د.ع)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(newAccount.accountType === 'bank' || newAccount.accountType === 'mobile_wallet') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("bankAccounts.bankName") || "ناوی بانک"}</Label>
                  <Input value={newAccount.bankName}
                    onChange={(e) => setNewAccount({...newAccount, bankName: e.target.value})}
                    placeholder={t("bankAccounts.bankNamePlaceholder") || "ناوی بانک"} />
                </div>
                <div className="space-y-2">
                  <Label>{t("bankAccounts.accountNumber") || "ژمارەی هەژمار"}</Label>
                  <Input value={newAccount.accountNumber}
                    onChange={(e) => setNewAccount({...newAccount, accountNumber: e.target.value})}
                    placeholder="1234567890" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("bankAccounts.initialBalance") || "باڵانسی سەرەتایی"}</Label>
              <Input type="number" value={newAccount.initialBalance}
                onChange={(e) => setNewAccount({...newAccount, initialBalance: e.target.value})}
                placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.description") || "وەسف"}</Label>
              <Textarea value={newAccount.description}
                onChange={(e) => setNewAccount({...newAccount, description: e.target.value})}
                placeholder={t("bankAccounts.accountDescription") || "وەسفی هەژمار"} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common.cancel") || "پاشگەزبوونەوە"}</Button>
            <Button onClick={handleAddAccount} disabled={createMutation.isPending || !newAccount.accountName}>
              {createMutation.isPending ? "..." : t("bankAccounts.addAccount") || "زیادکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-500" />
              {t("bankAccounts.editAccount") || "دەستکاری هەژمار"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("bankAccounts.accountName") || "ناوی هەژمار"}</Label>
                <Input value={editAccount.accountName}
                  onChange={(e) => setEditAccount({...editAccount, accountName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t("bankAccounts.accountNameKu") || "ناوی کوردی"}</Label>
                <Input value={editAccount.accountNameKu}
                  onChange={(e) => setEditAccount({...editAccount, accountNameKu: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("bankAccounts.bankName") || "ناوی بانک"}</Label>
                <Input value={editAccount.bankName}
                  onChange={(e) => setEditAccount({...editAccount, bankName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t("bankAccounts.accountNumber") || "ژمارەی هەژمار"}</Label>
                <Input value={editAccount.accountNumber}
                  onChange={(e) => setEditAccount({...editAccount, accountNumber: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.description") || "وەسف"}</Label>
              <Textarea value={editAccount.description}
                onChange={(e) => setEditAccount({...editAccount, description: e.target.value})} rows={2} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editAccount.isPrimary}
                  onChange={(e) => setEditAccount({...editAccount, isPrimary: e.target.checked})} className="rounded" />
                <span className="text-sm">{t("bankAccounts.primaryAccount") || "حسابی سەرەکی"}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editAccount.isActive}
                  onChange={(e) => setEditAccount({...editAccount, isActive: e.target.checked})} className="rounded" />
                <span className="text-sm">{t("bankAccounts.isActive") || "چالاک"}</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>{t("common.cancel") || "پاشگەزبوونەوە"}</Button>
            <Button onClick={handleEditAccount} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "..." : t("common.save") || "پاشەکەوتکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-500" />
              {t("bankAccounts.transferBetweenAccounts") || "گواستنەوە لەنێوان حسابەکان"}
            </DialogTitle>
            <DialogDescription>{t("bankAccounts.transferDesc") || "پارە بگوازەرەوە لە حسابێکەوە بۆ حسابێکی تر"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("bankAccounts.fromAccount") || "لە حساب"} *</Label>
              <Select value={transfer.fromAccountId} onValueChange={(v) => setTransfer({...transfer, fromAccountId: v})}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t("bankAccounts.selectAccount") || "هەژمار هەڵبژێرە"} />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.accountNameKu || acc.accountName} ({formatCurrency(acc.currentBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.toAccount") || "بۆ حساب"} *</Label>
              <Select value={transfer.toAccountId} onValueChange={(v) => setTransfer({...transfer, toAccountId: v})}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t("bankAccounts.selectDestinationAccount") || "هەژماری مەبەست هەڵبژێرە"} />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.filter(a => a.id.toString() !== transfer.fromAccountId).map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.accountNameKu || acc.accountName} ({formatCurrency(acc.currentBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.amount") || "بڕ"} *</Label>
              <Input type="number" value={transfer.amount}
                onChange={(e) => setTransfer({...transfer, amount: e.target.value})}
                placeholder="0.00" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.notes") || "تێبینی"}</Label>
              <Textarea value={transfer.description}
                onChange={(e) => setTransfer({...transfer, description: e.target.value})}
                placeholder={t("bankAccounts.transactionDescription") || "وەسفی مامەڵە"} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>{t("common.cancel") || "پاشگەزبوونەوە"}</Button>
            <Button onClick={handleTransfer}
              disabled={transferMutation.isPending || !transfer.fromAccountId || !transfer.toAccountId || !transfer.amount}
              className="bg-blue-600 hover:bg-blue-700">
              {transferMutation.isPending ? "..." : t("bankAccounts.transfer") || "گواستنەوە"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Transaction Dialog */}
      <Dialog open={isTransactionOpen} onOpenChange={setIsTransactionOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              {t("bankAccounts.recordTransaction") || "تۆمارکردنی مامەڵە"}
            </DialogTitle>
            <DialogDescription>{t("bankAccounts.recordTransactionDesc") || "تۆمارکردنی داخل یان دەرهێنان"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("bankAccounts.selectAccount") || "هەژمار هەڵبژێرە"} *</Label>
              <Select value={transaction.accountId} onValueChange={(v) => setTransaction({...transaction, accountId: v})}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={t("bankAccounts.selectAccount") || "هەژمار هەڵبژێرە"} />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id.toString()}>
                      {acc.accountNameKu || acc.accountName} ({formatCurrency(acc.currentBalance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.transactionType") || "جۆری مامەڵە"} *</Label>
              <Select value={transaction.transactionType} onValueChange={(v: 'deposit' | 'withdrawal' | 'adjustment') => setTransaction({...transaction, transactionType: v})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                      {t("bankAccounts.deposit") || "داخل (وەرگرتن)"}
                    </span>
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-red-500" />
                      {t("bankAccounts.withdrawal") || "دەرهێنان"}
                    </span>
                  </SelectItem>
                  <SelectItem value="adjustment">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      {t("bankAccounts.adjustment") || "ڕێکخستن"}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.amount") || "بڕ"} *</Label>
              <Input type="number" value={transaction.amount}
                onChange={(e) => setTransaction({...transaction, amount: e.target.value})}
                placeholder="0.00" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.transactionDesc") || "وەسفی مامەڵە"}</Label>
              <Input value={transaction.description}
                onChange={(e) => setTransaction({...transaction, description: e.target.value})}
                placeholder={t("bankAccounts.transactionDescription") || "وەسفی مامەڵە"} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccounts.receiptNumber") || "ژمارەی پسوولە"}</Label>
              <Input value={transaction.referenceNumber}
                onChange={(e) => setTransaction({...transaction, referenceNumber: e.target.value})}
                placeholder="REF-001" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.notes") || "تێبینی"}</Label>
              <Textarea value={transaction.notes}
                onChange={(e) => setTransaction({...transaction, notes: e.target.value})} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransactionOpen(false)}>{t("common.cancel") || "پاشگەزبوونەوە"}</Button>
            <Button onClick={handleRecordTransaction}
              disabled={recordTransactionMutation.isPending || !transaction.accountId || !transaction.amount}
              className="bg-emerald-600 hover:bg-emerald-700">
              {recordTransactionMutation.isPending ? "..." : t("bankAccounts.recordTransaction") || "تۆمارکردن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {t("bankAccounts.confirmDelete") || "دڵنیای لە سڕینەوە؟"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("bankAccounts.deleteWarning") || "ئەم کارە ناگەڕێتەوە. هەموو مامەڵەکانی ئەم حسابە دەسڕێتەوە."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "پاشگەزبوونەوە"}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedAccountId && deleteMutation.mutate({ id: selectedAccountId })}>
              {deleteMutation.isPending ? "..." : t("forms.delete") || "سڕینەوە"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Account Section Component
function AccountSection({ icon, title, count, colorClass, accounts, getTypeIcon, getTypeColor,
  getTypeBorderColor, getTypeName, formatCurrency, onEdit, onDelete, onViewTransactions,
  onRecordTransaction, t }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 rounded-lg ${colorClass} flex items-center justify-center`}>{icon}</div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account: any) => (
          <AccountCard key={account.id} account={account}
            getTypeIcon={getTypeIcon} getTypeColor={getTypeColor}
            getTypeBorderColor={getTypeBorderColor} getTypeName={getTypeName}
            formatCurrency={formatCurrency} onEdit={onEdit} onDelete={onDelete}
            onViewTransactions={onViewTransactions} onRecordTransaction={onRecordTransaction} t={t} />
        ))}
      </div>
    </div>
  );
}

// Account Card Component
function AccountCard({ account, getTypeIcon, getTypeColor, getTypeBorderColor, getTypeName,
  formatCurrency, onEdit, onDelete, onViewTransactions, onRecordTransaction, t }: any) {
  return (
    <Card className={`relative overflow-hidden border-t-4 ${getTypeBorderColor(account.accountType)} hover:shadow-lg transition-all duration-200`}>
      <CardContent className="p-4 pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${getTypeColor(account.accountType)}`}>
              {getTypeIcon(account.accountType)}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{account.accountNameKu || account.accountName}</h3>
              <p className="text-xs text-muted-foreground">{account.bankName || getTypeName(account.accountType)}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewTransactions(account.id)}>
                <History className="h-4 w-4 ml-2" />
                {t("bankAccounts.viewTransactions") || "بینینی مامەڵەکان"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRecordTransaction(account.id)}>
                <DollarSign className="h-4 w-4 ml-2" />
                {t("bankAccounts.recordTransaction") || "تۆمارکردنی مامەڵە"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Edit className="h-4 w-4 ml-2" />
                {t("forms.edit") || "دەستکاری"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(account.id)}>
                <Trash2 className="h-4 w-4 ml-2" />
                {t("forms.delete") || "سڕینەوە"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("bankAccounts.currentBalance") || "باڵانسی ئێستا"}</p>
              <p className={`text-2xl font-bold ${Number(account.currentBalance) >= 0 ? '' : 'text-red-600'}`}>
                {formatCurrency(account.currentBalance)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {account.isPrimary && (
                <Badge variant="default" className="text-xs bg-amber-500">
                  <Star className="h-3 w-3 ml-1" />
                  {t("bankAccounts.primary") || "سەرەکی"}
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs ${getTypeColor(account.accountType)}`}>
                {getTypeName(account.accountType)}
              </Badge>
            </div>
          </div>
        </div>
        {account.accountNumber && (
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            {t("bankAccounts.accountNumber") || "ژمارەی هەژمار"}: {account.accountNumber}
          </p>
        )}
        {account.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{account.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
