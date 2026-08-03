import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Bell,
  BellOff,
  Clock,
  DollarSign,
  Calendar,
  History,
  CheckCircle,
  XCircle,
  Shield,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function ExpenseAlerts() {
  const { t } = useLanguage();

  // State
  const [activeTab, setActiveTab] = useState("alerts");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form state
  const [formAlertType, setFormAlertType] = useState<string>("monthly");
  const [formThreshold, setFormThreshold] = useState("");
  const [formCurrency, setFormCurrency] = useState<string>("USD");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formNotifyMethod, setFormNotifyMethod] = useState<string>("system");
  const [formDescription, setFormDescription] = useState("");

  // Queries
  const alertsQuery = trpc.expenseAlerts.list.useQuery();
  const logsQuery = trpc.expenseAlerts.logs.useQuery({ limit: 100 });
  const categoriesQuery = trpc.expenseCategories.list.useQuery();

  // Mutations
  const createMutation = trpc.expenseAlerts.create.useMutation({
    onSuccess: () => {
      toast.success(t("expenseAlerts.createSuccess") || "ئاگادارکردنەوە دروستکرا");
      alertsQuery.refetch();
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (err) => {
      toast.error(t("expenseAlerts.createError") || "هەڵە لە دروستکردن");
    },
  });

  const updateMutation = trpc.expenseAlerts.update.useMutation({
    onSuccess: () => {
      toast.success(t("expenseAlerts.updateSuccess") || "ئاگادارکردنەوە نوێکرایەوە");
      alertsQuery.refetch();
      resetForm();
      setEditingAlert(null);
    },
    onError: () => {
      toast.error(t("expenseAlerts.updateError") || "هەڵە لە نوێکردنەوە");
    },
  });

  const deleteMutation = trpc.expenseAlerts.delete.useMutation({
    onSuccess: () => {
      toast.success(t("expenseAlerts.deleteSuccess") || "ئاگادارکردنەوە سڕایەوە");
      alertsQuery.refetch();
      logsQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error(t("expenseAlerts.deleteError") || "هەڵە لە سڕینەوە");
    },
  });

  const toggleMutation = trpc.expenseAlerts.toggle.useMutation({
    onSuccess: () => {
      alertsQuery.refetch();
    },
  });

  const resetForm = () => {
    setFormAlertType("monthly");
    setFormThreshold("");
    setFormCurrency("USD");
    setFormCategoryId("");
    setFormNotifyMethod("system");
    setFormDescription("");
  };

  const openEditDialog = (alert: any) => {
    setEditingAlert(alert);
    setFormAlertType(alert.alertType);
    setFormThreshold(alert.thresholdAmount);
    setFormCurrency(alert.currency);
    setFormCategoryId(alert.categoryId ? String(alert.categoryId) : "");
    setFormNotifyMethod(alert.notifyMethod);
    setFormDescription(alert.description || "");
  };

  const handleSubmit = () => {
    if (!formThreshold || parseFloat(formThreshold) <= 0) {
      toast.error(t("expenseAlerts.invalidThreshold") || "تکایە بڕی سنوور دیاری بکە");
      return;
    }

    const data = {
      alertType: formAlertType as "daily" | "weekly" | "monthly" | "per_transaction",
      thresholdAmount: formThreshold,
      currency: formCurrency as "USD" | "IQD",
      categoryId: formCategoryId ? parseInt(formCategoryId) : null,
      isEnabled: true,
      notifyMethod: formNotifyMethod as "system" | "email" | "both",
      description: formDescription || undefined,
    };

    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case "daily": return t("expenseAlerts.daily") || "ڕۆژانە";
      case "weekly": return t("expenseAlerts.weekly") || "هەفتانە";
      case "monthly": return t("expenseAlerts.monthly") || "مانگانە";
      case "per_transaction": return t("expenseAlerts.perTransaction") || "هەر مامەڵەیەک";
      default: return type;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case "daily": return <Clock className="h-4 w-4" />;
      case "weekly": return <Calendar className="h-4 w-4" />;
      case "monthly": return <TrendingUp className="h-4 w-4" />;
      case "per_transaction": return <Activity className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertTypeBadgeColor = (type: string) => {
    switch (type) {
      case "daily": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "weekly": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "monthly": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "per_transaction": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "bg-gray-100 dark:bg-gray-950/40 text-gray-800 dark:text-gray-200";
    }
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return t("expenseAlerts.allCategories") || "هەموو جۆرەکان";
    const cat = categoriesQuery.data?.find((c: any) => c.id === categoryId);
    return cat?.nameKu || cat?.nameEn || `#${categoryId}`;
  };

  const alerts = alertsQuery.data || [];
  const logs = logsQuery.data || [];
  const categories = categoriesQuery.data || [];

  const activeAlerts = alerts.filter((a: any) => a.isEnabled);
  const inactiveAlerts = alerts.filter((a: any) => !a.isEnabled);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
              {t("expenseAlerts.pageTitle") || "سیستەمی ئاگادارکردنەوەی خەرجی"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t("expenseAlerts.pageDescription") || "ئاگادارکردنەوەی ئۆتۆماتیک کاتێک خەرجییەکان لە سنوورێکی دیاریکراو تێدەپەڕن"}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("expenseAlerts.createAlert") || "ئاگادارکردنەوەی نوێ"}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("expenseAlerts.totalAlerts") || "کۆی ئاگادارکردنەوەکان"}</p>
                  <p className="text-2xl font-bold">{alerts.length}</p>
                </div>
                <Shield className="h-8 w-8 text-emerald-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("expenseAlerts.activeAlerts") || "چالاکەکان"}</p>
                  <p className="text-2xl font-bold text-blue-600">{activeAlerts.length}</p>
                </div>
                <Bell className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-gray-400">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("expenseAlerts.inactiveAlerts") || "ناچالاکەکان"}</p>
                  <p className="text-2xl font-bold text-gray-500">{inactiveAlerts.length}</p>
                </div>
                <BellOff className="h-8 w-8 text-gray-400 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t("expenseAlerts.triggeredCount") || "جار تریگەرکراو"}</p>
                  <p className="text-2xl font-bold text-amber-600">{logs.length}</p>
                </div>
                <History className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              {t("expenseAlerts.alertsTab") || "ئاگادارکردنەوەکان"}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              {t("expenseAlerts.historyTab") || "مێژووی تریگەرکردن"}
            </TabsTrigger>
          </TabsList>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            {alerts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {t("expenseAlerts.noAlerts") || "هیچ ئاگادارکردنەوەیەک نییە"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {t("expenseAlerts.noAlertsDescription") || "ئاگادارکردنەوەیەکی نوێ دروست بکە بۆ شوێنکەوتنی خەرجییەکان"}
                  </p>
                  <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("expenseAlerts.createFirst") || "یەکەم ئاگادارکردنەوە دروست بکە"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {alerts.map((alert: any) => (
                  <Card key={alert.id} className={`transition-all hover:shadow-md ${!alert.isEnabled ? 'opacity-60' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${alert.isEnabled ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                            {getAlertTypeIcon(alert.alertType)}
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {alert.description || getAlertTypeLabel(alert.alertType)}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getAlertTypeBadgeColor(alert.alertType)}`}>
                                {getAlertTypeIcon(alert.alertType)}
                                {getAlertTypeLabel(alert.alertType)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {getCategoryName(alert.categoryId)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Switch
                          checked={alert.isEnabled}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: alert.id, isEnabled: checked })}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Threshold Amount */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            {t("expenseAlerts.threshold") || "سنوور"}
                          </span>
                          <span className="font-bold text-lg">
                            {alert.currency === 'USD' ? '$' : 'د.ع'}{parseFloat(alert.thresholdAmount).toLocaleString()}
                          </span>
                        </div>

                        {/* Notify Method */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("expenseAlerts.notifyMethod") || "شێوازی ئاگادارکردنەوە"}
                          </span>
                          <Badge variant="outline">
                            {alert.notifyMethod === 'system' ? (t("expenseAlerts.systemNotify") || 'سیستەم') : 
                             alert.notifyMethod === 'email' ? (t("expenseAlerts.emailNotify") || 'ئیمەیل') : 
                             (t("expenseAlerts.bothNotify") || 'هەردووک')}
                          </Badge>
                        </div>

                        <Separator />

                        {/* Actions */}
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(alert)}
                            className="gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("expenseAlerts.edit") || "دەستکاری"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirmId(alert.id)}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t("expenseAlerts.delete") || "سڕینەوە"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {logs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <History className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {t("expenseAlerts.noLogs") || "هیچ تریگەرکردنێک نییە"}
                  </h3>
                  <p className="text-muted-foreground">
                    {t("expenseAlerts.noLogsDescription") || "کاتێک خەرجییەکان لە سنوور تێدەپەڕن، لێرە تۆمار دەکرێت"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {logs.map((log: any) => {
                  const alert = alerts.find((a: any) => a.id === log.alertId);
                  return (
                    <Card key={log.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full mt-0.5 ${log.notificationSent ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                              {log.notificationSent ? (
                                <CheckCircle className="h-4 w-4 text-amber-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {alert?.description || getAlertTypeLabel(alert?.alertType || '')}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {t("expenseAlerts.totalExpenses") || "کۆی خەرجی"}: 
                                  <strong className="text-red-600">${parseFloat(log.totalExpenses).toLocaleString()}</strong>
                                </span>
                                <span>|</span>
                                <span>
                                  {t("expenseAlerts.threshold") || "سنوور"}: 
                                  <strong>${parseFloat(log.thresholdAmount).toLocaleString()}</strong>
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("expenseAlerts.expenseCount") || "ژمارەی خەرجی"}: {log.expenseCount}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.triggeredAt).toLocaleDateString('ku', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.triggeredAt).toLocaleTimeString('ku', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <Badge variant={log.notificationSent ? "default" : "destructive"} className="mt-1 text-xs">
                              {log.notificationSent ? (t("expenseAlerts.sent") || "نێردرا") : (t("expenseAlerts.failed") || "شکستخوارد")}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog || !!editingAlert} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingAlert(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {editingAlert 
                  ? (t("expenseAlerts.editAlert") || "دەستکاری ئاگادارکردنەوە")
                  : (t("expenseAlerts.createAlert") || "ئاگادارکردنەوەی نوێ")}
              </DialogTitle>
              <DialogDescription>
                {t("expenseAlerts.dialogDescription") || "سنوورێک دیاری بکە بۆ خەرجییەکان و ئاگادارکردنەوە وەربگرە کاتێک تێدەپەڕن"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Alert Type */}
              <div className="space-y-2">
                <Label>{t("expenseAlerts.alertType") || "جۆری ئاگادارکردنەوە"} *</Label>
                <Select value={formAlertType} onValueChange={setFormAlertType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t("expenseAlerts.daily") || "ڕۆژانە"} - {t("expenseAlerts.dailyDesc") || "کۆی خەرجی ڕۆژانە"}</SelectItem>
                    <SelectItem value="weekly">{t("expenseAlerts.weekly") || "هەفتانە"} - {t("expenseAlerts.weeklyDesc") || "کۆی خەرجی هەفتانە"}</SelectItem>
                    <SelectItem value="monthly">{t("expenseAlerts.monthly") || "مانگانە"} - {t("expenseAlerts.monthlyDesc") || "کۆی خەرجی مانگانە"}</SelectItem>
                    <SelectItem value="per_transaction">{t("expenseAlerts.perTransaction") || "هەر مامەڵەیەک"} - {t("expenseAlerts.perTransactionDesc") || "هەر خەرجییەکی تاکە"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Threshold Amount */}
              <div className="space-y-2">
                <Label>{t("expenseAlerts.thresholdAmount") || "بڕی سنوور"} *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    placeholder="0.00"
                    className="flex-1"
                    min="0"
                    step="0.01"
                  />
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="IQD">IQD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formAlertType === 'per_transaction' 
                    ? (t("expenseAlerts.perTransactionHint") || "ئاگادارکردنەوە دەنێردرێت ئەگەر هەر خەرجییەکی تاکە لەم بڕە زیاتر بێت")
                    : (t("expenseAlerts.periodHint") || "ئاگادارکردنەوە دەنێردرێت ئەگەر کۆی خەرجییەکان لەم ماوەیەدا لەم بڕە زیاتر بێت")}
                </p>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>{t("expenseAlerts.category") || "جۆری خەرجی"}</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("expenseAlerts.allCategories") || "هەموو جۆرەکان"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("expenseAlerts.allCategories") || "هەموو جۆرەکان"}</SelectItem>
                    {categories.map((cat: any) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.nameKu || cat.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notify Method */}
              <div className="space-y-2">
                <Label>{t("expenseAlerts.notifyMethod") || "شێوازی ئاگادارکردنەوە"}</Label>
                <Select value={formNotifyMethod} onValueChange={setFormNotifyMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">{t("expenseAlerts.systemNotify") || "ئاگادارکردنەوەی سیستەم"}</SelectItem>
                    <SelectItem value="email">{t("expenseAlerts.emailNotify") || "ئیمەیل"}</SelectItem>
                    <SelectItem value="both">{t("expenseAlerts.bothNotify") || "هەردووک"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>{t("expenseAlerts.description") || "تێبینی"}</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t("expenseAlerts.descriptionPlaceholder") || "تێبینییەک زیاد بکە (ئارەزوومەندانە)..."}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingAlert(null); resetForm(); }}>
                {t("expenseAlerts.cancel") || "پاشگەزبوونەوە"}
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                {editingAlert 
                  ? (t("expenseAlerts.save") || "پاشەکەوتکردن")
                  : (t("expenseAlerts.create") || "دروستکردن")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                {t("expenseAlerts.deleteConfirmTitle") || "سڕینەوەی ئاگادارکردنەوە"}
              </DialogTitle>
              <DialogDescription>
                {t("expenseAlerts.deleteConfirmDescription") || "ئایا دڵنیایت لە سڕینەوەی ئەم ئاگادارکردنەوەیە؟ ئەم کارە ناگەڕێتەوە."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                {t("expenseAlerts.cancel") || "پاشگەزبوونەوە"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
                disabled={deleteMutation.isPending}
              >
                {t("expenseAlerts.confirmDelete") || "سڕینەوە"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
