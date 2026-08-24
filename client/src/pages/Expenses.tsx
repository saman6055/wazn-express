import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { showErrorToast, copyErrorReport } from "@/lib/errorToast";
import { ExpensesDashboard } from "@/components/expenses/ExpensesDashboard";
import { FilteredByLinkBanner } from "@/components/FilteredByLinkBanner";
import type { Localised } from "@shared/listLinks";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getErrorBoundaryStrings } from "@/components/ErrorBoundary";
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
  Receipt, 
  Building2, 
  Users, 
  Zap, 
  Truck, 
  Phone, 
  Wrench,
  MoreHorizontal,
  Calendar,
  DollarSign,
  TrendingDown,
  FolderOpen,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  Pencil
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

// Icon mapping for expense categories
const categoryIcons: Record<string, React.ReactNode> = {
  building: <Building2 className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
  truck: <Truck className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  wrench: <Wrench className="h-4 w-4" />,
  receipt: <Receipt className="h-4 w-4" />,
};

/**
 * The dinar rate this screen converts with.
 *
 * It was written inline in the middle of the create call, which made it look
 * like an implementation detail rather than a company figure that somebody
 * has to keep current. Named here so it can be found — and so the edit path
 * cannot drift from the create path, which is what happens when a number is
 * typed twice.
 */
const IQD_PER_USD = 1480;

/** Radix refuses an empty SelectItem value, so "paid from nobody" needs one. */
const NO_ACCOUNT = "__none__";

