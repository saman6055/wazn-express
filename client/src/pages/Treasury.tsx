import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Wallet,
  Landmark,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  DollarSign,
  Eye,
  Trash2,
  Building2,
  Banknote,
  PiggyBank,
  History,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Treasury() {
    const { t } = useTranslation();
const [activeTab, setActiveTab] = useState("accounts");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  // Form states
  const [accountForm, setAccountForm] = useState({
    accountName: "",
    accountType: "cash",
    bankName: "",
    accountNumber: "",
    initialBalance: "0",
    currency: "USD",
    description: "",
  });

  const [transactionForm, setTransactionForm] = useState({
    accountId: "",
    transactionType: "deposit",
    amount: "",
    currency: "USD",
    description: "",
    transactionDate: new Date().toISOString().split('T')[0],
    referenceNumber: "",
    relatedAccountId: "",
    notes: "",
  });

  // Queries
  const { data: accounts = [], refetch: refetchAccounts } = trpc.cashAccounts.list.useQuery();
  const { data: summary } = trpc.cashAccounts.getSummary.useQuery();
  const { data: transactions = [] } = trpc.cashAccounts.getTransactions.useQuery(
    { accountId: selectedAccountId || 0, limit: 100 },
    { enabled: !!selectedAccountId }
  );

  // Mutations
  const createAccount = trpc.cashAccounts.create.useMutation({
    onSuccess: () => {
      toast.success(t("treasury.accountAdded"));
      setShowAddAccount(false);
      refetchAccounts();
      resetAccountForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteAccount = trpc.cashAccounts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("messages.accountDeleted"));
      refetchAccounts();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createTransaction = trpc.cashAccounts.recordTransaction.useMutation({
    onSuccess: () => {
      toast.success(t("treasury.transactionRecorded"));
      setShowAddTransaction(false);
      refetchAccounts();
      resetTransactionForm();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetAccountForm = () => {
    setAccountForm({
      accountName: "",
      accountType: "cash",
      bankName: "",
      accountNumber: "",
      initialBalance: "0",
      currency: "USD",
      description: "",
    });
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      accountId: "",
      transactionType: "deposit",
      amount: "",
      currency: "USD",
      description: "",
      transactionDate: new Date().toISOString().split('T')[0],
      referenceNumber: "",
      relatedAccountId: "",
      notes: "",
    });
  };

  const handleCreateAccount = () => {
    if (!accountForm.accountName) {
      toast.error(t("treasury.enterAccountName"));
      return;
    }

    createAccount.mutate({
      accountName: accountForm.accountName,
      accountType: accountForm.accountType as any,
      bankName: accountForm.bankName || undefined,
      accountNumber: accountForm.accountNumber || undefined,
      initialBalance: accountForm.initialBalance || "0",
      currency: accountForm.currency as "USD" | "IQD",
      description: accountForm.description || undefined,
    });
  };

  const handleCreateTransaction = () => {
    if (!transactionForm.accountId || !transactionForm.amount) {
      toast.error(t("common.fillAllFields"));
      return;
    }

    createTransaction.mutate({
      accountId: parseInt(transactionForm.accountId),
      transactionType: transactionForm.transactionType as "deposit" | "withdrawal" | "adjustment",
      amount: transactionForm.currency === "USD" 
        ? transactionForm.amount 
        : (parseFloat(transactionForm.amount) / 1480).toFixed(2),
      description: transactionForm.description || undefined,
      transactionDate: new Date(transactionForm.transactionDate),
      referenceNumber: transactionForm.referenceNumber || undefined,
      notes: transactionForm.notes || undefined,
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ku-Arab", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "cash": return <Banknote className="h-5 w-5" />;
      case "bank": return <Landmark className="h-5 w-5" />;
      case "mobile_wallet": return <Wallet className="h-5 w-5" />;
      default: return <CreditCard className="h-5 w-5" />;
    }
  };

  const getAccountLabel = (type: string) => {
    switch (type) {
      case "cash": return t('finance.cash');
      case "bank": return t('finance.bank');
      case "mobile_wallet": return t('finance.mobileWallet');
      default: return t('common.other');
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit": return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case "withdrawal": return <ArrowDownRight className="h-4 w-4 text-red-500" />;
      case "transfer_in": return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
      case "transfer_out": return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
      default: return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "deposit": return t('finance.deposit');
      case "withdrawal": return t('finance.withdrawal');
      case "transfer_in": return t('finance.transferIn');
      case "transfer_out": return t('finance.transferOut');
      case "adjustment": return t('finance.adjustment');
      default: return type;
    }
  };

  // Calculate totals
  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const cashBalance = accounts.filter(a => a.accountType === "cash").reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const bankBalance = accounts.filter(a => a.accountType === "bank").reduce((sum, a) => sum + Number(a.currentBalance), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("treasury.title")}</h1>
            <p className="text-muted-foreground">
              {t("treasury.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowLeftRight className="me-2 h-4 w-4" />
                  {t("treasury.newTransaction")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("treasury.recordTransaction")}</DialogTitle>
                  <DialogDescription>
                    {t("treasury.transactionDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="txnAccount">{t("treasury.account")}</Label>
                    <Select
                      value={transactionForm.accountId}
                      onValueChange={(value) => setTransactionForm({ ...transactionForm, accountId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("treasury.selectAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.isActive).map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.accountName} - {formatCurrency(account.currentBalance)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="txnType">{t("treasury.transactionType")}</Label>
                    <Select
                      value={transactionForm.transactionType}
                      onValueChange={(value) => setTransactionForm({ ...transactionForm, transactionType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">📥 {t("treasury.deposit")}</SelectItem>
                        <SelectItem value="withdrawal">📤 {t("treasury.withdrawal")}</SelectItem>
                        <SelectItem value="transfer_out">🔄 {t("treasury.transferOut")}</SelectItem>
                        <SelectItem value="adjustment">⚙️ {t("treasury.adjustment")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {transactionForm.transactionType === "transfer_out" && (
                    <div className="grid gap-2">
                      <Label htmlFor="relatedAccount">{t("treasury.destinationAccount")}</Label>
                      <Select
                        value={transactionForm.relatedAccountId}
                        onValueChange={(value) => setTransactionForm({ ...transactionForm, relatedAccountId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("treasury.selectDestinationAccount")} />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.filter(a => a.isActive && a.id.toString() !== transactionForm.accountId).map((account) => (
                            <SelectItem key={account.id} value={account.id.toString()}>
                              {account.accountName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="txnAmount">{t("common.amount")}</Label>
                      <Input
                        id="txnAmount"
                        type="number"
                        step="0.01"
                        value={transactionForm.amount}
                        onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="txnCurrency">{t("finance.currency")}</Label>
                      <Select
                        value={transactionForm.currency}
                        onValueChange={(value) => setTransactionForm({ ...transactionForm, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">{t("common.dollar")} ($)</SelectItem>
                          <SelectItem value="IQD">{t("common.dinar")} (IQD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="txnDate">{t("common.date")}</Label>
                    <Input
                      id="txnDate"
                      type="date"
                      value={transactionForm.transactionDate}
                      onChange={(e) => setTransactionForm({ ...transactionForm, transactionDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="txnDesc">{t("common.description")}</Label>
                    <Input
                      id="txnDesc"
                      value={transactionForm.description}
                      onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                      placeholder={t("treasury.transactionDescription")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="txnRef">{t("treasury.receiptNumber")}</Label>
                    <Input
                      id="txnRef"
                      value={transactionForm.referenceNumber}
                      onChange={(e) => setTransactionForm({ ...transactionForm, referenceNumber: e.target.value })}
                      placeholder="TXN-001"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddTransaction(false)}>{t("common.cancel")}</Button>
                  <Button onClick={handleCreateTransaction} disabled={createTransaction.isPending}>
                    {createTransaction.isPending ? t("common.loading") : t("common.register")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="me-2 h-4 w-4" />
                 {t("treasury.newAccount")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("treasury.addAccount")}</DialogTitle>
                  <DialogDescription>
                    {t("treasury.addAccountDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="accountName">{t("treasury.accountName")}</Label>
                    <Input
                      id="accountName"
                      value={accountForm.accountName}
                      onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                      placeholder={t("treasury.mainCashBox")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="accountType">{t("treasury.accountType")}</Label>
                    <Select
                      value={accountForm.accountType}
                      onValueChange={(value) => setAccountForm({ ...accountForm, accountType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">💵 {t("treasury.cashBox")}</SelectItem>
                        <SelectItem value="bank">🏦 {t("treasury.bankAccount")}</SelectItem>
                        <SelectItem value="mobile_wallet">📱 {t("treasury.mobileWallet")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {accountForm.accountType === "bank" && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="bankName">{t("treasury.bankName")}</Label>
                        <Input
                          id="bankName"
                          value={accountForm.bankName}
                          onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                          placeholder={t("treasury.bankNamePlaceholder")}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="accountNumber">{t("finance.accountNumber")}</Label>
                        <Input
                          id="accountNumber"
                          value={accountForm.accountNumber}
                          onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                          placeholder="1234567890"
                        />
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="initialBalance">{t("treasury.initialBalance")}</Label>
                      <Input
                        id="initialBalance"
                        type="number"
                        step="0.01"
                        value={accountForm.initialBalance}
                        onChange={(e) => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="accountCurrency">{t("finance.currency")}</Label>
                      <Select
                        value={accountForm.currency}
                        onValueChange={(value) => setAccountForm({ ...accountForm, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">{t("common.dollar")} ($)</SelectItem>
                          <SelectItem value="IQD">{t("common.dinar")} (IQD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="accountDesc">{t("common.description")}</Label>
                    <Textarea
                      id="accountDesc"
                      value={accountForm.description}
                      onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })}
                      placeholder={t("treasury.accountDescription")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddAccount(false)}>{t("common.cancel")}</Button>
                  <Button onClick={handleCreateAccount} disabled={createAccount.isPending}>
                    {createAccount.isPending ? t("common.loading") : t("common.add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("treasury.totalCurrency")}</CardTitle>
              <PiggyBank className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                {formatCurrency(totalBalance)}
              </div>
              <p className="text-xs text-green-600/70">{t("finance.allAccounts")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("treasury.cashBoxBalance")}</CardTitle>
              <Banknote className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(cashBalance)}
              </div>
              <p className="text-xs text-muted-foreground">{t("treasury.cashMoney")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("finance.bank")}</CardTitle>
              <Landmark className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(bankBalance)}
              </div>
              <p className="text-xs text-muted-foreground">{t("companyFinance.bankAccounts")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("finance.accounts")}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.filter(a => a.isActive).length}</div>
              <p className="text-xs text-muted-foreground">{t("finance.activeAccounts")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.filter(a => a.isActive).map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      account.accountType === "cash" 
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                        : account.accountType === "bank"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                    }`}>
                      {getAccountIcon(account.accountType)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{account.accountName}</CardTitle>
                      <CardDescription className="text-xs">
                        {getAccountLabel(account.accountType)}
                        {account.bankName && ` - ${account.bankName}`}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Balance */}
                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t("treasury.currentBalance")}</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(account.currentBalance)}
                  </p>
                </div>

                {/* Account Number */}
                {account.accountNumber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t("treasury.accountNumber")}:</span>
                    <span className="font-mono">{account.accountNumber}</span>
                  </div>
                )}

                {/* Initial Balance */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("treasury.initialBalance")}:</span>
                  <span>{formatCurrency(account.initialBalance)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedAccountId(account.id);
                      setShowTransactions(true);
                    }}
                  >
                    <History className="me-2 h-4 w-4" />
                    {t("common.history")}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setTransactionForm({ ...transactionForm, accountId: account.id.toString() });
                      setShowAddTransaction(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(t("treasury.confirmDelete"))) {
                        deleteAccount.mutate({ id: account.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Transactions Dialog */}
        <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{t("treasury.transactionHistory")}</DialogTitle>
              <DialogDescription>
                {accounts.find(a => a.id === selectedAccountId)?.accountName}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.type")}</TableHead>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.amount")}</TableHead>
                    <TableHead className="text-right">{t("finance.balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t("treasury.noTransactionsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell className="font-medium">
                          {formatDate(txn.transactionDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getTransactionIcon(txn.transactionType)}
                            <span className="text-sm">{getTransactionLabel(txn.transactionType)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{txn.description || "-"}</TableCell>
                        <TableCell className={`text-right font-medium ${
                          txn.transactionType === "deposit" || txn.transactionType === "transfer_in"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}>
                          {txn.transactionType === "deposit" || txn.transactionType === "transfer_in" ? "+" : "-"}
                          {formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(txn.balanceAfter)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
