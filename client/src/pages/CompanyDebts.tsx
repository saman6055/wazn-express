import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Landmark,
  User,
  Building2,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Calendar,
  CreditCard,
  Percent,
  Trash2,
  Eye,
  Receipt,
  ArrowDownRight,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

export default function CompanyDebts() {
    const { t } = useTranslation();
const [showAddDebt, setShowAddDebt] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null);

  // Form states
  const [debtForm, setDebtForm] = useState({
    creditorName: "",
    creditorType: "personal",
    creditorPhone: "",
    creditorEmail: "",
    principalAmount: "",
    currency: "USD",
    interestRate: "0",
    startDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    installmentCount: "",
    purpose: "",
    collateral: "",
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    debtId: "",
    amount: "",
    currency: "USD",
    principalPaid: "",
    interestPaid: "0",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "cash",
    referenceNumber: "",
    notes: "",
  });

  // Queries
  const { data: debts = [], refetch: refetchDebts } = trpc.companyDebts.list.useQuery();
  const { data: debtPayments = [] } = trpc.companyDebts.getPayments.useQuery(
    { debtId: selectedDebtId || 0 },
    { enabled: !!selectedDebtId }
  );

  // Mutations
  const createDebt = trpc.companyDebts.create.useMutation({
    onSuccess: () => {
      toast.success(t("debts.debtAdded"));
      setShowAddDebt(false);
      refetchDebts();
      resetDebtForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteDebt = trpc.companyDebts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("messages.debtDeleted"));
      refetchDebts();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const recordPayment = trpc.companyDebts.recordPayment.useMutation({
    onSuccess: () => {
      toast.success(t("finance.paymentCreated"));
      setShowRecordPayment(false);
      refetchDebts();
      resetPaymentForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetDebtForm = () => {
    setDebtForm({
      creditorName: "",
      creditorType: "personal",
      creditorPhone: "",
      creditorEmail: "",
      principalAmount: "",
      currency: "USD",
      interestRate: "0",
      startDate: new Date().toISOString().split('T')[0],
      dueDate: "",
      installmentCount: "",
      purpose: "",
      collateral: "",
      notes: "",
    });
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      debtId: "",
      amount: "",
      currency: "USD",
      principalPaid: "",
      interestPaid: "0",
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: "cash",
      referenceNumber: "",
      notes: "",
    });
  };

  const handleCreateDebt = () => {
    if (!debtForm.creditorName || !debtForm.principalAmount) {
      toast.error(t("debts.fillCreditorAndAmount"));
      return;
    }

    const principal = parseFloat(debtForm.principalAmount);
    const interestRate = parseFloat(debtForm.interestRate) || 0;
    const totalInterest = (principal * interestRate) / 100;
    const totalAmount = principal + totalInterest;

    createDebt.mutate({
      creditorName: debtForm.creditorName,
      creditorType: debtForm.creditorType as any,
      creditorPhone: debtForm.creditorPhone || undefined,
      creditorEmail: debtForm.creditorEmail || undefined,
      principalAmount: debtForm.principalAmount,
      currency: debtForm.currency as "USD" | "IQD",
      principalAmountUsd: debtForm.currency === "USD" 
        ? debtForm.principalAmount 
        : (principal / 1480).toFixed(2),
      interestRate: debtForm.interestRate,
      totalInterest: totalInterest.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      remainingAmount: totalAmount.toFixed(2),
      startDate: new Date(debtForm.startDate),
      dueDate: debtForm.dueDate ? new Date(debtForm.dueDate) : undefined,
      installmentCount: debtForm.installmentCount ? parseInt(debtForm.installmentCount) : undefined,
      installmentAmount: debtForm.installmentCount 
        ? (totalAmount / parseInt(debtForm.installmentCount)).toFixed(2) 
        : undefined,
      purpose: debtForm.purpose || undefined,
      collateral: debtForm.collateral || undefined,
      notes: debtForm.notes || undefined,
    });
  };

  const handleRecordPayment = () => {
    if (!paymentForm.debtId || !paymentForm.amount) {
      toast.error(t("common.fillAllFields"));
      return;
    }

    recordPayment.mutate({
      debtId: parseInt(paymentForm.debtId),
      amount: paymentForm.amount,
      currency: paymentForm.currency as "USD" | "IQD",
      amountUsd: paymentForm.currency === "USD" 
        ? paymentForm.amount 
        : (parseFloat(paymentForm.amount) / 1480).toFixed(2),
      principalPaid: paymentForm.principalPaid || paymentForm.amount,
      interestPaid: paymentForm.interestPaid || "0",
      paymentDate: new Date(paymentForm.paymentDate),
      paymentMethod: paymentForm.paymentMethod as any,
      referenceNumber: paymentForm.referenceNumber || undefined,
      notes: paymentForm.notes || undefined,
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ku-Arab", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCreditorIcon = (type: string) => {
    switch (type) {
      case "personal": return <User className="h-4 w-4" />;
      case "bank": return <Landmark className="h-4 w-4" />;
      case "supplier": return <Truck className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  const getCreditorLabel = (type: string) => {
    switch (type) {
      case "personal": return t("debts.personal");
      case "bank": return t("finance.bank");
      case "supplier": return t("fullPackage.supplier");
      default: return t("common.other");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">{t("common.active")}</Badge>;
      case "paid":
        return <Badge variant="secondary" className="bg-green-100 text-green-700">{t("debts.paid")}</Badge>;
      case "overdue":
        return <Badge variant="secondary" className="bg-red-100 text-red-700">{t("invoices.overdue")}</Badge>;
      case "restructured":
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700">{t("debts.restructured")}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Calculate totals
  const totalDebt = debts.reduce((sum, d) => sum + Number(d.totalAmount), 0);
  const totalPaid = debts.reduce((sum, d) => sum + Number(d.paidAmount), 0);
  const totalRemaining = debts.reduce((sum, d) => sum + Number(d.remainingAmount), 0);
  const activeDebts = debts.filter(d => d.status === "active").length;
  const overdueDebts = debts.filter(d => d.status === "overdue").length;

  // PDF Export
  const generateDebtPDF = trpc.financialReports.generateDebtSchedulePDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success(t("debts.pdfGenerated"));
    },
    onError: () => toast.error(t("debts.pdfError")),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("debts.title")}</h1>
            <p className="text-muted-foreground">
              {t("debts.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generateDebtPDF.mutate()}
              disabled={generateDebtPDF.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {generateDebtPDF.isPending ? t("common.loading") : 'PDF'}
            </Button>
            <Dialog open={showRecordPayment} onOpenChange={setShowRecordPayment}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <CreditCard className="mr-2 h-4 w-4" />{t("portal.payNow")}</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("finance.recordPayment")}</DialogTitle>
                  <DialogDescription>
                    {t("debts.recordPaymentDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payDebt">{t("finance.debt")}</Label>
                    <Select
                      value={paymentForm.debtId}
                      onValueChange={(value) => setPaymentForm({ ...paymentForm, debtId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("debts.selectDebt")} />
                      </SelectTrigger>
                      <SelectContent>
                        {debts.filter(d => d.status === "active" || d.status === "overdue").map((debt) => (
                          <SelectItem key={debt.id} value={debt.id.toString()}>
                            {debt.creditorName} - {formatCurrency(debt.remainingAmount)} {t("debts.remaining")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="payAmount">{t("finance.paymentAmount")}</Label>
                      <Input
                        id="payAmount"
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value, principalPaid: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payCurrency">{t("countries.currency")}</Label>
                      <Select
                        value={paymentForm.currency}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, currency: value })}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="payDate">{t("common.date")}</Label>
                      <Input
                        id="payDate"
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payMethod">{t("finance.method")}</Label>
                      <Select
                        value={paymentForm.paymentMethod}
                        onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">{t("finance.cash")}</SelectItem>
                          <SelectItem value="bank_transfer">{t("finance.bank")}</SelectItem>
                          <SelectItem value="card">{t("finance.card")}</SelectItem>
                          <SelectItem value="other">{t("common.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="payRef">{t("invoices.invoiceNumber")}</Label>
                    <Input
                      id="payRef"
                      value={paymentForm.referenceNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                      placeholder="PAY-001"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="payNotes">{t("common.notes")}</Label>
                    <Textarea
                      id="payNotes"
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder={t("common.additionalNotes")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRecordPayment(false)}>{t("forms.cancel")}</Button>
                  <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
                    {recordPayment.isPending ? t("common.loading") : t("common.register")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddDebt} onOpenChange={setShowAddDebt}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                {t("debts.newDebt")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>{t("debts.recordDebt")}</DialogTitle>
                  <DialogDescription>
                    {t("debts.recordDebtDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="creditorName">{t("debts.creditorName")}</Label>
                      <Input
                        id="creditorName"
                        value={debtForm.creditorName}
                        onChange={(e) => setDebtForm({ ...debtForm, creditorName: e.target.value })}
                        placeholder={t("debts.creditorNamePlaceholder")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="creditorType">{t("debts.creditorType")}</Label>
                      <Select
                        value={debtForm.creditorType}
                        onValueChange={(value) => setDebtForm({ ...debtForm, creditorType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">👤 {t("debts.personal")}</SelectItem>
                          <SelectItem value="bank">🏦 {t("finance.bank")}</SelectItem>
                          <SelectItem value="supplier">🚚 {t("fullPackage.supplier")}</SelectItem>
                          <SelectItem value="other">📋 {t("common.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="creditorPhone">{t("customers.form.mobileNumber")}</Label>
                      <Input
                        id="creditorPhone"
                        value={debtForm.creditorPhone}
                        onChange={(e) => setDebtForm({ ...debtForm, creditorPhone: e.target.value })}
                        placeholder="07501234567"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="creditorEmail">{t("customers.email")}</Label>
                      <Input
                        id="creditorEmail"
                        type="email"
                        value={debtForm.creditorEmail}
                        onChange={(e) => setDebtForm({ ...debtForm, creditorEmail: e.target.value })}
                        placeholder="creditor@example.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="principalAmount">{t("companyFinance.debtAmount")}</Label>
                      <Input
                        id="principalAmount"
                        type="number"
                        step="0.01"
                        value={debtForm.principalAmount}
                        onChange={(e) => setDebtForm({ ...debtForm, principalAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="debtCurrency">{t("countries.currency")}</Label>
                      <Select
                        value={debtForm.currency}
                        onValueChange={(value) => setDebtForm({ ...debtForm, currency: value })}
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
                    <div className="grid gap-2">
                      <Label htmlFor="interestRate">{t("debts.interestRate")}</Label>
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.01"
                        value={debtForm.interestRate}
                        onChange={(e) => setDebtForm({ ...debtForm, interestRate: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startDate">{t("debts.startDate")}</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={debtForm.startDate}
                        onChange={(e) => setDebtForm({ ...debtForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dueDate">{t("debts.dueDate")}</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={debtForm.dueDate}
                        onChange={(e) => setDebtForm({ ...debtForm, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="installmentCount">{t("debts.installmentCount")}</Label>
                    <Input
                      id="installmentCount"
                      type="number"
                      value={debtForm.installmentCount}
                      onChange={(e) => setDebtForm({ ...debtForm, installmentCount: e.target.value })}
                      placeholder="12"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="purpose">{t("debts.purpose")}</Label>
                    <Input
                      id="purpose"
                      value={debtForm.purpose}
                      onChange={(e) => setDebtForm({ ...debtForm, purpose: e.target.value })}
                      placeholder={t("debts.purposePlaceholder")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="collateral">{t("debts.collateral")}</Label>
                    <Input
                      id="collateral"
                      value={debtForm.collateral}
                      onChange={(e) => setDebtForm({ ...debtForm, collateral: e.target.value })}
                      placeholder={t("debts.collateralPlaceholder")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="debtNotes">{t("common.notes")}</Label>
                    <Textarea
                      id="debtNotes"
                      value={debtForm.notes}
                      onChange={(e) => setDebtForm({ ...debtForm, notes: e.target.value })}
                      placeholder={t("common.additionalNotes")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDebt(false)}>{t("forms.cancel")}</Button>
                  <Button onClick={handleCreateDebt} disabled={createDebt.isPending}>
                    {createDebt.isPending ? t("common.loading") : t("common.register")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("finance.totalDebt")}</CardTitle>
              <DollarSign className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalDebt)}
              </div>
              <p className="text-xs text-muted-foreground">{t("debts.totalPlusInterest")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("debts.paidBack")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground">{t("debts.totalPaid")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("forms.remaining")}</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(totalRemaining)}
              </div>
              <p className="text-xs text-muted-foreground">{t("debts.mustBePaid")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("common.active")}</CardTitle>
              <Landmark className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeDebts}</div>
              <p className="text-xs text-muted-foreground">{t("debts.activeDebts")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("invoices.overdue")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueDebts}</div>
              <p className="text-xs text-muted-foreground">{t("debts.needsToBePaid")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Debts List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {debts.map((debt) => {
            const progress = (Number(debt.paidAmount) / Number(debt.totalAmount)) * 100;
            return (
              <Card key={debt.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                        {getCreditorIcon(debt.creditorType)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{debt.creditorName}</CardTitle>
                        <CardDescription className="text-xs">
                          {getCreditorLabel(debt.creditorType)}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(debt.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Amount Info */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("debts.totalDebt")}:</span>
                      <span className="font-medium">{formatCurrency(debt.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("debts.paidBack")}:</span>
                      <span className="font-medium text-green-600">{formatCurrency(debt.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("debts.remaining")}:</span>
                      <span className="font-medium text-red-600">{formatCurrency(debt.remainingAmount)}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t("companyFinance.progress")}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Dates */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t("debts.start")}: {formatDate(debt.startDate)}
                    </div>
                    {debt.dueDate && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t("debts.end")}: {formatDate(debt.dueDate)}
                      </div>
                    )}
                  </div>

                  {/* Interest & Installment */}
                  {(Number(debt.interestRate) > 0 || debt.installmentCount) && (
                    <div className="flex gap-2 flex-wrap">
                      {Number(debt.interestRate) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Percent className="mr-1 h-3 w-3" />
                          {debt.interestRate}% {t("debts.interest")}
                        </Badge>
                      )}
                      {debt.installmentCount && (
                        <Badge variant="outline" className="text-xs">
                          {debt.installmentCount} {t("debts.installments")}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedDebtId(debt.id);
                        setShowPayments(true);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />{t("finance.payments")}</Button>
                    {(debt.status === "active" || debt.status === "overdue") && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setPaymentForm({ ...paymentForm, debtId: debt.id.toString() });
                          setShowRecordPayment(true);
                        }}
                      >
                        <ArrowDownRight className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(t("debts.confirmDelete"))) {
                          deleteDebt.mutate({ id: debt.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payments Dialog */}
        <Dialog open={showPayments} onOpenChange={setShowPayments}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{t("customers.paymentHistory")}</DialogTitle>
              <DialogDescription>
                {debts.find(d => d.id === selectedDebtId)?.creditorName}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.date")}</TableHead>
                    <TableHead>{t("finance.method")}</TableHead>
                    <TableHead className="text-right">{t("common.amount")}</TableHead>
                    <TableHead className="text-right">{t("forms.remaining")}</TableHead>
                    <TableHead>{t("common.quantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t("debts.noPaymentsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    debtPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {payment.paymentMethod === "cash" && t("finance.cash")}
                            {payment.paymentMethod === "bank_transfer" && t("finance.bank")}
                            {payment.paymentMethod === "card" && t("finance.card")}
                            {payment.paymentMethod === "other" && t("common.other")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(payment.amountUsd)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(payment.remainingAfter || "0")}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.referenceNumber || "-"}
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
