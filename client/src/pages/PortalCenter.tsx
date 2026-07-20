import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Activity, Package, FileText, LogIn, Search, MessageCircle,
  MousePointerClick, ChevronLeft, ChevronRight, Clock, TrendingUp,
  UserCheck, PackageCheck, Ban, Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Customer Portal Center — admin observability dashboard (/portal-center).
// Read-only. Shows who is in the portal, what each customer did, their
// self-declared tracking, claim requests, and a live activity feed.
// ---------------------------------------------------------------------------

type L = { ku: string; en: string; ar: string; zh: string };

function fmtDateTime(d?: string | Date | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Category → colour + icon for activity rows.
const CATEGORY_META: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; label: L }> = {
  auth:        { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", icon: LogIn,             label: { ku: "چوونەژوورەوە", en: "Login", ar: "تسجيل الدخول", zh: "登录" } },
  navigation:  { color: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",                 icon: MousePointerClick, label: { ku: "بینینی پەڕە", en: "Page view", ar: "عرض صفحة", zh: "页面浏览" } },
  declaration: { color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",      icon: Package,           label: { ku: "تۆماری بار", en: "Declaration", ar: "تصريح", zh: "申报" } },
  claim:       { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",          icon: FileText,          label: { ku: "داواکاری خاوەنداری", en: "Claim", ar: "مطالبة", zh: "认领" } },
  message:     { color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",              icon: MessageCircle,     label: { ku: "پەیام", en: "Message", ar: "رسالة", zh: "消息" } },
  search:      { color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",              icon: Search,            label: { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" } },
  profile:     { color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",      icon: UserCheck,         label: { ku: "پرۆفایل", en: "Profile", ar: "الملف", zh: "资料" } },
  other:       { color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",             icon: Activity,          label: { ku: "چالاکی", en: "Activity", ar: "نشاط", zh: "活动" } },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  matched: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function PortalCenter() {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const p = (v: L) => pickLang(language, v);

  const [openCustomer, setOpenCustomer] = useState<{ id: number; name: string; code: string } | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 shadow-lg">
          <div className="absolute -top-14 -end-14 w-44 h-44 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-sm">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">
                {p({ ku: "سەنتەری پۆرتالی موشتەری", en: "Customer Portal Center", ar: "مركز بوابة العملاء", zh: "客户门户中心" })}
              </h1>
              <p className="text-sm text-white/85 mt-0.5">
                {p({ ku: "چالاکی و جووڵەی موشتەرەکان لە پۆرتاڵدا", en: "Customer activity across the portal", ar: "نشاط العملاء عبر البوابة", zh: "客户在门户中的活动" })}
              </p>
            </div>
          </div>
        </div>

        <OverviewCards p={p} />

        <Tabs defaultValue="customers" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="customers" className="gap-1.5"><Users className="h-4 w-4" />{p({ ku: "موشتەرەکان", en: "Customers", ar: "العملاء", zh: "客户" })}</TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-4 w-4" />{p({ ku: "چالاکی", en: "Activity", ar: "النشاط", zh: "活动" })}</TabsTrigger>
            <TabsTrigger value="declared" className="gap-1.5"><Package className="h-4 w-4" />{p({ ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪" })}</TabsTrigger>
            <TabsTrigger value="claims" className="gap-1.5"><FileText className="h-4 w-4" />{p({ ku: "خاوەنداری", en: "Claims", ar: "المطالبات", zh: "认领" })}</TabsTrigger>
          </TabsList>

          <TabsContent value="customers"><CustomersTab p={p} onOpen={setOpenCustomer} /></TabsContent>
          <TabsContent value="activity"><ActivityTab p={p} /></TabsContent>
          <TabsContent value="declared"><DeclaredTab p={p} /></TabsContent>
          <TabsContent value="claims"><ClaimsTab p={p} /></TabsContent>
        </Tabs>
      </div>

      {openCustomer && (
        <CustomerTimelineDialog
          p={p}
          customer={openCustomer}
          onClose={() => setOpenCustomer(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Overview KPI cards
// ---------------------------------------------------------------------------
function OverviewCards({ p }: { p: (v: L) => string }) {
  const { data, isLoading } = trpc.portalCenter.getOverview.useQuery();

  const cards: { label: L; value: number; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { label: { ku: "کۆی موشتەرەکان", en: "Total customers", ar: "إجمالي العملاء", zh: "客户总数" }, value: data?.totalCustomers ?? 0, icon: Users, color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40" },
    { label: { ku: "چالاک ئەمڕۆ", en: "Active today", ar: "نشط اليوم", zh: "今日活跃" }, value: data?.activeToday ?? 0, icon: Activity, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40" },
    { label: { ku: "چالاک ئەم هەفتەیە", en: "Active this week", ar: "نشط هذا الأسبوع", zh: "本周活跃" }, value: data?.activeWeek ?? 0, icon: TrendingUp, color: "text-sky-600 bg-sky-100 dark:bg-sky-900/40" },
    { label: { ku: "تراکینگی چاوەڕوان", en: "Pending declares", ar: "تصاريح معلقة", zh: "待处理申报" }, value: data?.pendingDeclares ?? 0, icon: PackageCheck, color: "text-violet-600 bg-violet-100 dark:bg-violet-900/40" },
    { label: { ku: "خاوەنداری چاوەڕوان", en: "Pending claims", ar: "مطالبات معلقة", zh: "待处理认领" }, value: data?.pendingClaims ?? 0, icon: FileText, color: "text-amber-600 bg-amber-100 dark:bg-amber-900/40" },
    { label: { ku: "پەیام (٧ ڕۆژ)", en: "Messages (7d)", ar: "رسائل (7 أيام)", zh: "消息 (7天)" }, value: data?.messagesWeek ?? 0, icon: MessageCircle, color: "text-pink-600 bg-pink-100 dark:bg-pink-900/40" },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => (
        <Card key={i} className="rounded-2xl">
          <CardContent className="p-4">
            <div className={cn("inline-flex p-2 rounded-xl mb-2", c.color)}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black tabular-nums">{c.value.toLocaleString("en-US")}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{p(c.label)}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared pager
// ---------------------------------------------------------------------------
function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 pt-3">
      <span className="text-xs text-muted-foreground tabular-nums">{total.toLocaleString("en-US")} · {page}/{pages}</span>
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronRight className="h-4 w-4 rtl:hidden" /><ChevronLeft className="h-4 w-4 ltr:hidden" /></Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronLeft className="h-4 w-4 rtl:hidden" /><ChevronRight className="h-4 w-4 ltr:hidden" /></Button>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return <div className="space-y-2 py-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}</div>;
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-center py-10 text-sm text-muted-foreground">{text}</div>;
}

// ---------------------------------------------------------------------------
// Customers tab
// ---------------------------------------------------------------------------
function CustomersTab({ p, onOpen }: { p: (v: L) => string; onOpen: (c: { id: number; name: string; code: string }) => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = trpc.portalCenter.listCustomers.useQuery({ search: search || undefined, page, pageSize });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="relative mb-3 max-w-sm">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="ps-9"
            placeholder={p({ ku: "گەڕان بە ناو/کۆد/مۆبایل", en: "Search name / code / mobile", ar: "بحث بالاسم/الرمز/الهاتف", zh: "按姓名/编号/手机搜索" })} />
        </div>

        {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
          <EmptyRow text={p({ ku: "هیچ موشتەرێک نەدۆزرایەوە", en: "No customers found", ar: "لا يوجد عملاء", zh: "未找到客户" })} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{p({ ku: "موشتەری", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                  <TableHead className="text-center">{p({ ku: "تراکینگ", en: "Declares", ar: "تصاريح", zh: "申报" })}</TableHead>
                  <TableHead className="text-center">{p({ ku: "خاوەنداری", en: "Claims", ar: "مطالبات", zh: "认领" })}</TableHead>
                  <TableHead className="text-center">{p({ ku: "چالاکی", en: "Activity", ar: "النشاط", zh: "活动" })}</TableHead>
                  <TableHead>{p({ ku: "دواجار چوونەژوورەوە", en: "Last login", ar: "آخر دخول", zh: "上次登录" })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpen({ id: c.id, name: c.fullName, code: c.customerCode })}>
                    <TableCell>
                      <div className="font-semibold text-sm">{c.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.customerCode} · {c.mobileNumber}</div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{c.declaredCount || "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.claimCount || "—"}</TableCell>
                    <TableCell className="text-center tabular-nums">{c.activityCount || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(c.lastSignedIn)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Activity feed tab
// ---------------------------------------------------------------------------
function ActivityTab({ p }: { p: (v: L) => string }) {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<string>("all");
  const pageSize = 40;
  const { data, isLoading } = trpc.portalCenter.getActivityFeed.useQuery({
    page, pageSize, category: category === "all" ? undefined : (category as any),
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="mb-3 max-w-[200px]">
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{p({ ku: "هەموو چالاکییەکان", en: "All activity", ar: "كل النشاط", zh: "所有活动" })}</SelectItem>
              {Object.keys(CATEGORY_META).map((k) => (
                <SelectItem key={k} value={k}>{p(CATEGORY_META[k].label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
          <EmptyRow text={p({ ku: "هێشتا چالاکی تۆمار نەکراوە", en: "No activity recorded yet", ar: "لا يوجد نشاط بعد", zh: "尚无活动记录" })} />
        ) : (
          <>
            <div className="space-y-1.5">
              {data.data.map((a) => {
                const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
                return (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/50">
                    <div className={cn("mt-0.5 p-1.5 rounded-lg shrink-0", meta.color)}><meta.icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{a.customerName || "—"}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{a.customerCode}</span>
                        <Badge variant="secondary" className="text-[10px]">{p(meta.label)}</Badge>
                      </div>
                      {(a.detail || a.path) && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{a.detail || a.path}</div>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(a.createdAt)}</div>
                  </div>
                );
              })}
            </div>
            <Pager page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Declared tracking tab
// ---------------------------------------------------------------------------
function DeclaredTab({ p }: { p: (v: L) => string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = trpc.portalCenter.listDeclaredPackages.useQuery({
    search: search || undefined, status: status === "all" ? undefined : (status as any), page, pageSize,
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="ps-9"
              placeholder={p({ ku: "گەڕان بە تراکینگ/بەرهەم", en: "Search tracking / product", ar: "بحث بالتتبع/المنتج", zh: "按追踪号/商品搜索" })} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{p({ ku: "هەموو دۆخەکان", en: "All statuses", ar: "كل الحالات", zh: "所有状态" })}</SelectItem>
              <SelectItem value="pending">{p({ ku: "چاوەڕوان", en: "Pending", ar: "معلق", zh: "待处理" })}</SelectItem>
              <SelectItem value="matched">{p({ ku: "هاوتاکراو", en: "Matched", ar: "مطابق", zh: "已匹配" })}</SelectItem>
              <SelectItem value="received">{p({ ku: "وەرگیراو", en: "Received", ar: "مستلم", zh: "已收到" })}</SelectItem>
              <SelectItem value="cancelled">{p({ ku: "هەڵوەشاوە", en: "Cancelled", ar: "ملغى", zh: "已取消" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
          <EmptyRow text={p({ ku: "هیچ تراکینگێک نەدۆزرایەوە", en: "No declarations found", ar: "لا توجد تصاريح", zh: "未找到申报" })} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{p({ ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</TableHead>
                  <TableHead>{p({ ku: "موشتەری", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                  <TableHead>{p({ ku: "پلاتفۆرم", en: "Platform", ar: "المنصة", zh: "平台" })}</TableHead>
                  <TableHead>{p({ ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                  <TableHead>{p({ ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-mono text-sm font-semibold">{d.trackingNumber}</div>
                      {d.productName && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{d.productName}</div>}
                    </TableCell>
                    <TableCell className="text-xs"><div className="font-medium">{d.customerName}</div><div className="text-muted-foreground font-mono">{d.customerCode}</div></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.platform || "—"}</TableCell>
                    <TableCell><Badge className={cn("text-[10px] border-0", STATUS_COLORS[d.status] ?? STATUS_COLORS.pending)}>{d.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(d.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Claims tab
// ---------------------------------------------------------------------------
function ClaimsTab({ p }: { p: (v: L) => string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = trpc.portalCenter.listClaimRequests.useQuery({
    search: search || undefined, status: status === "all" ? undefined : (status as any), page, pageSize,
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="ps-9"
              placeholder={p({ ku: "گەڕان بە تراکینگ/ژمارە", en: "Search tracking / number", ar: "بحث بالتتبع/الرقم", zh: "按追踪号/编号搜索" })} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{p({ ku: "هەموو دۆخەکان", en: "All statuses", ar: "كل الحالات", zh: "所有状态" })}</SelectItem>
              <SelectItem value="pending">{p({ ku: "چاوەڕوان", en: "Pending", ar: "معلق", zh: "待处理" })}</SelectItem>
              <SelectItem value="approved">{p({ ku: "پەسەندکراو", en: "Approved", ar: "موافق", zh: "已批准" })}</SelectItem>
              <SelectItem value="rejected">{p({ ku: "ڕەتکراوە", en: "Rejected", ar: "مرفوض", zh: "已拒绝" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
          <EmptyRow text={p({ ku: "هیچ داواکاریەک نەدۆزرایەوە", en: "No claim requests found", ar: "لا توجد مطالبات", zh: "未找到认领请求" })} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{p({ ku: "ژمارە", en: "Number", ar: "الرقم", zh: "编号" })}</TableHead>
                  <TableHead>{p({ ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</TableHead>
                  <TableHead>{p({ ku: "موشتەری", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                  <TableHead>{p({ ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                  <TableHead>{p({ ku: "بەروار", en: "Date", ar: "التاريخ", zh: "日期" })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.requestNumber}</TableCell>
                    <TableCell className="font-mono text-sm font-semibold">{c.trackingNumber}</TableCell>
                    <TableCell className="text-xs"><div className="font-medium">{c.customerName}</div><div className="text-muted-foreground font-mono">{c.customerCode}</div></TableCell>
                    <TableCell><Badge className={cn("text-[10px] border-0", STATUS_COLORS[c.status] ?? STATUS_COLORS.pending)}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(c.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-customer timeline dialog
// ---------------------------------------------------------------------------
function CustomerTimelineDialog({ p, customer, onClose }: {
  p: (v: L) => string;
  customer: { id: number; name: string; code: string };
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.portalCenter.getCustomerTimeline.useQuery({ customerId: customer.id });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {customer.name}
            <span className="text-xs font-mono text-muted-foreground">{customer.code}</span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : !data || data.length === 0 ? (
          <EmptyRow text={p({ ku: "هیچ چالاکییەک نییە", en: "No activity", ar: "لا يوجد نشاط", zh: "无活动" })} />
        ) : (
          <div className="relative ps-4 space-y-3 before:absolute before:top-1 before:bottom-1 before:start-[7px] before:w-px before:bg-border">
            {data.map((e, i) => {
              const meta = CATEGORY_META[e.category] ?? CATEGORY_META.other;
              return (
                <div key={i} className="relative flex items-start gap-3">
                  <div className={cn("relative z-10 -ms-4 mt-0.5 p-1 rounded-full ring-4 ring-background shrink-0", meta.color)}>
                    <meta.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{p(meta.label)}</span>
                      {e.status && <Badge className={cn("text-[9px] border-0", STATUS_COLORS[e.status] ?? STATUS_COLORS.pending)}>{e.status}</Badge>}
                    </div>
                    {e.detail && <div className="text-xs text-muted-foreground break-words">{e.detail}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(e.at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
