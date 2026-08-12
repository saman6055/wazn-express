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
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  PiggyBank,
  History,
  User,
  Phone,
  Mail,
  Percent,
  Trash2,
  Eye,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Partners() {
    const { t } = useTranslation();
const [activeTab, setActiveTab] = useState("partners");
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);

  // Form states
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    nameKu: "",
    email: "",
    phone: "",
    ownershipPercentage: "",
    initialCapital: "",
    joinDate: new Date().toISOString().split('T')[0],
    notes: "",
  });

  const [transactionForm, setTransactionForm] = useState({
    partnerId: "",
    transactionType: "capital_contribution",
    amount: "",
    currency: "USD",
    description: "",
    transactionDate: new Date().toISOString().split('T')[0],
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    notes: "",
  });

  // Queries
  const { data: partners = [], refetch: refetchPartners } = trpc.partners.list.useQuery();
  const { data: partnerTransactions = [] } = trpc.partners.getTransactions.useQuery(
    { partnerId: selectedPartnerId || 0, limit: 100 },
    { enabled: !!selectedPartnerId }
  );

  // Mutations
  const createPartner = trpc.partners.create.useMutation({
    onSuccess: () => {
      toast.success(t("partners.partnerAdded"));
      setShowAddPartner(false);
      refetchPartners();
      resetPartnerForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deletePartner = trpc.partners.delete.useMutation({
    onSuccess: () => {
      toast.success(t("partners.partnerDeleted"));
      refetchPartners();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const addTransaction = trpc.partners.addTransaction.useMutation({
    onSuccess: () => {
      toast.success(t("partners.transactionRecorded"));
      setShowAddTransaction(false);
      refetchPartners();
      resetTransactionForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetPartnerForm = () => {
    setPartnerForm({
      name: "",
      nameKu: "",
      email: "",
      phone: "",
      ownershipPercentage: "",
      initialCapital: "",
      joinDate: new Date().toISOString().split('T')[0],
      notes: "",
    });
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      partnerId: "",
      transactionType: "capital_contribution",
      amount: "",
      currency: "USD",
      description: "",
      transactionDate: new Date().toISOString().split('T')[0],
      periodMonth: new Date().getMonth() + 1,
      periodYear: new Date().getFullYear(),
      notes: "",
    });
  };

  const handleCreatePartner = () => {
    if (!partnerForm.name || !partnerForm.ownershipPercentage) {
      toast.error(t("partners.fillNameAndCapital"));
      return;
    }

    createPartner.mutate({
      name: partnerForm.name,
      nameKu: partnerForm.nameKu || undefined,
      email: partnerForm.email || undefined,
      phone: partnerForm.phone || undefined,
      ownershipPercentage: partnerForm.ownershipPercentage,
      initialCapital: partnerForm.initialCapital || "0",
      joinDate: new Date(partnerForm.joinDate),
      notes: partnerForm.notes || undefined,
    });
  };

  const handleAddTransaction = () => {
    if (!transactionForm.partnerId || !transactionForm.amount) {
      toast.error(t("common.fillAllFields"));
      return;
    }

    addTransaction.mutate({
      partnerId: parseInt(transactionForm.partnerId),
      transactionType: transactionForm.transactionType as any,
      amount: transactionForm.amount,
      currency: transactionForm.currency as "USD" | "IQD",
      amountUsd: transactionForm.currency === "USD" 
        ? transactionForm.amount 
        : (parseFloat(transactionForm.amount) / 1480).toFixed(2),
      description: transactionForm.description || undefined,
      transactionDate: new Date(transactionForm.transactionDate),
      periodMonth: transactionForm.periodMonth,
      periodYear: transactionForm.periodYear,
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

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      capital_contribution: { label: t("auto.text_cdeec4"), color: "text-green-600", icon: <ArrowUpRight className="h-4 w-4" /> },
      profit_share: { label: t("auto.text_8857f0"), color: "text-green-600", icon: <TrendingUp className="h-4 w-4" /> },
      withdrawal: { label: t("auto.text_e592cb"), color: "text-red-600", icon: <ArrowDownRight className="h-4 w-4" /> },
      loan_to_company: { label: t("auto.text_88ccc9"), color: "text-blue-600", icon: <ArrowUpRight className="h-4 w-4" /> },
      loan_repayment: { label: t("auto.text_cf62f1"), color: "text-orange-600", icon: <ArrowDownRight className="h-4 w-4" /> },
      adjustment: { label: t("auto.text_44988a"), color: "text-gray-600", icon: <History className="h-4 w-4" /> },
    };
    return labels[type] || { label: type, color: "text-gray-600", icon: null };
  };

  // Calculate totals
  const totalCapital = partners.reduce((sum, p) => sum + Number(p.initialCapital), 0);
  const totalRetained = partners.reduce((sum, p) => sum + Number(p.currentBalance), 0);
  const totalEquity = totalCapital + totalRetained;

  // PDF Export
  const generatePartnerPDF = trpc.financialReports.generatePartnerReportPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success(t("partners.pdfGenerated"));
    },
    onError: () => toast.error(t("common.pdfError")),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("partners.management")}</h1>
            <p className="text-muted-foreground">
              {t("partners.trackCapitalAndBalance")}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedPartnerId && (
              <Button
                variant="outline"
                onClick={() => {
                  const startDate = new Date();
                  startDate.setMonth(startDate.getMonth() - 12);
                  generatePartnerPDF.mutate({
                    partnerId: selectedPartnerId,
                    startDate,
                    endDate: new Date(),
                  });
                }}
                disabled={generatePartnerPDF.isPending}
              >
                <Download className="me-2 h-4 w-4" />
                {generatePartnerPDF.isPending ? t("common.loading") : 'PDF'}
              </Button>
            )}
            <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Wallet className="me-2 h-4 w-4" />
                  {t("partners.newTransaction")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("partners.recordTransaction")}</DialogTitle>
                  <DialogDescription>
                    {t("partners.recordTransactionDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="txnPartner">{t("partners.partner")}</Label>
                    <Select
                      value={transactionForm.partnerId}
                      onValueChange={(value) => setTransactionForm({ ...transactionForm, partnerId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("partners.selectPartner")} />
                      </SelectTrigger>
                      <SelectContent>
                        {partners.map((partner) => (
                          <SelectItem key={partner.id} value={partner.id.toString()}>
                            {partner.nameKu || partner.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="txnType">{t("partners.transactionType")}</Label>
                    <Select
                      value={transactionForm.transactionType}
                      onValueChange={(value) => setTransactionForm({ ...transactionForm, transactionType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="capital_contribution">💰 {t("partners.capitalContribution")}</SelectItem>
                        <SelectItem value="profit_share">📈 {t("partners.profitShare")}</SelectItem>
                        <SelectItem value="withdrawal">📤 {t("partners.withdrawal")}</SelectItem>
                        <SelectItem value="loan_to_company">🏦 {t("partners.loanToCompany")}</SelectItem>
                        <SelectItem value="loan_repayment">💸 {t("partners.loanRepayment")}</SelectItem>
                        <SelectItem value="adjustment">⚙️ {t("partners.adjustment")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
                  {transactionForm.transactionType === "profit_share" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="txnMonth">{t("common.month")}</Label>
                        <Select
                          value={transactionForm.periodMonth.toString()}
                          onValueChange={(value) => setTransactionForm({ ...transactionForm, periodMonth: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                              <SelectItem key={m} value={m.toString()}>{t("common.month")} {m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="txnYear">{t("common.year")}</Label>
                        <Input
                          id="txnYear"
                          type="number"
                          value={transactionForm.periodYear}
                          onChange={(e) => setTransactionForm({ ...transactionForm, periodYear: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="txnDesc">{t("common.description")}</Label>
                    <Input
                      id="txnDesc"
                      value={transactionForm.description}
                      onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                      placeholder={t("partners.transactionDescription")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="txnNotes">{t("common.notes")}</Label>
                    <Textarea
                      id="txnNotes"
                      value={transactionForm.notes}
                      onChange={(e) => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                      placeholder={t("common.additionalNotes")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddTransaction(false)}>{t("common.cancel")}</Button>
                  <Button onClick={handleAddTransaction} disabled={addTransaction.isPending}>
                    {addTransaction.isPending ? t("common.loading") : t("common.register")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddPartner} onOpenChange={setShowAddPartner}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="me-2 h-4 w-4" />
                {t("partners.newPartner")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("partners.addPartner")}</DialogTitle>
                  <DialogDescription>
                    {t("partners.addPartnerDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="partnerName">{t("common.nameEn")}</Label>
                      <Input
                        id="partnerName"
                        value={partnerForm.name}
                        onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                        placeholder="Ahmed Ali"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="partnerNameKu">{t("common.nameKu")}</Label>
                      <Input
                        id="partnerNameKu"
                        value={partnerForm.nameKu}
                        onChange={(e) => setPartnerForm({ ...partnerForm, nameKu: e.target.value })}
                        placeholder={t("common.namePlaceholder")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="partnerEmail">{t("customers.email")}</Label>
                      <Input
                        id="partnerEmail"
                        type="email"
                        value={partnerForm.email}
                        onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                        placeholder="ahmed@example.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="partnerPhone">{t("customers.phone")}</Label>
                      <Input
                        id="partnerPhone"
                        value={partnerForm.phone}
                        onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                        placeholder="07501234567"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ownership">{t("partners.ownershipPercentage")}</Label>
                      <Input
                        id="ownership"
                        type="number"
                        step="0.01"
                        max="100"
                        value={partnerForm.ownershipPercentage}
                        onChange={(e) => setPartnerForm({ ...partnerForm, ownershipPercentage: e.target.value })}
                        placeholder="50"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="initialCapital">{t("partners.initialCapital")}</Label>
                      <Input
                        id="initialCapital"
                        type="number"
                        step="0.01"
                        value={partnerForm.initialCapital}
                        onChange={(e) => setPartnerForm({ ...partnerForm, initialCapital: e.target.value })}
                        placeholder="10000"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="joinDate">{t("partners.joinDate")}</Label>
                    <Input
                      id="joinDate"
                      type="date"
                      value={partnerForm.joinDate}
                      onChange={(e) => setPartnerForm({ ...partnerForm, joinDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="partnerNotes">{t("common.notes")}</Label>
                    <Textarea
                      id="partnerNotes"
                      value={partnerForm.notes}
                      onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                      placeholder={t("common.additionalNotes")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddPartner(false)}>{t("common.cancel")}</Button>
                  <Button onClick={handleCreatePartner} disabled={createPartner.isPending}>
                    {createPartner.isPending ? t("common.loading") : t("common.add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("partners.totalCapital")}</CardTitle>
              <PiggyBank className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                {formatCurrency(totalCapital)}
              </div>
              <p className="text-xs text-muted-foreground">{t("partners.initialCapitalDesc")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("partners.accumulatedBalance")}</CardTitle>
              <Wallet className="h-4 w-4 text-green-500 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalRetained >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalRetained)}
              </div>
              <p className="text-xs text-muted-foreground">{t("partners.retainedEarnings")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("partners.totalOwnersEquity")}</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                {formatCurrency(totalEquity)}
              </div>
              <p className="text-xs text-muted-foreground">{t("partners.capitalPlusBalance")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("partners.partnerCount")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{partners.length}</div>
              <p className="text-xs text-muted-foreground">{t("partners.activePartner")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Partner Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => {
            const equity = Number(partner.initialCapital) + Number(partner.currentBalance);
            return (
              <Card key={partner.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{partner.nameKu || partner.name}</CardTitle>
                        {partner.nameKu && (
                          <CardDescription>{partner.name}</CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-lg font-bold">
                      {partner.ownershipPercentage}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {/* Contact Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {partner.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {partner.phone}
                        </div>
                      )}
                      {partner.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {partner.email}
                        </div>
                      )}
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
                        <p className="text-xs text-muted-foreground">{t("partners.initialCapitalDesc")}</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-300">
                          {formatCurrency(partner.initialCapital)}
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 ${Number(partner.currentBalance) >= 0 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                        <p className="text-xs text-muted-foreground">{t("partners.accumulatedBalance")}</p>
                        <p className={`text-lg font-bold ${Number(partner.currentBalance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(partner.currentBalance)}
                        </p>
                      </div>
                    </div>

                    {/* Total Equity */}
                    <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{t("partners.totalCapital")}</p>
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-300">
                          {formatCurrency(equity)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedPartnerId(partner.id);
                          setShowTransactions(true);
                        }}
                      >
                        <Eye className="me-2 h-4 w-4" />
                        {t("common.history")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTransactionForm({ ...transactionForm, partnerId: partner.id.toString() });
                          setShowAddTransaction(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(t("partners.confirmDelete"))) {
                            deletePartner.mutate({ id: partner.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Transactions Dialog */}
        <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{t("partners.transactionHistory")}</DialogTitle>
              <DialogDescription>
                {partners.find(p => p.id === selectedPartnerId)?.nameKu || 
                 partners.find(p => p.id === selectedPartnerId)?.name}
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
                  {partnerTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t("partners.noTransactionsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    partnerTransactions.map((txn) => {
                      const typeInfo = getTransactionTypeLabel(txn.transactionType);
                      return (
                        <TableRow key={txn.id}>
                          <TableCell className="font-medium">
                            {formatDate(txn.transactionDate)}
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${typeInfo.color}`}>
                              {typeInfo.icon}
                              {typeInfo.label}
                            </div>
                          </TableCell>
                          <TableCell>{txn.description || "-"}</TableCell>
                          <TableCell className={`text-right font-medium ${typeInfo.color}`}>
                            {formatCurrency(txn.amountUsd)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(txn.balanceAfter)}
                          </TableCell>
                        </TableRow>
                      );
                    })
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
