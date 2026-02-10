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
  Download
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
  const [expenseForm, setExpenseForm] = useState({
    categoryId: "",
    amount: "",
    currency: "USD",
    description: "",
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: "cash",
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
  const { data: categories = [], refetch: refetchCategories } = trpc.expenseCategories.listActive.useQuery();
  const { data: expenses = [], refetch: refetchExpenses } = trpc.expenses.list.useQuery({
    categoryId: selectedCategory !== "all" ? parseInt(selectedCategory) : undefined,
    startDate: new Date(dateRange.start),
    endDate: new Date(dateRange.end),
  });
  const { data: summary } = trpc.expenses.getSummary.useQuery({
    startDate: new Date(dateRange.start),
    endDate: new Date(dateRange.end),
  });

  // Mutations
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success(t("expenses.expenseAdded"));
      setShowAddExpense(false);
      refetchExpenses();
      resetExpenseForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteExpense = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success(t("expenses.expenseDeleted"));
      refetchExpenses();
    },
    onError: (error) => {
      toast.error(error.message);
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
      toast.error(error.message);
    },
  });

  const deleteCategory = trpc.expenseCategories.delete.useMutation({
    onSuccess: () => {
      toast.success(t("messages.categoryDeleted"));
      refetchCategories();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetExpenseForm = () => {
    setExpenseForm({
      categoryId: "",
      amount: "",
      currency: "USD",
      description: "",
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: "cash",
      vendor: "",
      referenceNumber: "",
      notes: "",
      isRecurring: false,
    });
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      nameEn: "",
      nameKu: "",
      icon: "receipt",
      color: "#3b82f6",
      description: "",
      isRecurring: false,
    });
  };

  const handleCreateExpense = () => {
    if (!expenseForm.categoryId || !expenseForm.amount) {
      toast.error(t("common.fillAllFields"));
      return;
    }

    createExpense.mutate({
      categoryId: parseInt(expenseForm.categoryId),
      amount: expenseForm.amount,
      currency: expenseForm.currency as "USD" | "IQD",
      amountUsd: expenseForm.currency === "USD" ? expenseForm.amount : (parseFloat(expenseForm.amount) / 1480).toFixed(2),
      description: expenseForm.description || undefined,
      expenseDate: new Date(expenseForm.expenseDate),
      paymentMethod: expenseForm.paymentMethod as "cash" | "bank_transfer" | "card" | "other",
      vendor: expenseForm.vendor || undefined,
      referenceNumber: expenseForm.referenceNumber || undefined,
      notes: expenseForm.notes || undefined,
      isRecurring: expenseForm.isRecurring,
    });
  };

  const handleCreateCategory = () => {
    if (!categoryForm.nameEn) {
      toast.error(t("expenses.enterCategoryName"));
      return;
    }

    createCategory.mutate({
      nameEn: categoryForm.nameEn,
      nameKu: categoryForm.nameKu || undefined,
      icon: categoryForm.icon || undefined,
      color: categoryForm.color || undefined,
      description: categoryForm.description || undefined,
      isRecurring: categoryForm.isRecurring,
    });
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
              <Download className="mr-2 h-4 w-4" />
              {generateExpensePDF.isPending ? t("common.loading") : 'PDF'}
            </Button>
            <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t("expenses.newCategory")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{t("expenses.addCategory")}</DialogTitle>
                  <DialogDescription>
                    {t("expenses.addCategoryDesc")}
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
                  <Button variant="outline" onClick={() => setShowAddCategory(false)}>{t("forms.cancel")}</Button>
                  <Button onClick={handleCreateCategory} disabled={createCategory.isPending}>
                    {createCategory.isPending ? t("common.loading") : t("common.add")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("expenses.newExpense")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("expenses.recordExpense")}</DialogTitle>
                  <DialogDescription>
                    {t("expenses.recordExpenseDesc")}
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
                  <Button variant="outline" onClick={() => setShowAddExpense(false)}>{t("forms.cancel")}</Button>
                  <Button onClick={handleCreateExpense} disabled={createExpense.isPending}>
                    {createExpense.isPending ? t("common.loading") : t("common.register")}
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
              <CardTitle className="text-sm font-medium">{t("expenses.totalExpenses")}</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${summary?.totalAmount.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("common.from")} {formatDate(dateRange.start)} {t("common.to")} {formatDate(dateRange.end)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("expenses.recordCount")}</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expenses.length}</div>
              <p className="text-xs text-muted-foreground">{t("expenses.expenses")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("expenses.categories")}</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">{t("expenses.activeCategory")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("expenses.dailyAverage")}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${((summary?.totalAmount || 0) / 30).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">{t("common.average")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Expense by Category */}
        {summary && summary.byCategory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("expenses.expensesByCategory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.byCategory.map((cat) => {
                  const percentage = (cat.total / summary.totalAmount) * 100;
                  const category = categories.find(c => c.id === cat.categoryId);
                  return (
                    <div key={cat.categoryId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: category?.color || "#3b82f6" }}
                          />
                          <span className="text-sm font-medium">
                            {category?.nameKu || category?.nameEn || cat.categoryName}
                          </span>
                        </div>
                        <span className="text-sm font-medium">${cat.total.toFixed(2)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: category?.color || "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="expenses">{t("expenses.expenses")}</TabsTrigger>
            <TabsTrigger value="categories">{t("expenses.categories")}</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
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
                      <TableHead className="w-[50px]"></TableHead>
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
                            <TableCell className="text-right font-medium text-red-600">
                              {formatCurrency(expense.amountUsd)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm(t("expenses.confirmDeleteExpense"))) {
                                    deleteExpense.mutate({ id: expense.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(t("expenses.confirmDeleteCategory"))) {
                          deleteCategory.mutate({ id: category.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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
