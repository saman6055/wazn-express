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
  Download,
  AlertTriangle
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
  // The statement, already ordered oldest-first with both balances carried.
  const { data: ledger } = trpc.partners.ledger.useQuery(
    { partnerId: selectedPartnerId || 0 },
    { enabled: !!selectedPartnerId }
  );
  const ledgerLines = ledger?.lines ?? [];

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

  /**
   * Both books, worked out on the server.
   *
   * The page used to add initialCapital to currentBalance and call the result
   * equity. currentBalance holds every movement there has ever been — capital,
   * profit, drawings, and money the partner merely *lent* the company — so the
   * figure counted a loan the company has to pay back as ownership the partner
   * holds. Two different things under one heading.
   *
   * shared/partnerLedger.ts separates them, and this reads its answer rather
   * than doing arithmetic of its own.
   */
  const { data: overview } = trpc.partners.overview.useQuery();
  const rows = overview?.rows ?? [];
  const totals = overview?.totals;
  const ownership = overview?.ownership;
  const unreconciled = rows.filter((r) => !r.reconciliation.agrees);

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

        {/* What the books say, before anything else on the page.
            A discrepancy stated at the top is a question to answer; the same
            discrepancy found three screens later is a system nobody trusts. */}
        {(unreconciled.length > 0 || (ownership && !ownership.agrees)) && (
          <div className="space-y-2">
            {unreconciled.map((row) => (
              <div
                key={row.partner.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{row.partner.nameKu || row.partner.name}</span>
                <span>— {t("partners.booksDisagree")}.</span>
                <span>{t("partners.reconcileExplain")}</span>
                <span className="font-mono font-bold">{formatCurrency(row.reconciliation.difference)}</span>
              </div>
            ))}
            {ownership && !ownership.agrees && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{t("partners.ownershipIncomplete")}.</span>
                <span>{t("partners.ownershipExplain")}</span>
                <span className="font-mono font-bold">{ownership.total.toFixed(2)}%</span>
              </div>
            )}
          </div>
        )}

        {/* The four figures, each meaning one thing */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-200">{t("partners.totalPaidIn")}</CardTitle>
              <PiggyBank className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-200">
                {formatCurrency(totals?.contributed ?? 0)}
              </div>
              <p className="text-xs text-blue-600/80 dark:text-blue-300/80">{t("partners.contributedCapital")}</p>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-200">{t("partners.profitShareTotal")}</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-200">
                {formatCurrency(totals?.profitShare ?? 0)}
              </div>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-300/80">{t("partners.capitalAccount")}</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-200">{t("partners.totalDrawings")}</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-orange-600 dark:text-orange-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-orange-700 dark:text-orange-200">
                {formatCurrency(totals?.drawings ?? 0)}
              </div>
              <p className="text-xs text-orange-600/80 dark:text-orange-300/80">{t("partners.drawings")}</p>
            </CardContent>
          </Card>

          <Card className="bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-200">{t("partners.totalEquityNow")}</CardTitle>
              <DollarSign className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-violet-700 dark:text-violet-200">
                {formatCurrency(totals?.equity ?? 0)}
              </div>
              <p className="text-xs text-violet-600/80 dark:text-violet-300/80">{t("partners.equityNote")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Partner loans are a liability. They only appear when they exist —
            a $0.00 tile for something the company does not owe is noise. */}
        {(totals?.liability ?? 0) !== 0 && (
          <Card className="bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                <div>
                  <p className="text-sm font-medium text-sky-700 dark:text-sky-200">{t("partners.totalOwedToPartners")}</p>
                  <p className="text-xs text-sky-600/80 dark:text-sky-300/80">{t("partners.liabilityNote")}</p>
                </div>
              </div>
              <p className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-200">
                {formatCurrency(totals?.liability ?? 0)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Partner Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => {
            // Both books for this partner, as the server worked them out. Until
            // the query lands there is nothing to show, so the card falls back
            // to empty accounts rather than to a wrong number.
            const row = rows.find((r) => r.partner.id === partner.id);
            const accounts = row?.accounts ?? {
              capital: { opening: Number(partner.initialCapital) || 0, contributed: 0, profitShare: 0, adjustments: 0, drawings: 0, closing: Number(partner.initialCapital) || 0 },
              loan: { lent: 0, repaid: 0, outstanding: 0 },
              unclassified: 0,
            };
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

                    {/* The capital account, laid out the way it is read:
                        each line, then the rule, then the figure it comes to.
                        A total with its workings hidden is a number you have
                        to take on trust. */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("partners.capitalAccount")}
                      </p>
                      <dl className="space-y-1.5 text-sm">
                        {accounts.capital.opening !== 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted-foreground">{t("partners.openingCapital")}</dt>
                            <dd className="font-mono">{formatCurrency(accounts.capital.opening)}</dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{t("partners.contributedCapital")}</dt>
                          <dd className="font-mono text-blue-600 dark:text-blue-300">
                            {formatCurrency(accounts.capital.contributed)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{t("partners.profitShareTotal")}</dt>
                          <dd className="font-mono text-emerald-600 dark:text-emerald-300">
                            {formatCurrency(accounts.capital.profitShare)}
                          </dd>
                        </div>
                        {accounts.capital.adjustments !== 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-muted-foreground">{t("partners.adjustments")}</dt>
                            <dd className="font-mono">{formatCurrency(accounts.capital.adjustments)}</dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{t("partners.drawings")}</dt>
                          <dd className="font-mono text-orange-600 dark:text-orange-300">
                            −{formatCurrency(accounts.capital.drawings)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                          <dt className="font-semibold">{t("partners.closingCapital")}</dt>
                          <dd
                            className={`font-mono text-lg font-bold ${
                              accounts.capital.closing >= 0
                                ? "text-violet-600 dark:text-violet-300"
                                : "text-red-600 dark:text-red-300"
                            }`}
                          >
                            {formatCurrency(accounts.capital.closing)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* The loan account, kept in its own box because it is not
                        the partner's money in the company — it is the
                        company's debt to them. */}
                    {accounts.loan.outstanding !== 0 && (
                      <div className="rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-200">
                          {t("partners.loanAccount")}
                        </p>
                        <dl className="space-y-1.5 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-sky-700/80 dark:text-sky-300/80">{t("partners.lentToCompany")}</dt>
                            <dd className="font-mono text-sky-700 dark:text-sky-200">{formatCurrency(accounts.loan.lent)}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt className="text-sky-700/80 dark:text-sky-300/80">{t("partners.repaidByCompany")}</dt>
                            <dd className="font-mono text-sky-700 dark:text-sky-200">−{formatCurrency(accounts.loan.repaid)}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-sky-200 dark:border-sky-900/60 pt-2">
                            <dt className="font-semibold text-sky-800 dark:text-sky-100">{t("partners.loanOutstanding")}</dt>
                            <dd className="font-mono text-lg font-bold text-sky-800 dark:text-sky-100">
                              {formatCurrency(accounts.loan.outstanding)}
                            </dd>
                          </div>
                        </dl>
                        <p className="mt-2 text-xs text-sky-600/80 dark:text-sky-300/80">{t("partners.liabilityNote")}</p>
                      </div>
                    )}

                    {row && !row.reconciliation.agrees && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {t("partners.booksDisagree")}: {formatCurrency(row.reconciliation.difference)}
                        </span>
                      </div>
                    )}

                    {accounts.unclassified > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {t("partners.unclassifiedEntries")}: {accounts.unclassified}
                        </span>
                      </div>
                    )}

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
            {/* Two balances, carried down the page separately.
                The stored balanceAfter this used to print is the single mixed
                figure, so a loan repayment made a partner's capital appear to
                shrink. Oldest first, because a running balance read from the
                newest row down is the account run backwards. */}
            <div className="overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("common.type")}</TableHead>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.amount")}</TableHead>
                    <TableHead className="text-right">{t("partners.capitalBalance")}</TableHead>
                    <TableHead className="text-right">{t("partners.loanBalance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("partners.noMovements")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerLines.map((line) => {
                      const typeInfo = getTransactionTypeLabel(line.transactionType);
                      return (
                        <TableRow key={line.index}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDate(line.transactionDate)}
                          </TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${typeInfo.color}`}>
                              {typeInfo.icon}
                              {typeInfo.label}
                            </div>
                          </TableCell>
                          <TableCell>{line.description || "-"}</TableCell>
                          <TableCell className={`text-right font-mono font-medium ${line.movement < 0 ? "text-orange-600 dark:text-orange-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                            {line.movement < 0 ? "−" : "+"}{formatCurrency(Math.abs(line.movement))}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${line.book === "capital" ? "font-semibold" : "text-muted-foreground"}`}>
                            {formatCurrency(line.capitalBalance)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${line.book === "loan" ? "font-semibold text-sky-700 dark:text-sky-200" : "text-muted-foreground"}`}>
                            {formatCurrency(line.loanBalance)}
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
