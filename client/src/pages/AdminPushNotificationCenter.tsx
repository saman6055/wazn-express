import { useMemo, useState } from "react";
import {
  Bell,
  Send,
  History,
  BarChart3,
  Users,
  Smartphone,
  Activity,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Globe,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { format } from "date-fns";

type TargetType = "all" | "customer" | "batch" | "segment";
type Segment = "active_customers" | "with_pending_packages" | "with_unpaid_invoices" | "vip_customers" | "inactive_30d";

const STATUS_BADGE_COLOR: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  scheduled: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  sending: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  failed: "bg-red-500/15 text-red-600 dark:text-red-300",
  cancelled: "bg-slate-400/15 text-slate-500",
};

export default function AdminPushNotificationCenter() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("compose");

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-emerald-500" />
              {t("pushAdmin.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("pushAdmin.subtitle")}</p>
          </div>
          <PushStatusBanner />
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              {t("pushAdmin.tabCompose")}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("pushAdmin.tabHistory")}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("pushAdmin.tabAnalytics")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            <ComposeTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ============================================================================
// STATUS BANNER
// ============================================================================
function PushStatusBanner() {
  const { t } = useTranslation();
  const status = trpc.pushAdmin.getStatus.useQuery();
  if (status.isLoading) return null;
  if (status.data?.enabled) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-3 py-1.5">
        <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
        {t("pushAdmin.systemActive")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-600 dark:text-red-300 px-3 py-1.5">
      <AlertTriangle className="me-1.5 h-3.5 w-3.5" />
      {t("pushAdmin.systemInactive")}
    </Badge>
  );
}

// ============================================================================
// COMPOSE TAB
// ============================================================================
function ComposeTab() {
  const { t, language } = useTranslation();
  const utils = trpc.useUtils();

  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetCustomerId, setTargetCustomerId] = useState<string>("");
  const [targetBatchId, setTargetBatchId] = useState<string>("");
  const [targetSegment, setTargetSegment] = useState<Segment>("active_customers");

  const [titleKu, setTitleKu] = useState("");
  const [bodyKu, setBodyKu] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [titleZh, setTitleZh] = useState("");
  const [bodyZh, setBodyZh] = useState("");

  const [url, setUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const customers = trpc.customers.list.useQuery();
  const batchesQuery = trpc.batches.list.useQuery({ page: 1, pageSize: 200 });
  const batchList = useMemo(() => {
    const d = batchesQuery.data;
    if (!d) return [];
    return Array.isArray(d) ? d : d.data;
  }, [batchesQuery.data]);

  const audiencePreview = trpc.pushAdmin.previewAudience.useQuery(
    {
      targetType,
      targetCustomerId: targetCustomerId ? Number(targetCustomerId) : null,
      targetBatchId: targetBatchId ? Number(targetBatchId) : null,
      targetSegment: targetType === "segment" ? targetSegment : null,
    },
    {
      enabled:
        targetType === "all" ||
        targetType === "segment" ||
        (targetType === "customer" && !!targetCustomerId) ||
        (targetType === "batch" && !!targetBatchId),
      staleTime: 10_000,
    },
  );

  const composeAndSend = trpc.pushAdmin.composeAndSend.useMutation({
    onSuccess: (res) => {
      toast.success(
        t("pushAdmin.sentToast", {
          sent: String(res.result.sent),
          total: String(res.result.totalRecipients),
        }),
      );
      utils.pushAdmin.listCampaigns.invalidate();
      utils.pushAdmin.getStats.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const createCampaign = trpc.pushAdmin.createCampaign.useMutation({
    onSuccess: () => {
      toast.success(t("pushAdmin.scheduledToast"));
      utils.pushAdmin.listCampaigns.invalidate();
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setTitleKu(""); setBodyKu("");
    setTitleEn(""); setBodyEn("");
    setTitleAr(""); setBodyAr("");
    setTitleZh(""); setBodyZh("");
    setUrl("");
    setScheduledAt("");
  }

  const hasAtLeastOneLangPair =
    (titleKu.trim() && bodyKu.trim()) ||
    (titleEn.trim() && bodyEn.trim()) ||
    (titleAr.trim() && bodyAr.trim()) ||
    (titleZh.trim() && bodyZh.trim());

  const previewLang = useMemo(() => {
    if (language === "en" && titleEn) return { title: titleEn, body: bodyEn };
    if (language === "ar" && titleAr) return { title: titleAr, body: bodyAr };
    if (language === "zh" && titleZh) return { title: titleZh, body: bodyZh };
    if (titleKu) return { title: titleKu, body: bodyKu };
    return { title: titleEn || titleAr || titleZh, body: bodyEn || bodyAr || bodyZh };
  }, [language, titleKu, bodyKu, titleEn, bodyEn, titleAr, bodyAr, titleZh, bodyZh]);

  function handleSubmit(mode: "now" | "schedule") {
    const payload = {
      titleKu: titleKu.trim() || null,
      bodyKu: bodyKu.trim() || null,
      titleEn: titleEn.trim() || null,
      bodyEn: bodyEn.trim() || null,
      titleAr: titleAr.trim() || null,
      bodyAr: bodyAr.trim() || null,
      titleZh: titleZh.trim() || null,
      bodyZh: bodyZh.trim() || null,
      url: url.trim() || null,
      targetType,
      targetCustomerId: targetType === "customer" && targetCustomerId ? Number(targetCustomerId) : null,
      targetBatchId: targetType === "batch" && targetBatchId ? Number(targetBatchId) : null,
      targetSegment: targetType === "segment" ? targetSegment : null,
      scheduledAt: mode === "schedule" && scheduledAt ? new Date(scheduledAt) : null,
    };

    if (mode === "now") {
      composeAndSend.mutate(payload);
    } else {
      if (!scheduledAt) {
        toast.error(t("pushAdmin.scheduleDateRequired"));
        return;
      }
      createCampaign.mutate(payload);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* LEFT (form) — 2 cols */}
      <div className="space-y-4 lg:col-span-2">
        {/* Targeting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("pushAdmin.audience")}
            </CardTitle>
            <CardDescription>{t("pushAdmin.audienceDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{t("pushAdmin.targetType")}</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("pushAdmin.targetAll")}</SelectItem>
                  <SelectItem value="customer">{t("pushAdmin.targetCustomer")}</SelectItem>
                  <SelectItem value="batch">{t("pushAdmin.targetBatch")}</SelectItem>
                  <SelectItem value="segment">{t("pushAdmin.targetSegment")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === "customer" && (
              <div>
                <Label>{t("pushAdmin.pickCustomer")}</Label>
                <Select value={targetCustomerId} onValueChange={setTargetCustomerId}>
                  <SelectTrigger><SelectValue placeholder={t("pushAdmin.pickCustomerPh")} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {customers.data?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.customerCode} — {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === "batch" && (
              <div>
                <Label>{t("pushAdmin.pickBatch")}</Label>
                <Select value={targetBatchId} onValueChange={setTargetBatchId}>
                  <SelectTrigger><SelectValue placeholder={t("pushAdmin.pickBatchPh")} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {batchList.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.batchCode} — {b.shippingType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === "segment" && (
              <div>
                <Label>{t("pushAdmin.pickSegment")}</Label>
                <Select value={targetSegment} onValueChange={(v) => setTargetSegment(v as Segment)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active_customers">{t("pushAdmin.segActive")}</SelectItem>
                    <SelectItem value="with_pending_packages">{t("pushAdmin.segPending")}</SelectItem>
                    <SelectItem value="with_unpaid_invoices">{t("pushAdmin.segUnpaid")}</SelectItem>
                    <SelectItem value="vip_customers">{t("pushAdmin.segVip")}</SelectItem>
                    <SelectItem value="inactive_30d">{t("pushAdmin.segInactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">{t("pushAdmin.audienceSize")}</span>
              <span className="font-semibold">
                {audiencePreview.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-emerald-600">{audiencePreview.data?.count ?? 0}</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("pushAdmin.content")}
            </CardTitle>
            <CardDescription>{t("pushAdmin.contentDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ku">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="ku">کوردی</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
                <TabsTrigger value="ar">العربية</TabsTrigger>
                <TabsTrigger value="zh">中文</TabsTrigger>
              </TabsList>
              <TabsContent value="ku" className="space-y-3">
                <div>
                  <Label>{t("pushAdmin.title2")}</Label>
                  <Input value={titleKu} onChange={(e) => setTitleKu(e.target.value)} maxLength={200} dir="rtl" />
                </div>
                <div>
                  <Label>{t("pushAdmin.body")}</Label>
                  <Textarea value={bodyKu} onChange={(e) => setBodyKu(e.target.value)} maxLength={2000} rows={3} dir="rtl" />
                </div>
              </TabsContent>
              <TabsContent value="en" className="space-y-3">
                <div>
                  <Label>{t("pushAdmin.title2")}</Label>
                  <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={200} dir="ltr" />
                </div>
                <div>
                  <Label>{t("pushAdmin.body")}</Label>
                  <Textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} maxLength={2000} rows={3} dir="ltr" />
                </div>
              </TabsContent>
              <TabsContent value="ar" className="space-y-3">
                <div>
                  <Label>{t("pushAdmin.title2")}</Label>
                  <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} maxLength={200} dir="rtl" />
                </div>
                <div>
                  <Label>{t("pushAdmin.body")}</Label>
                  <Textarea value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} maxLength={2000} rows={3} dir="rtl" />
                </div>
              </TabsContent>
              <TabsContent value="zh" className="space-y-3">
                <div>
                  <Label>{t("pushAdmin.title2")}</Label>
                  <Input value={titleZh} onChange={(e) => setTitleZh(e.target.value)} maxLength={200} dir="ltr" />
                </div>
                <div>
                  <Label>{t("pushAdmin.body")}</Label>
                  <Textarea value={bodyZh} onChange={(e) => setBodyZh(e.target.value)} maxLength={2000} rows={3} dir="ltr" />
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("pushAdmin.urlOptional")}</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/portal/shipments" maxLength={500} />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("pushAdmin.scheduleOptional")}
                </Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={!hasAtLeastOneLangPair || !scheduledAt || createCampaign.isPending}
            onClick={() => handleSubmit("schedule")}
          >
            {createCampaign.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Calendar className="me-2 h-4 w-4" />}
            {t("pushAdmin.btnSchedule")}
          </Button>
          <Button
            type="button"
            disabled={!hasAtLeastOneLangPair || composeAndSend.isPending || (audiencePreview.data?.count ?? 0) === 0}
            onClick={() => handleSubmit("now")}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {composeAndSend.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
            {t("pushAdmin.btnSendNow")}
          </Button>
        </div>
      </div>

      {/* RIGHT (preview) */}
      <div className="space-y-4">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t("pushAdmin.preview")}
            </CardTitle>
            <CardDescription>{t("pushAdmin.previewDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4 shadow-inner">
              <div className="rounded-xl bg-white dark:bg-slate-800 p-3 shadow-md">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-500 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-slate-500">WAZN EXPRESS</span>
                      <span className="text-[10px] text-slate-400">now</span>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate mt-0.5">
                      {previewLang.title || t("pushAdmin.previewTitleEmpty")}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {previewLang.body || t("pushAdmin.previewBodyEmpty")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY TAB
// ============================================================================
function HistoryTab() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const list = trpc.pushAdmin.listCampaigns.useQuery({ limit: 50, offset: 0 });
  const cancel = trpc.pushAdmin.cancelCampaign.useMutation({
    onSuccess: () => {
      toast.success(t("pushAdmin.campaignCancelled"));
      utils.pushAdmin.listCampaigns.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const runNow = trpc.pushAdmin.runNow.useMutation({
    onSuccess: () => {
      toast.success(t("pushAdmin.campaignRan"));
      utils.pushAdmin.listCampaigns.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (list.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (!list.data?.data.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>{t("pushAdmin.noCampaigns")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {list.data.data.map((c) => {
        const title = c.titleKu || c.titleEn || c.titleAr || c.titleZh || "(no title)";
        const body = c.bodyKu || c.bodyEn || c.bodyAr || c.bodyZh || "";
        const canCancel = c.status === "draft" || c.status === "scheduled";
        const canRun = c.status === "draft" || c.status === "scheduled";
        return (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold truncate">{title}</h4>
                    <Badge className={STATUS_BADGE_COLOR[c.status] || ""}>{c.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {c.targetType}
                      {c.targetSegment ? `: ${c.targetSegment}` : ""}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{body}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.totalRecipients}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {c.sentCount}
                    </span>
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="h-3 w-3" /> {c.failedCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {c.scheduledAt ? format(new Date(c.scheduledAt), "yyyy-MM-dd HH:mm") : format(new Date(c.createdAt), "yyyy-MM-dd HH:mm")}
                    </span>
                  </div>
                  {c.errorMessage && (
                    <p className="mt-2 text-xs text-red-500 break-words">{c.errorMessage}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {canRun && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runNow.isPending}
                      onClick={() => runNow.mutate({ campaignId: c.id })}
                    >
                      <Send className="me-1 h-3 w-3" />
                      {t("pushAdmin.runNow")}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate({ campaignId: c.id })}
                      className="text-red-500"
                    >
                      <XCircle className="me-1 h-3 w-3" />
                      {t("pushAdmin.cancel")}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// ANALYTICS TAB
// ============================================================================
function AnalyticsTab() {
  const { t } = useTranslation();
  const stats = trpc.pushAdmin.getStats.useQuery();

  if (stats.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const data = stats.data;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Smartphone className="h-5 w-5" />}
          label={t("pushAdmin.statTotalSubs")}
          value={data.totalSubscriptions}
          color="text-blue-500"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label={t("pushAdmin.statActiveSubs")}
          value={data.activeSubscriptions}
          color="text-emerald-500"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label={t("pushAdmin.statUniqueCust")}
          value={data.uniqueCustomers}
          color="text-amber-500"
        />
        <StatCard
          icon={<Send className="h-5 w-5" />}
          label={t("pushAdmin.statTotalSent")}
          value={data.totalPushesSent}
          color="text-purple-500"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pushAdmin.byPlatform")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byPlatform.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("pushAdmin.noData")}</p>
          ) : (
            <div className="space-y-2">
              {data.byPlatform.map((p) => (
                <div key={p.platform} className="flex items-center justify-between rounded-md border p-3">
                  <span className="font-medium capitalize">{p.platform}</span>
                  <Badge variant="outline">{p.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pushAdmin.recentCampaigns")}</CardTitle>
          <CardDescription>{t("pushAdmin.last30Days")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{data.campaignsLast30Days}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className={color}>{icon}</span>
        </div>
        <div className="mt-2 text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