export default function Expenses() {
    const { t } = useTranslation();
const [activeTab, setActiveTab] = useState("expenses");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Form states
  // Which expense the dialog is editing, or null when recording a new one.
  // The same form serves both: an expense that can be recorded and not
  // corrected is a ledger nobody can trust.
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const [expenseForm, setExpenseForm] = useState({
    categoryId: "",
    amount: "",
    currency: "USD",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: "cash",
    cashAccountId: "",
    vendor: "",
    referenceNumber: "",
    notes: "",
    isRecurring: false,
  });

  const [categoryForm, setCategoryForm] = useState({
    nameEn: "",
    nameKu: "",
    icon: "receipt",
    color: "#3b82f6",
    description: "",
    isRecurring: false,
  });

  // Queries
  const { data: categories = [], refetch: refetchCategories, error: categoriesError } =
    trpc.expenseCategories.listActive.useQuery();
  const { data: expenses = [], refetch: refetchExpenses, error: expensesError } = trpc.expenses.list.useQuery({
    categoryId: selectedCategory !== "all" ? parseInt(selectedCategory) : undefined,
    startDate: new Date(dateRange.start),
    endDate: new Date(dateRange.end),
  });
  // Which account the money left. The screen has always asked for a payment
  // method and never for the account, so the Treasury went on showing money
  // that had already gone out of the door.
  const { data: cashAccounts = [] } = trpc.cashAccounts.listActive.useQuery();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // The alerts endpoints are admin-only. An accountant asking for them would
  // be refused, and the refusal would now surface as an error banner on a
  // screen they are perfectly entitled to use — so they simply do not ask,
  // and see no strip. Permissions are not changed here, only respected.
  const canSeeAlerts = user?.role === "admin" || user?.role === "super_admin";
  const { data: alertLogs = [] } = trpc.expenseAlerts.logs.useQuery(
    { limit: 100 },
    { enabled: canSeeAlerts },
  );

  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
  } = trpc.expenses.getDashboard.useQuery({
    startDate: new Date(dateRange.start),
    endDate: new Date(dateRange.end),
  });

  const { data: summary, refetch: refetchSummary, error: summaryError } = trpc.expenses.getSummary.useQuery({
    startDate: new Date(dateRange.start),
    endDate: new Date(dateRange.end),
  });

  // Mutations
  // The list and the totals are one answer, and used to disagree: recording
  // an expense refreshed the rows underneath and left the cards above them
  // reading whatever they read when the page opened — $0.00 over a table with
  // money in it.
  const refetchAll = () => {
    refetchExpenses();
    refetchSummary();
    refetchDashboard();
  };

  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: (result) => {
      toast.success(t("expenses.expenseAdded"));
      // The money left an account that was already short. Recorded either
      // way — refusing would not bring it back — but somebody should look.
      if (result?.cashWarning) toast.warning(result.cashWarning, { duration: 10000 });
      setShowAddExpense(false);
      refetchAll();
      resetExpenseForm();
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success(t("expenses.expenseUpdated"));
      setShowAddExpense(false);
      refetchAll();
      resetExpenseForm();
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success(t("expenses.expenseDeleted"));
      refetchAll();
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  const createCategory = trpc.expenseCategories.create.useMutation({
    onSuccess: () => {
      toast.success(t("messages.categoryAdded"));
      setShowAddCategory(false);
      refetchCategories();
      resetCategoryForm();
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  const updateCategory = trpc.expenseCategories.update.useMutation({
    onSuccess: () => {
      toast.success(t("messages.categoryUpdated"));
      setShowAddCategory(false);
      refetchCategories();
      // A renamed or recoloured category is on every figure above the list,
      // so the report has to be told as well.
      refetchAll();
      resetCategoryForm();
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  const deleteCategory = trpc.expenseCategories.delete.useMutation({
    onSuccess: () => {
      toast.success(t("messages.categoryDeleted"));
      refetchCategories();
      refetchAll();
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      categoryId: "",
      amount: "",
      currency: "USD",
      description: "",
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: "cash",
      cashAccountId: "",
      vendor: "",
      referenceNumber: "",
      notes: "",
      isRecurring: false,
    });
  };

  /** Open the dialog on an existing expense, filled in as it stands. */
  const startEditingExpense = (expense: (typeof expenses)[number]) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      categoryId: expense.categoryId?.toString() ?? "",
      // Edit shows the figure as it was entered, in the currency it was
      // entered in. Re-deriving it from amountUsd would quietly round every
      // dinar expense on its way through the form.
      amount: expense.amount?.toString() ?? "",
      currency: expense.currency ?? "USD",
      description: expense.description ?? "",
      expenseDate: new Date(expense.expenseDate).toISOString().split("T")[0]!,
      paymentMethod: expense.paymentMethod ?? "cash",
      cashAccountId: expense.cashAccountId?.toString() ?? "",
      vendor: expense.vendor ?? "",
      referenceNumber: expense.referenceNumber ?? "",
      notes: expense.notes ?? "",
      isRecurring: expense.isRecurring ?? false,
    });
    setShowAddExpense(true);
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm({
      nameEn: "",
      nameKu: "",
      icon: "receipt",
      color: "#3b82f6",
      description: "",
      isRecurring: false,
    });
  };

  const handleSaveExpense = () => {
    if (!expenseForm.categoryId || !expenseForm.amount) {
      toast.error(t("common.fillAllFields"));
      return;
    }

    const amount = parseFloat(expenseForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("expenses.amountMustBePositive"));
      return;
    }

    const payload = {
      categoryId: parseInt(expenseForm.categoryId),
      amount: expenseForm.amount,
      currency: expenseForm.currency as "USD" | "IQD",
      amountUsd:
        expenseForm.currency === "USD" ? expenseForm.amount : (amount / IQD_PER_USD).toFixed(2),
      description: expenseForm.description || undefined,
      expenseDate: new Date(expenseForm.expenseDate),
      paymentMethod: expenseForm.paymentMethod as "cash" | "bank_transfer" | "card" | "other",
      // Optional on purpose: some expenses are paid out of somebody's own
      // pocket and reimbursed later, and those must still be recordable.
      cashAccountId: expenseForm.cashAccountId ? parseInt(expenseForm.cashAccountId) : undefined,
      vendor: expenseForm.vendor || undefined,
      referenceNumber: expenseForm.referenceNumber || undefined,
      notes: expenseForm.notes || undefined,
      isRecurring: expenseForm.isRecurring,
    };

    if (editingExpenseId !== null) {
      updateExpense.mutate({ id: editingExpenseId, ...payload });
    } else {
      createExpense.mutate(payload);
    }
  };

  /** Open the category dialog on an existing one, filled in as it stands. */
  const startEditingCategory = (category: (typeof categories)[number]) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      nameEn: category.nameEn ?? "",
      nameKu: category.nameKu ?? "",
      icon: category.icon ?? "receipt",
      color: category.color ?? "#3b82f6",
      description: category.description ?? "",
      isRecurring: category.isRecurring ?? false,
    });
    setShowAddCategory(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.nameEn) {
      toast.error(t("expenses.enterCategoryName"));
      return;
    }

    const payload = {
      nameEn: categoryForm.nameEn,
      nameKu: categoryForm.nameKu || undefined,
      icon: categoryForm.icon || undefined,
      color: categoryForm.color || undefined,
      description: categoryForm.description || undefined,
      isRecurring: categoryForm.isRecurring,
    };

    if (editingCategoryId !== null) {
      updateCategory.mutate({ id: editingCategoryId, ...payload });
    } else {
      createCategory.mutate(payload);
    }
  };

  const getCategoryById = (id: number) => categories.find(c => c.id === id);

  // PDF Export
  const generateExpensePDF = trpc.financialReports.generateExpenseReportPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success(t("expenses.pdfGenerated"));
    },
    onError: () => toast.error(t("expenses.pdfError")),
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const filteredExpenses = expenses.filter(expense => {
    if (!searchQuery) return true;
    const category = getCategoryById(expense.categoryId);
    return (
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category?.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      category?.nameKu?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const formatCurrency = (amount: string | number, currency = "USD") => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (currency === "IQD") {
      return `${num.toLocaleString()} IQD`;
    }
    return `$${num.toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("ku-Arab", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // A failed read must say so. `data = []` above turns a broken query into an
  // empty screen, and an empty expenses screen reads as "nothing was spent"
  // — an answer, not a failure. The list and the totals were doing exactly
  // that while the table underneath them could not be read at all.
  const loadError = expensesError ?? summaryError ?? categoriesError ?? null;

  // Named in the reader's own language, with one way out. Only filters that
  // came from clicking a figure are listed — typing in the search box is not
  // something anybody needs to be told about.
  const clickFilters = useMemo(() => {
    const filters: Localised[] = [];
    if (selectedCategory !== "all") {
      const category = categories.find((c) => c.id.toString() === selectedCategory);
      const name = category?.nameKu || category?.nameEn || selectedCategory;
      filters.push({
        ku: `پۆل: ${name}`,
        en: `Category: ${name}`,
        ar: `الفئة: ${name}`,
        zh: `类别：${name}`,
      });
    }
    return filters;
  }, [selectedCategory, categories]);

  const activeAlertCount = useMemo(() => {
    const from = new Date(dateRange.start).getTime();
    const to = new Date(dateRange.end).getTime();
    return alertLogs.filter((log) => {
      const at = new Date(log.triggeredAt).getTime();
      return at >= from && at <= to;
    }).length;
  }, [alertLogs, dateRange.start, dateRange.end]);

  // The daily average divided by a fixed 30 whatever range was on screen, so
  // a week of expenses read as a third of what it was and a quarter read as
  // three times. Both ends included: Aug 1 to Aug 1 is one day, not zero.
  const daysInRange = Math.max(
    1,
    Math.round(
      (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86_400_000,
    ) + 1,
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {loadError && (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
            data-testid="expenses-load-error"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-destructive break-words [overflow-wrap:anywhere]">
                {loadError.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyErrorReport(loadError)}
              >
                {getErrorBoundaryStrings().copyDetails}
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("expenses.title")}</h1>
            <p className="text-muted-foreground">
              {t("expenses.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const startDateObj = new Date(dateRange.start);
                generateExpensePDF.mutate({
                  month: monthNames[startDateObj.getMonth()],
                  year: startDateObj.getFullYear(),
                });
              }}
              disabled={generateExpensePDF.isPending}
            >
              <Download className="me-2 h-4 w-4" />
              {generateExpensePDF.isPending ? t("common.loading") : 'PDF'}
            </Button>
            <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderOpen className="me-2 h-4 w-4" />
                  {t("expenses.newCategory")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingCategoryId !== null ? t("expenses.editCategory") : t("expenses.addCategory")}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCategoryId !== null
                      ? t("expenses.editCategoryDesc")
                      : t("expenses.addCategoryDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="catNameEn">{t("common.nameEn")}</Label>
                    <Input
                      id="catNameEn"
                      value={categoryForm.nameEn}
                      onChange={(e) => setCategoryForm({ ...categoryForm, nameEn: e.target.value })}
                      placeholder="Warehouse Rent"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="catNameKu">{t("common.nameKu")}</Label>
                    <Input
                      id="catNameKu"
                      value={categoryForm.nameKu}
                      onChange={(e) => setCategoryForm({ ...categoryForm, nameKu: e.target.value })}
                      placeholder={t("expenses.warehouseRent")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="catIcon">{t("common.icon")}</Label>
                      <Select
                        value={categoryForm.icon}
                        onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="building">🏢 {t("expenses.building")}</SelectItem>
                          <SelectItem value="users">👥 {t("expenses.employees")}</SelectItem>
                          <SelectItem value="zap">⚡ {t("expenses.electricity")}</SelectItem>
                          <SelectItem value="truck">🚚 {t("expenses.transportation")}</SelectItem>
                          <SelectItem value="phone">📱 {t("expenses.phone")}</SelectItem>
                          <SelectItem value="wrench">🔧 {t("expenses.maintenance")}</SelectItem>
                          <SelectItem value="receipt">🧾 {t("common.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="catColor">{t("fullPackage.color")}</Label>
                      <Input
                        id="catColor"
                        type="color"
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="catDesc">{t("common.description")}</Label>
                    <Textarea
                      id="catDesc"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder={t("expenses.categoryDescription")}
                    />
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id="catRecurring"
                      checked={categoryForm.isRecurring}
                      onChange={(e) => setCategoryForm({ ...categoryForm, isRecurring: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="catRecurring">{t("expenses.recurringMonthly")}</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddCategory(false);
                      resetCategoryForm();
                    }}
                  >
                    {t("forms.cancel")}
                  </Button>
                  <Button
                    onClick={handleSaveCategory}
                    disabled={createCategory.isPending || updateCategory.isPending}
                  >
                    {createCategory.isPending || updateCategory.isPending
                      ? t("common.loading")
                      : editingCategoryId !== null
                        ? t("forms.save")
                        : t("common.add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="me-2 h-4 w-4" />
                  {t("expenses.newExpense")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingExpenseId !== null ? t("expenses.editExpense") : t("expenses.recordExpense")}
                  </DialogTitle>
                  <DialogDescription>
                    {editingExpenseId !== null
                      ? t("expenses.editExpenseDesc")
                      : t("expenses.recordExpenseDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="category">{t("common.category")}</Label>
                    <Select
                      value={expenseForm.categoryId}
                      onValueChange={(value) => setExpenseForm({ ...expenseForm, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("expenses.selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>
                            {cat.nameKu || cat.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">{t("common.amount")}</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="currency">{t("countries.currency")}</Label>
                      <Select
                        value={expenseForm.currency}
                        onValueChange={(value) => setExpenseForm({ ...expenseForm, currency: value })}
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
                      <Label htmlFor="expenseDate">{t("common.date")}</Label>
                      <Input
                        id="expenseDate"
                        type="date"
                        value={expenseForm.expenseDate}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="paymentMethod">{t("finance.paymentMethod")}</Label>
                      <Select
                        value={expenseForm.paymentMethod}
                        onValueChange={(value) => setExpenseForm({ ...expenseForm, paymentMethod: value })}
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
                    <Label htmlFor="cashAccount">{t("expenses.paidFromAccount")}</Label>
                    <Select
                      value={expenseForm.cashAccountId || NO_ACCOUNT}
                      onValueChange={(value) =>
                        setExpenseForm({
                          ...expenseForm,
                          cashAccountId: value === NO_ACCOUNT ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger id="cashAccount">
                        <SelectValue placeholder={t("expenses.selectAccount")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ACCOUNT}>{t("expenses.noAccount")}</SelectItem>
                        {cashAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.accountNameKu || account.accountName}
                            {account.currency === "USD"
                              ? ` — $${Number(account.currentBalance).toFixed(2)}`
                              : ` — ${Number(account.currentBalance).toLocaleString()} IQD`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("expenses.paidFromAccountHint")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">{t("common.description")}</Label>
                    <Input
                      id="description"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      placeholder={t("expenses.expenseDescription")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vendor">{t("expenses.vendorSupplier")}</Label>
                      <Input
                        id="vendor"
                        value={expenseForm.vendor}
                        onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                        placeholder={t("suppliers.supplierName")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="referenceNumber">{t("invoices.invoiceNumber")}</Label>
                      <Input
                        id="referenceNumber"
                        value={expenseForm.referenceNumber}
                        onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                        placeholder="INV-001"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">{t("common.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={expenseForm.notes}
                      onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                      placeholder={t("common.additionalNotes")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddExpense(false);
                      resetExpenseForm();
                    }}
                  >
                    {t("forms.cancel")}
                  </Button>
                  <Button
                    onClick={handleSaveExpense}
                    disabled={createExpense.isPending || updateExpense.isPending}
                  >
                    {createExpense.isPending || updateExpense.isPending
                      ? t("common.loading")
                      : editingExpenseId !== null
                        ? t("forms.save")
                        : t("common.register")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Everything the screen reports, above the list it reports on. */}
        <ExpensesDashboard
          data={dashboard}
          isLoading={isDashboardLoading}
          daysInRange={daysInRange}
          alertCount={activeAlertCount}
          onOpenAlerts={() => setLocation("/company/expense-alerts")}
          onSelectCategory={(categoryId) => {
            setSelectedCategory(categoryId.toString());
            setSearchQuery("");
            setActiveTab("expenses");
            document.getElementById("expenses-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onSelectVendor={(vendor) => {
            setSearchQuery(vendor);
            setSelectedCategory("all");
            setActiveTab("expenses");
            document.getElementById("expenses-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="expenses">{t("expenses.expenses")}</TabsTrigger>
            <TabsTrigger value="categories">{t("expenses.categories")}</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4" id="expenses-list">
            {/* Why this list arrived shorter than usual. Without saying so, a
                list filtered by a click on a figure reads as missing data. */}
            <FilteredByLinkBanner
              filters={clickFilters}
              onClear={() => {
                setSelectedCategory("all");
                setSearchQuery("");
              }}
            />
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t("tables.search")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t("expenses.allCategories")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("expenses.allCategories")}</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.nameKu || cat.nameEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-[150px]"
                    />
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-[150px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expenses Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("common.category")}</TableHead>
                      <TableHead>{t("common.description")}</TableHead>
                      <TableHead>{t("fullPackage.supplier")}</TableHead>
                      <TableHead>{t("finance.method")}</TableHead>
                      <TableHead className="text-right">{t("common.amount")}</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {t("expenses.noExpensesFound")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExpenses.map((expense) => {
                        const category = getCategoryById(expense.categoryId);
                        return (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium">
                              {formatDate(expense.expenseDate)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor: category?.color ? `${category.color}20` : undefined,
                                  color: category?.color || undefined,
                                }}
                              >
                                {category?.nameKu || category?.nameEn || t("common.unknown")}
                              </Badge>
                            </TableCell>
                            <TableCell>{expense.description || "-"}</TableCell>
                            <TableCell>{expense.vendor || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {expense.paymentMethod === "cash" && t("finance.cash")}
                                {expense.paymentMethod === "bank_transfer" && t("finance.bank")}
                                {expense.paymentMethod === "card" && t("finance.card")}
                                {expense.paymentMethod === "other" && t("common.other")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600 dark:text-red-300">
                              {formatCurrency(expense.amountUsd)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("expenses.editExpense")}
                                data-testid={`edit-expense-${expense.id}`}
                                onClick={() => startEditingExpense(expense)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("forms.delete")}
                                onClick={() => {
                                  if (confirm(t("expenses.confirmDeleteExpense"))) {
                                    deleteExpense.mutate({ id: expense.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <Card key={category.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        {categoryIcons[category.icon || "receipt"] || <Receipt className="h-4 w-4" />}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">
                          {category.nameKu || category.nameEn}
                        </CardTitle>
                        {category.nameKu && (
                          <CardDescription className="text-xs">
                            {category.nameEn}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("expenses.editCategory")}
                        data-testid={`edit-category-${category.id}`}
                        onClick={() => startEditingCategory(category)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("forms.delete")}
                        onClick={() => {
                          if (confirm(t("expenses.confirmDeleteCategory"))) {
                            deleteCategory.mutate({ id: category.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {category.description || t("common.noDescription")}
                    </p>
                    {category.isRecurring && (
                      <Badge variant="secondary" className="mt-2">
                        {t("expenses.recurring")}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
