import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { DEFAULT_RESET_PASSWORD } from "@shared/resetPassword";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TutorialsTab } from "@/components/portal-center/TutorialsTab";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getProhibitedItemLabel } from "@/constants/prohibitedItems";
import {
  Users, Activity, Package, FileText, LogIn, Search, MessageCircle,
  MousePointerClick, ChevronLeft, ChevronRight, Clock, TrendingUp,
  UserCheck, PackageCheck, Ban, Sparkles, Send, Bell, Megaphone,
  StickyNote, DollarSign, Plane, Zap, Ship, Loader2, Star, Newspaper, Pin, Eye,
  EyeOff, KeyRound, ShieldCheck, Copy, Check, RefreshCw, Phone, Power, Undo2,
  GraduationCap,
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

// Convert a local Iraqi mobile (07xx…) to wa.me international format.
function waLink(mobile: string, text?: string): string {
  let digits = (mobile || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "964" + digits.slice(1);
  else if (digits.startsWith("7")) digits = "964" + digits;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** WhatsApp brand glyph (lucide has no brand icons). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  matched: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

// Shared styling for the portal-center nav tabs: muted by default, a soft
// indigo hover, and a bold indigo→purple gradient pill (with a lifted icon)
// when active — matching the page header for a cohesive, professional look.
const TAB_TRIGGER_CLS =
  "gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 " +
  "transition-all duration-200 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-white/70 dark:hover:bg-slate-800/70 " +
  "data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 " +
  "data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/30 " +
  "[&_svg]:size-4 [&_svg]:transition-transform data-[state=active]:[&_svg]:scale-110";

export default function PortalCenter() {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const p = (v: L) => pickLang(language, v);

  const [openCustomer, setOpenCustomer] = useState<{ id: number; name: string; code: string } | null>(null);

  // Light poll so new Yuan orders surface as a badge without a refresh.
  const pendingYuan = trpc.portalCenter.countPendingYuanOrders.useQuery(undefined, {
    refetchInterval: 60000,
    retry: false,
  });

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
          <TabsList className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-11 w-full max-w-6xl h-auto gap-1 rounded-2xl p-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-sm">
            <TabsTrigger value="customers" className={TAB_TRIGGER_CLS}><Users className="h-4 w-4" />{p({ ku: "موشتەرەکان", en: "Customers", ar: "العملاء", zh: "客户" })}</TabsTrigger>
            <TabsTrigger value="messages" className={TAB_TRIGGER_CLS}><MessageCircle className="h-4 w-4" />{p({ ku: "پەیامەکان", en: "Messages", ar: "الرسائل", zh: "消息" })}</TabsTrigger>
            <TabsTrigger value="send" className={TAB_TRIGGER_CLS}><Send className="h-4 w-4" />{p({ ku: "ناردن", en: "Send", ar: "إرسال", zh: "发送" })}</TabsTrigger>
            <TabsTrigger value="prices" className={TAB_TRIGGER_CLS}><DollarSign className="h-4 w-4" />{p({ ku: "نرخەکان", en: "Prices", ar: "الأسعار", zh: "价格" })}</TabsTrigger>
            <TabsTrigger value="tutorials" className={TAB_TRIGGER_CLS}><GraduationCap className="h-4 w-4" />{p({ ku: "فێرکاری", en: "Tutorials", ar: "الشروحات", zh: "教程" })}</TabsTrigger>
            <TabsTrigger value="activity" className={TAB_TRIGGER_CLS}><Activity className="h-4 w-4" />{p({ ku: "چالاکی", en: "Activity", ar: "النشاط", zh: "活动" })}</TabsTrigger>
            <TabsTrigger value="declared" className={TAB_TRIGGER_CLS}><Package className="h-4 w-4" />{p({ ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "追踪" })}</TabsTrigger>
            <TabsTrigger value="claims" className={TAB_TRIGGER_CLS}><FileText className="h-4 w-4" />{p({ ku: "خاوەنداری", en: "Claims", ar: "المطالبات", zh: "认领" })}</TabsTrigger>
            <TabsTrigger value="prohibited" className={TAB_TRIGGER_CLS}><Ban className="h-4 w-4" />{p({ ku: "قەدەغە", en: "Prohibited", ar: "ممنوعة", zh: "违禁" })}</TabsTrigger>
            <TabsTrigger value="ratings" className={TAB_TRIGGER_CLS}><Star className="h-4 w-4" />{p({ ku: "هەڵسەنگاندن", en: "Ratings", ar: "التقييمات", zh: "评价" })}</TabsTrigger>
            <TabsTrigger value="announcements" className={TAB_TRIGGER_CLS}><Megaphone className="h-4 w-4" />{p({ ku: "ڕاگەیاندن", en: "Announce", ar: "إعلانات", zh: "公告" })}</TabsTrigger>
            <TabsTrigger value="yuan" className={TAB_TRIGGER_CLS}>
              <span className="font-black text-sm leading-none">¥</span>
              {p({ ku: "یوان", en: "Yuan", ar: "اليوان", zh: "人民币" })}
              {(pendingYuan.data ?? 0) > 0 && (
                <span className="ms-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {pendingYuan.data}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers"><CustomersTab p={p} onOpen={setOpenCustomer} /></TabsContent>
          <TabsContent value="messages"><MessagesTab p={p} /></TabsContent>
          <TabsContent value="send"><SendTab p={p} /></TabsContent>
          <TabsContent value="prices"><PricesTab p={p} /></TabsContent>
          <TabsContent value="tutorials"><TutorialsTab p={p} /></TabsContent>
          <TabsContent value="activity"><ActivityTab p={p} /></TabsContent>
          <TabsContent value="declared"><DeclaredTab p={p} /></TabsContent>
          <TabsContent value="claims"><ClaimsTab p={p} /></TabsContent>
          <TabsContent value="prohibited"><ProhibitedTab p={p} /></TabsContent>
          <TabsContent value="ratings"><RatingsTab p={p} /></TabsContent>
          <TabsContent value="yuan"><YuanTab p={p} /></TabsContent>
          <TabsContent value="announcements"><AnnouncementsTab p={p} /></TabsContent>
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
// Prohibited packages tab — customer, tracking, seen?, decision, fee
// ---------------------------------------------------------------------------
function ProhibitedTab({ p }: { p: (v: L) => string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [fees, setFees] = useState<Record<number, string>>({});
  const pageSize = 25;
  const { data, isLoading, refetch } = trpc.prohibited.listAdmin.useQuery({
    search: search || undefined, status: status === "all" ? undefined : status, page, pageSize,
  });
  const chargeMut = trpc.prohibited.chargeFee.useMutation({
    onSuccess: () => { toast.success(p({ ku: "کولفە خرایە سەر باڵانس", en: "Fee charged to balance", ar: "تمت إضافة الرسوم", zh: "已计入余额" })); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const statusMut = trpc.prohibited.setStatus.useMutation({ onSuccess: () => refetch(), onError: (e) => toast.error(e.message) });
  const reverseFeeMut = trpc.prohibited.reverseFee.useMutation({
    onSuccess: () => { toast.success(p({ ku: "کولفە گەڕێندرایەوە و لەسەر باڵانس لابرا", en: "Fee reversed and removed from balance", ar: "تم إلغاء الرسوم من الرصيد", zh: "费用已从余额中撤销" })); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const choiceLabel = (c: string | null) => c ? p(
    c === "return" ? { ku: "گەڕاندنەوە", en: "Return", ar: "إرجاع", zh: "退回" } :
    c === "reship" ? { ku: "ناردن بۆ ئەدرێس", en: "Reship", ar: "إرسال", zh: "转寄" } :
    { ku: "لەناوبردن", en: "Destroy", ar: "إتلاف", zh: "销毁" }) : "—";

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="ps-9"
              placeholder={p({ ku: "گەڕان بە تراک/موشتەری", en: "Search tracking / customer", ar: "بحث بالتتبع/العميل", zh: "按追踪号/客户搜索" })} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{p({ ku: "هەموو دۆخەکان", en: "All statuses", ar: "كل الحالات", zh: "所有状态" })}</SelectItem>
              <SelectItem value="pending">{p({ ku: "چاوەڕوان", en: "Pending", ar: "معلق", zh: "待处理" })}</SelectItem>
              <SelectItem value="chosen">{p({ ku: "هەڵبژێردراو", en: "Chosen", ar: "تم الاختيار", zh: "已选择" })}</SelectItem>
              <SelectItem value="resolved">{p({ ku: "چارەسەرکراو", en: "Resolved", ar: "تم الحل", zh: "已解决" })}</SelectItem>
              <SelectItem value="cancelled">{p({ ku: "هەڵوەشاوە", en: "Cancelled", ar: "ملغى", zh: "已取消" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
          <EmptyRow text={p({ ku: "هیچ کاڵایەکی قەدەغە نییە", en: "No prohibited items", ar: "لا توجد بضائع ممنوعة", zh: "无违禁物品" })} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{p({ ku: "تراک", en: "Tracking", ar: "التتبع", zh: "追踪号" })}</TableHead>
                  <TableHead>{p({ ku: "موشتەری", en: "Customer", ar: "العميل", zh: "客户" })}</TableHead>
                  <TableHead>{p({ ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })}</TableHead>
                  <TableHead>{p({ ku: "بینراوە؟", en: "Seen?", ar: "شوهد؟", zh: "已看?" })}</TableHead>
                  <TableHead>{p({ ku: "بڕیار", en: "Decision", ar: "القرار", zh: "决定" })}</TableHead>
                  <TableHead>{p({ ku: "کولفە", en: "Fee", ar: "الرسوم", zh: "费用" })}</TableHead>
                  <TableHead>{p({ ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((d: any) => {
                  const reason = getProhibitedItemLabel(d.reasonId);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm font-semibold">{d.trackingNumber}</TableCell>
                      <TableCell className="text-xs"><div className="font-medium">{d.customerName}</div><div className="text-muted-foreground font-mono">{d.customerCode}</div></TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{reason ? p(reason) : (d.reasonNote || "—")}</TableCell>
                      <TableCell>{d.viewedByCustomerAt
                        ? <Badge className="text-[10px] border-0 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">{p({ ku: "بینیویەتی", en: "Seen", ar: "شوهد", zh: "已看" })}</Badge>
                        : <Badge className="text-[10px] border-0 bg-slate-100 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400">{p({ ku: "نەیبینیوە", en: "Not yet", ar: "لا", zh: "未看" })}</Badge>}</TableCell>
                      <TableCell className="text-xs font-medium">{choiceLabel(d.resolutionChoice)}</TableCell>
                      <TableCell>
                        {d.chargedAt ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">${Number(d.feeUsd).toFixed(2)}</span>
                            <Button size="sm" variant="outline" className="h-7 gap-1 border-red-200 bg-red-50 px-2 text-[11px] font-medium text-red-600 dark:text-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900 dark:bg-red-950/40" disabled={reverseFeeMut.isPending}
                              onClick={() => { if (confirm(p({ ku: "کولفە بگەڕێندرێتەوە و لەسەر باڵانس لابردرێت؟", en: "Reverse the fee and remove it from the balance?", ar: "إلغاء الرسوم وإزالتها من الرصيد؟", zh: "撤销费用并从余额中移除？" }))) reverseFeeMut.mutate({ id: d.id }); }}>
                              {reverseFeeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                              {p({ ku: "گەڕاندنەوەی کولفە", en: "Reverse fee", ar: "إلغاء الرسوم", zh: "撤销费用" })}
                            </Button>
                          </div>
                        ) : d.resolutionChoice ? (
                          <div className="flex items-center gap-1">
                            <Input value={fees[d.id] ?? ""} onChange={(e) => setFees((f) => ({ ...f, [d.id]: e.target.value }))} className="h-7 w-16 text-xs" placeholder="$" />
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={chargeMut.isPending}
                              onClick={() => { const v = parseFloat(fees[d.id] || ""); if (!v || v <= 0) { toast.error(p({ ku: "بڕی کولفە بنووسە", en: "Enter a fee", ar: "أدخل الرسوم", zh: "输入费用" })); return; } chargeMut.mutate({ id: d.id, feeUsd: v }); }}>
                              {p({ ku: "خستنە قەرز", en: "Charge", ar: "احتساب", zh: "计费" })}
                            </Button>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Select value={d.status} onValueChange={(v) => statusMut.mutate({ id: d.id, status: v as any })}>
                          <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{p({ ku: "چاوەڕوان", en: "Pending", ar: "معلق", zh: "待处理" })}</SelectItem>
                            <SelectItem value="chosen">{p({ ku: "هەڵبژێردراو", en: "Chosen", ar: "تم الاختيار", zh: "已选择" })}</SelectItem>
                            <SelectItem value="resolved">{p({ ku: "چارەسەرکراو", en: "Resolved", ar: "تم الحل", zh: "已解决" })}</SelectItem>
                            <SelectItem value="cancelled">{p({ ku: "هەڵوەشاوە", en: "Cancelled", ar: "ملغى", zh: "已取消" })}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
// Messages tab — customer inbox with reply + WhatsApp
// ---------------------------------------------------------------------------
function MessagesTab({ p }: { p: (v: L) => string }) {
  const [selected, setSelected] = useState<{ customerId: number; name: string; code: string; mobile: string } | null>(null);
  const utils = trpc.useUtils();
  const { data: convos, isLoading } = trpc.portalCenter.listConversations.useQuery(undefined, { refetchInterval: 30000 });
  const { data: thread, isLoading: threadLoading } = trpc.portalCenter.getConversation.useQuery(
    { customerId: selected?.customerId ?? 0 },
    { enabled: !!selected, refetchInterval: 10000 },
  );
  const markRead = trpc.portalCenter.markConversationRead.useMutation({
    onSuccess: () => utils.portalCenter.listConversations.invalidate(),
  });
  const [reply, setReply] = useState("");
  const sendReply = trpc.portalCenter.replyToCustomer.useMutation({
    onSuccess: () => {
      setReply("");
      utils.portalCenter.getConversation.invalidate();
      utils.portalCenter.listConversations.invalidate();
      toast.success(p({ ku: "نێردرا", en: "Sent", ar: "أُرسلت", zh: "已发送" }));
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          {/* Conversation list */}
          <div className="space-y-1.5 md:border-e md:pe-3 max-h-[600px] overflow-y-auto">
            {isLoading ? <TableSkeleton /> : !convos || convos.length === 0 ? (
              <EmptyRow text={p({ ku: "هیچ گفتوگۆیەک نییە", en: "No conversations", ar: "لا توجد محادثات", zh: "无对话" })} />
            ) : convos.map((c) => (
              <button
                key={c.customerId}
                onClick={() => {
                  setSelected({ customerId: c.customerId, name: c.customerName, code: c.customerCode, mobile: c.mobileNumber });
                  if (c.unreadCount > 0) markRead.mutate({ customerId: c.customerId });
                }}
                className={cn(
                  "w-full text-start rounded-xl p-2.5 transition-colors",
                  selected?.customerId === c.customerId ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-muted/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{c.customerName}</span>
                  {c.unreadCount > 0 && (
                    <span className="min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{c.unreadCount}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">{c.lastMessage}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{fmtDateTime(c.lastMessageAt)}</div>
              </button>
            ))}
          </div>

          {/* Thread */}
          <div className="flex flex-col min-h-[400px]">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                {p({ ku: "گفتوگۆیەک هەڵبژێرە", en: "Select a conversation", ar: "اختر محادثة", zh: "选择一个对话" })}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 pb-2 border-b mb-2">
                  <div>
                    <div className="text-sm font-bold">{selected.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{selected.code} · {selected.mobile}</div>
                  </div>
                  <a
                    href={waLink(selected.mobile)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    {p({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
                  </a>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[420px] space-y-2 py-1">
                  {threadLoading ? <TableSkeleton /> : (thread ?? []).map((m: any) => (
                    <div key={m.id} className={cn("flex", m.senderType === "admin" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        m.senderType === "admin"
                          ? "bg-indigo-600 text-white rounded-ee-sm"
                          : "bg-muted rounded-es-sm",
                      )}>
                        <p className="break-words whitespace-pre-wrap">{m.message}</p>
                        <p className={cn("text-[9px] mt-1", m.senderType === "admin" ? "text-white/70" : "text-muted-foreground")}>{fmtDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-end gap-2 pt-2 border-t mt-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder={p({ ku: "وەڵامەکەت بنووسە...", en: "Write your reply...", ar: "اكتب ردك...", zh: "输入回复..." })}
                    className="flex-1 resize-none"
                  />
                  <Button
                    onClick={() => selected && reply.trim() && sendReply.mutate({ customerId: selected.customerId, message: reply.trim() })}
                    disabled={!reply.trim() || sendReply.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Send tab — personal notification + broadcast (the announcement banner and
// the home-page announcements live in the dedicated Announcements tab).
// ---------------------------------------------------------------------------
function SendTab({ p }: { p: (v: L) => string }) {
  return (
    <div className="space-y-4">
      <PersonalNotificationCard p={p} />
      <BroadcastCard p={p} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Announcements tab — everything the customer sees as "ڕاگەیاندنەکان":
//   1) the slim announcement banner (portal_announcement setting), and
//   2) the announcement CARDS on the portal home, which are FEATURED blog
//      posts (trpc.blog.*) — managed here with quick create/publish/delete.
// ---------------------------------------------------------------------------
function AnnouncementsTab({ p }: { p: (v: L) => string }) {
  return (
    <div className="space-y-4">
      <HomeAnnouncementsCard p={p} />
      <NewsChannelsCard p={p} />
      <AnnouncementCard p={p} />
    </div>
  );
}

// Wazn News — social channel links + the home news ticker toggle.
function NewsChannelsCard({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portalCenter.getNewsSettings.useQuery();
  const [form, setForm] = useState({
    tickerEnabled: true, youtube: "", telegram: "", tiktok: "", instagram: "", facebook: "",
  });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded && !isLoading && data) {
      setForm({
        tickerEnabled: data.tickerEnabled,
        youtube: data.youtube, telegram: data.telegram, tiktok: data.tiktok,
        instagram: data.instagram, facebook: data.facebook,
      });
      setLoaded(true);
    }
  }, [data, isLoading, loaded]);

  const save = trpc.portalCenter.setNewsSettings.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "پاشەکەوتکرا", en: "Saved", ar: "حُفظ", zh: "已保存" }));
      utils.portalCenter.getNewsSettings.invalidate();
      utils.customerPortal.getNewsChannels.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const channels: { key: "youtube" | "telegram" | "tiktok" | "instagram" | "facebook"; label: string; placeholder: string }[] = [
    { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@wazn" },
    { key: "telegram", label: "Telegram", placeholder: "https://t.me/wazn" },
    { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@wazn" },
    { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/wazn" },
    { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/wazn" },
  ];

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            {p({ ku: "وەزن نیوز — کەناڵەکان و تیکەر", en: "Wazn News — channels & ticker", ar: "وزن نيوز — القنوات والشريط", zh: "Wazn 新闻——频道与滚动条" })}
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              {p({ ku: "تیکەری هەواڵ", en: "News ticker", ar: "شريط الأخبار", zh: "新闻滚动条" })}
            </Label>
            <Switch checked={form.tickerEnabled} onCheckedChange={(v) => setForm({ ...form, tickerEnabled: v })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {p({
            ku: "لینکی کەناڵەکانت دابنێ — تەنها ئەوانەی پڕکراونەتەوە لە پۆرتاڵ دەردەکەون. تیکەرەکە سەردێری هەواڵەکان لە خوارەوەی ئەپ نیشان دەدات",
            en: "Set your channel links — only filled ones show in the portal. The ticker scrolls news headlines at the bottom of the app",
            ar: "أدخل روابط قنواتك — تظهر المملوءة فقط في البوابة. الشريط يعرض عناوين الأخبار أسفل التطبيق",
            zh: "填写频道链接——仅显示已填写的。滚动条在应用底部显示新闻标题",
          })}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {channels.map((c) => (
            <div key={c.key} className="space-y-1">
              <Label className="text-xs">{c.label}</Label>
              <Input dir="ltr" placeholder={c.placeholder} value={form[c.key]} onChange={(e) => setForm({ ...form, [c.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
            {save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            {p({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const BLOG_CATEGORY_LABEL: Record<string, L> = {
  announcement: { ku: "ڕاگەیاندن", en: "Announcement", ar: "إعلان", zh: "公告" },
  news: { ku: "هەواڵ", en: "News", ar: "خبر", zh: "新闻" },
  promotion: { ku: "داشکاندن", en: "Promotion", ar: "عرض", zh: "促销" },
  update: { ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" },
  guide: { ku: "ڕێنمایی", en: "Guide", ar: "دليل", zh: "指南" },
};

function HomeAnnouncementsCard({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.blog.list.useQuery();

  const [form, setForm] = useState({
    category: "announcement" as "announcement" | "news" | "promotion" | "update" | "guide",
    titleKu: "", titleEn: "", titleAr: "",
    bodyKu: "", bodyEn: "", bodyAr: "",
  });

  const invalidateBlog = () => {
    utils.blog.list.invalidate();
    utils.blog.featured.invalidate();
    utils.blog.published.invalidate();
  };

  const create = trpc.blog.create.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "بڵاوکرایەوە — لە پۆرتاڵ دەردەکەوێت", en: "Published — now visible on the portal", ar: "نُشر — ظاهر الآن في البوابة", zh: "已发布——已在门户显示" }));
      setForm({ category: "announcement", titleKu: "", titleEn: "", titleAr: "", bodyKu: "", bodyEn: "", bodyAr: "" });
      invalidateBlog();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.blog.update.useMutation({
    onSuccess: invalidateBlog,
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.blog.delete.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "سڕایەوە", en: "Deleted", ar: "حُذف", zh: "已删除" }));
      invalidateBlog();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    const hasTitle = form.titleKu.trim() || form.titleEn.trim() || form.titleAr.trim();
    const hasBody = form.bodyKu.trim() || form.bodyEn.trim() || form.bodyAr.trim();
    if (!hasTitle || !hasBody) {
      toast.error(p({ ku: "بەلایەنی کەمەوە بە زمانێک ناونیشان و دەق بنووسە", en: "Write a title and body in at least one language", ar: "اكتب عنواناً ونصاً بلغة واحدة على الأقل", zh: "至少用一种语言填写标题和正文" }));
      return;
    }
    // Featured + published so it shows in the portal home "Announcements"
    // section immediately (the home shows featured posts only).
    create.mutate({
      category: form.category,
      titleKu: form.titleKu.trim() || undefined,
      titleEn: form.titleEn.trim() || undefined,
      titleAr: form.titleAr.trim() || undefined,
      contentKu: form.bodyKu.trim() || undefined,
      contentEn: form.bodyEn.trim() || undefined,
      contentAr: form.bodyAr.trim() || undefined,
      summaryKu: form.bodyKu.trim() || undefined,
      summaryEn: form.bodyEn.trim() || undefined,
      summaryAr: form.bodyAr.trim() || undefined,
      status: "published",
      isFeatured: true,
      publishedAt: new Date(),
    });
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            {p({ ku: "ڕاگەیاندنەکانی پەڕەی سەرەکی پۆرتاڵ", en: "Portal home announcements", ar: "إعلانات الصفحة الرئيسية للبوابة", zh: "门户首页公告" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {p({
              ku: "ئەم کارتانە لە بەشی «ڕاگەیاندنەکان»ی پەڕەی سەرەکی کڕیار دەردەکەون — دەستبەجێ دوای بڵاوکردنەوە",
              en: "These cards show in the customer home 'Announcements' section — instantly after publishing",
              ar: "تظهر هذه البطاقات في قسم «الإعلانات» في الصفحة الرئيسية للعميل — فور النشر",
              zh: "这些卡片会显示在客户首页的\"公告\"版块——发布后立即生效",
            })}
          </p>
        </div>

        {/* Quick create */}
        <div className="rounded-xl border p-3 dark:border-white/10 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(BLOG_CATEGORY_LABEL).map((c) => (
                  <SelectItem key={c} value={c}>{p(BLOG_CATEGORY_LABEL[c])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">
              {p({ ku: "بۆ وێنە و نووسینی درێژ، بەشی بەڕێوەبردنی بلۆگ بەکاربهێنە", en: "For images and long posts use Blog Management", ar: "للصور والمنشورات الطويلة استخدم إدارة المدونة", zh: "如需图片和长文请使用博客管理" })}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input dir="rtl" placeholder={p({ ku: "ناونیشان — کوردی", en: "Title — Kurdish", ar: "العنوان — كردي", zh: "标题——库尔德语" })} value={form.titleKu} onChange={(e) => setForm({ ...form, titleKu: e.target.value })} />
            <Input placeholder="Title — English" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            <Input dir="rtl" placeholder={p({ ku: "ناونیشان — عەرەبی", en: "Title — Arabic", ar: "العنوان — عربي", zh: "标题——阿拉伯语" })} value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Textarea rows={2} dir="rtl" placeholder={p({ ku: "دەق — کوردی", en: "Body — Kurdish", ar: "النص — كردي", zh: "正文——库尔德语" })} value={form.bodyKu} onChange={(e) => setForm({ ...form, bodyKu: e.target.value })} />
            <Textarea rows={2} placeholder="Body — English" value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })} />
            <Textarea rows={2} dir="rtl" placeholder={p({ ku: "دەق — عەرەبی", en: "Body — Arabic", ar: "النص — عربي", zh: "正文——阿拉伯语" })} value={form.bodyAr} onChange={(e) => setForm({ ...form, bodyAr: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={create.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {create.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Megaphone className="h-4 w-4 me-2" />}
              {p({ ku: "بڵاوکردنەوە", en: "Publish", ar: "نشر", zh: "发布" })}
            </Button>
          </div>
        </div>

        {/* Existing posts */}
        {isLoading ? (
          <TableSkeleton />
        ) : !posts || posts.length === 0 ? (
          <EmptyRow text={p({ ku: "هێشتا هیچ ڕاگەیاندنێک نییە — یەکەمیان لە سەرەوە بنووسە", en: "No announcements yet — write the first one above", ar: "لا توجد إعلانات بعد — اكتب الأول أعلاه", zh: "暂无公告——请在上方发布第一条" })} />
        ) : (
          <div className="space-y-2">
            {posts.map((post: any) => {
              const isPublished = post.status === "published";
              return (
                <div key={post.id} className="rounded-xl border p-3 dark:border-white/10 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">
                        {post.titleKu || post.titleEn || post.titleAr || "—"}
                      </span>
                      <Badge className="border-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                        {p(BLOG_CATEGORY_LABEL[post.category] ?? BLOG_CATEGORY_LABEL.announcement)}
                      </Badge>
                      <Badge className={cn(
                        "border-0 text-[10px]",
                        isPublished
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                      )}>
                        {isPublished
                          ? p({ ku: "بڵاوکراوە", en: "Published", ar: "منشور", zh: "已发布" })
                          : p({ ku: "ڕەشنووس", en: "Draft", ar: "مسودة", zh: "草稿" })}
                      </Badge>
                      {post.isPinned && (
                        <Pin className="h-3.5 w-3.5 fill-orange-500 text-orange-500 dark:text-orange-400" />
                      )}
                      {post.isFeatured && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      )}
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Eye className="h-3 w-3" />{post.viewCount ?? 0}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{fmtDateTime(post.publishedAt || post.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: post.id, isPinned: !post.isPinned })}
                      title={p({ ku: "چەسپاندن لە سەرەوە", en: "Pin to top", ar: "تثبيت في الأعلى", zh: "置顶" })}
                    >
                      <Pin className={cn("h-3.5 w-3.5", post.isPinned && "fill-orange-500 text-orange-500 dark:text-orange-400")} />
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: post.id, isFeatured: !post.isFeatured })}
                      title={p({ ku: "دەرکەوتن لە پەڕەی سەرەکی", en: "Show on home page", ar: "الظهور في الرئيسية", zh: "在首页显示" })}
                    >
                      <Star className={cn("h-3.5 w-3.5", post.isFeatured && "fill-amber-400 text-amber-400")} />
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-8 text-xs"
                      disabled={update.isPending}
                      onClick={() => update.mutate({
                        id: post.id,
                        status: isPublished ? "draft" : "published",
                        ...(isPublished ? {} : { publishedAt: new Date() }),
                      })}
                    >
                      {isPublished
                        ? p({ ku: "شاردنەوە", en: "Unpublish", ar: "إخفاء", zh: "隐藏" })
                        : p({ ku: "بڵاوکردنەوە", en: "Publish", ar: "نشر", zh: "发布" })}
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-8 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(p({ ku: "دڵنیایت لە سڕینەوە؟", en: "Delete this announcement?", ar: "هل تريد الحذف؟", zh: "确定删除吗？" }))) {
                          remove.mutate({ id: post.id });
                        }
                      }}
                    >
                      {p({ ku: "سڕینەوە", en: "Delete", ar: "حذف", zh: "删除" })}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonalNotificationCard({ p }: { p: (v: L) => string }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [customer, setCustomer] = useState<{ id: number; name: string; code: string; mobile: string } | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [withPush, setWithPush] = useState(true);
  // Empty search returns the most recently active customers, so the picker
  // opens with a browsable list on focus instead of looking dead.
  const { data: results, isLoading: searching } = trpc.portalCenter.listCustomers.useQuery(
    { search: search.trim() || undefined, page: 1, pageSize: 6 },
    { enabled: !customer },
  );
  const dropdownOpen = !customer && focused;
  const send = trpc.portalCenter.sendNotificationToCustomer.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "نۆتیفیکەیشن نێردرا", en: "Notification sent", ar: "أُرسل الإشعار", zh: "通知已发送" }));
      setTitle(""); setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Bell className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          {p({ ku: "نۆتیفیکەیشنی شەخسی — بۆ یەک کۆد", en: "Personal notification — one customer", ar: "إشعار شخصي — لعميل واحد", zh: "个人通知 — 单个客户" })}
        </h3>

        {!customer ? (
          <div className="relative max-w-sm">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9"
              onFocus={() => setFocused(true)}
              // Delay so a click on a result registers before the list closes.
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              placeholder={p({ ku: "گەڕان بە کۆد/ناو/مۆبایل...", en: "Search code / name / mobile...", ar: "بحث بالرمز/الاسم/الهاتف...", zh: "按编号/姓名/手机搜索..." })} />
            {dropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border bg-popover shadow-lg overflow-hidden">
                {searching ? (
                  <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {p({ ku: "گەڕان...", en: "Searching...", ar: "جارٍ البحث...", zh: "搜索中..." })}
                  </div>
                ) : results && results.data.length > 0 ? (
                  results.data.map((c) => (
                    <button key={c.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setCustomer({ id: c.id, name: c.fullName, code: c.customerCode, mobile: c.mobileNumber }); setFocused(false); }}
                      className="w-full text-start px-3 py-2 hover:bg-muted/60 transition-colors">
                      <span className="text-sm font-semibold">{c.fullName}</span>
                      <span className="text-xs text-muted-foreground font-mono ms-2">{c.customerCode}</span>
                      <span className="text-[11px] text-muted-foreground font-mono ms-2">{c.mobileNumber}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2.5 text-xs text-muted-foreground">
                    {p({ ku: "هیچ موشتەرێک نەدۆزرایەوە بەم گەڕانە", en: "No customers match this search", ar: "لا يوجد عملاء مطابقون", zh: "没有匹配的客户" })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-sm py-1 px-3">{customer.name} · {customer.code}</Badge>
            <Button variant="ghost" size="sm" onClick={() => { setCustomer(null); setSearch(""); }}>✕</Button>
            <a href={waLink(customer.mobile)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition">
              <WhatsAppIcon className="w-3.5 h-3.5" /> {p({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "WhatsApp" })}
            </a>
          </div>
        )}

        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
          placeholder={p({ ku: "ناونیشان", en: "Title", ar: "العنوان", zh: "标题" })} />
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000}
          placeholder={p({ ku: "دەقی پەیام", en: "Message text", ar: "نص الرسالة", zh: "消息内容" })} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={withPush} onCheckedChange={setWithPush} />
            <Label className="text-xs text-muted-foreground">{p({ ku: "پوشیش بنێرە (مۆبایل)", en: "Also send push", ar: "أرسل push أيضًا", zh: "同时发送推送" })}</Label>
          </div>
          <Button
            onClick={() => customer && send.mutate({ customerId: customer.id, title: title.trim(), message: message.trim(), withPush })}
            disabled={!customer || !title.trim() || !message.trim() || send.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Send className="h-4 w-4 me-2" />}
            {p({ ku: "ناردن", en: "Send", ar: "إرسال", zh: "发送" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BroadcastCard({ p }: { p: (v: L) => string }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [withPush, setWithPush] = useState(false);
  const send = trpc.portalCenter.broadcastNotification.useMutation({
    onSuccess: (r) => {
      toast.success(p({ ku: `نێردرا بۆ ${r.sent} موشتەری`, en: `Sent to ${r.sent} customers`, ar: `أُرسل إلى ${r.sent} عميلًا`, zh: `已发送给 ${r.sent} 位客户` }));
      setTitle(""); setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          {p({ ku: "نۆتیفیکەیشنی گشتی — بۆ هەموو موشتەرە چالاکەکان", en: "Broadcast — all active customers", ar: "بث — لجميع العملاء النشطين", zh: "广播 — 所有活跃客户" })}
        </h3>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
          placeholder={p({ ku: "ناونیشان", en: "Title", ar: "العنوان", zh: "标题" })} />
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000}
          placeholder={p({ ku: "دەقی پەیام", en: "Message text", ar: "نص الرسالة", zh: "消息内容" })} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={withPush} onCheckedChange={setWithPush} />
            <Label className="text-xs text-muted-foreground">{p({ ku: "پوشیش بنێرە", en: "Also send push", ar: "أرسل push أيضًا", zh: "同时发送推送" })}</Label>
          </div>
          <Button
            onClick={() => {
              if (!title.trim() || !message.trim()) return;
              if (window.confirm(p({ ku: "دڵنیایت؟ بۆ هەموو موشتەرە چالاکەکان دەنێردرێت.", en: "Sure? This goes to ALL active customers.", ar: "متأكد؟ سيُرسل لجميع العملاء النشطين.", zh: "确定吗？将发送给所有活跃客户。" }))) {
                send.mutate({ title: title.trim(), message: message.trim(), withPush });
              }
            }}
            disabled={!title.trim() || !message.trim() || send.isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Megaphone className="h-4 w-4 me-2" />}
            {p({ ku: "بڵاوکردنەوە", en: "Broadcast", ar: "بث", zh: "广播" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AnnouncementCard({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portalCenter.getAnnouncement.useQuery();
  const [form, setForm] = useState({ enabled: false, type: "info" as "info" | "warning" | "success", ku: "", en: "", ar: "", zh: "" });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded && !isLoading) {
      if (data) setForm({ enabled: !!data.enabled, type: data.type ?? "info", ku: data.ku ?? "", en: data.en ?? "", ar: data.ar ?? "", zh: data.zh ?? "" });
      setLoaded(true);
    }
  }, [data, isLoading, loaded]);
  const save = trpc.portalCenter.setAnnouncement.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "پاشەکەوتکرا", en: "Saved", ar: "حُفظ", zh: "已保存" }));
      utils.portalCenter.getAnnouncement.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            {p({ ku: "بانەری ڕاگەیاندن لە پۆرتاڵ", en: "Portal announcement banner", ar: "لافتة إعلان البوابة", zh: "门户公告横幅" })}
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{form.enabled ? p({ ku: "چالاکە", en: "On", ar: "مفعّل", zh: "开启" }) : p({ ku: "ناچالاکە", en: "Off", ar: "معطّل", zh: "关闭" })}</Label>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
        </div>
        <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
          <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="info">🔵 {p({ ku: "زانیاری", en: "Info", ar: "معلومة", zh: "信息" })}</SelectItem>
            <SelectItem value="warning">🟡 {p({ ku: "ئاگاداری", en: "Warning", ar: "تحذير", zh: "警告" })}</SelectItem>
            <SelectItem value="success">🟢 {p({ ku: "مژدە", en: "Good news", ar: "بشرى", zh: "好消息" })}</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Textarea rows={2} dir="rtl" value={form.ku} onChange={(e) => setForm({ ...form, ku: e.target.value })} placeholder="کوردی" />
          <Textarea rows={2} value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} placeholder="English" />
          <Textarea rows={2} dir="rtl" value={form.ar} onChange={(e) => setForm({ ...form, ar: e.target.value })} placeholder="عربي" />
          <Textarea rows={2} value={form.zh} onChange={(e) => setForm({ ...form, zh: e.target.value })} placeholder="中文" />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="bg-sky-600 hover:bg-sky-700 text-white">
            {save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            {p({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Prices tab — the 3 portal shipping prices (same backend as Quick update)
// ---------------------------------------------------------------------------
function PricesTab({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portalPriceList.getQuickPrices.useQuery();
  const [form, setForm] = useState({ air_regular: "", air_irregular: "", sea: "" });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (data && !touched) {
      setForm({ air_regular: data.air_regular ?? "", air_irregular: data.air_irregular ?? "", sea: data.sea ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const save = trpc.portalPriceList.quickUpdatePrices.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "نرخەکان نوێکرانەوە", en: "Prices updated", ar: "حُدّثت الأسعار", zh: "价格已更新" }));
      utils.portalPriceList.getQuickPrices.invalidate();
      utils.customerPortal.getPriceList.invalidate();
      setTouched(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const fields = [
    { key: "air_regular" as const, icon: Plane, label: p({ ku: "ئاسمانی ئاسایی", en: "Air (regular)", ar: "جوي عادي", zh: "空运（常规）" }), unit: "kg" },
    { key: "air_irregular" as const, icon: Zap, label: p({ ku: "ئاسمانی نائاسایی", en: "Air (irregular)", ar: "جوي غير عادي", zh: "空运（非常规）" }), unit: "kg" },
    { key: "sea" as const, icon: Ship, label: p({ ku: "دەریایی", en: "Sea", ar: "بحري", zh: "海运" }), unit: "m³" },
  ];

  return (
    <div className="space-y-4">
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            {p({ ku: "نرخەکانی گواستنەوە لە پۆرتاڵ", en: "Portal shipping prices", ar: "أسعار الشحن في البوابة", zh: "门户运费价格" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {p({ ku: "نرخەکان لێرە بگۆڕە — دەستبەجێ لە پۆرتاڵی موشتەری نوێ دەبنەوە.", en: "Change prices here — they update on the customer portal immediately.", ar: "غيّر الأسعار هنا — تُحدَّث في بوابة العميل فورًا.", zh: "在此更改价格——将立即在客户门户中更新。" })}
          </p>
        </div>
        {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5"><f.icon className="h-3.5 w-3.5" /> {f.label}</Label>
                  <div className="relative">
                    <DollarSign className="absolute start-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input type="number" step="0.01" min="0" inputMode="decimal" value={form[f.key]}
                      onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setTouched(true); }}
                      className="ps-7 pe-10 font-mono font-bold text-lg" placeholder="0.00" />
                    <span className="absolute end-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">/ {f.unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save.mutate(form)} disabled={save.isPending || !touched} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                {p({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    <CalcSettingsCard p={p} />
    </div>
  );
}

// Calculator ratios card — the tunables behind the portal price calculator:
// volumetric divisor, air minimum kg, sea CBM threshold, and the surcharge %
// applied below that threshold.
function CalcSettingsCard({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portalPriceList.getCalcSettings.useQuery();
  const [form, setForm] = useState({ volumetricDivisor: "", airMinKg: "", seaMinCbm: "", seaSurchargePct: "" });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (data && !touched) {
      setForm({
        volumetricDivisor: String(data.volumetricDivisor),
        airMinKg: String(data.airMinKg),
        seaMinCbm: String(data.seaMinCbm),
        seaSurchargePct: String(data.seaSurchargePct),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = trpc.portalPriceList.updateCalcSettings.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "ڕێکخستنەکان پاشەکەوت کران", en: "Settings saved", ar: "حُفظت الإعدادات", zh: "设置已保存" }));
      utils.portalPriceList.getCalcSettings.invalidate();
      utils.customerPortal.getPriceList.invalidate();
      setTouched(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const nums = {
      volumetricDivisor: parseFloat(form.volumetricDivisor),
      airMinKg: parseFloat(form.airMinKg),
      seaMinCbm: parseFloat(form.seaMinCbm),
      seaSurchargePct: parseFloat(form.seaSurchargePct),
    };
    if (Object.values(nums).some((n) => isNaN(n) || n < 0) || nums.volumetricDivisor <= 0 || nums.airMinKg <= 0 || nums.seaMinCbm <= 0) {
      toast.error(p({ ku: "ژمارە دروستەکان بنووسە", en: "Enter valid numbers", ar: "أدخل أرقامًا صحيحة", zh: "请输入有效数字" }));
      return;
    }
    save.mutate(nums);
  };

  const fields: { key: keyof typeof form; label: L; hint: L }[] = [
    { key: "volumetricDivisor", label: { ku: "دابەشکەری قەبارەیی (ئاسمانی)", en: "Volumetric divisor (air)", ar: "قاسم الوزن الحجمي (جوي)", zh: "体积重除数（空运）" }, hint: { ku: "درێژی×پانی×بەرزی ÷ ئەم ژمارە = کیلۆی قەبارەیی", en: "L×W×H ÷ this = volumetric kg", ar: "الطول×العرض×الارتفاع ÷ هذا = كغ حجمي", zh: "长×宽×高 ÷ 此值 = 体积重" } },
    { key: "airMinKg", label: { ku: "کەمترین کیلۆ (ئاسمانی)", en: "Minimum kg (air)", ar: "الحد الأدنى كغ (جوي)", zh: "最低公斤（空运）" }, hint: { ku: "کەمتر لەمە وەک ئەمە حیساب دەکرێت", en: "Anything below is charged as this", ar: "ما دون ذلك يُحتسب بهذا", zh: "低于此值按此值计费" } },
    { key: "seaMinCbm", label: { ku: "سنووری m³ (دەریایی)", en: "CBM threshold (sea)", ar: "حد m³ (بحري)", zh: "立方米阈值（海运）" }, hint: { ku: "کەمتر لەمە ڕێژەی زیادە دەگرێت", en: "Below this the surcharge applies", ar: "دون هذا تُطبَّق الزيادة", zh: "低于此值加收附加费" } },
    { key: "seaSurchargePct", label: { ku: "ڕێژەی زیادە ٪ (دەریایی)", en: "Surcharge % (sea)", ar: "نسبة الزيادة ٪ (بحري)", zh: "附加费 %（海运）" }, hint: { ku: "٠ = ناچالاک", en: "0 = disabled", ar: "0 = معطّل", zh: "0 = 关闭" } },
  ];

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            {p({ ku: "ڕێکخستنی حیسابکەری نرخ", en: "Price calculator settings", ar: "إعدادات حاسبة السعر", zh: "价格计算器设置" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {p({ ku: "ئەم ڕێژانە لە حیسابکەری ناو پۆرتاڵی موشتەری بەکاردێن — دەستبەجێ نوێ دەبنەوە.", en: "These ratios drive the customer-portal calculator — they update immediately.", ar: "تُستخدم هذه النسب في حاسبة بوابة العميل — تُحدَّث فورًا.", zh: "这些比率用于客户门户计算器——立即生效。" })}
          </p>
        </div>
        {isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs font-semibold">{p(f.label)}</Label>
                  <Input
                    type="number" inputMode="decimal" min="0" step="any"
                    value={form[f.key]}
                    onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setTouched(true); }}
                    className="font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">{p(f.hint)}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={save.isPending || !touched} className="bg-purple-600 hover:bg-purple-700 text-white">
                {save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
                {p({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-customer timeline dialog
// ---------------------------------------------------------------------------
// Admin security & access controls for one customer. Passwords are one-way
// hashed and can't be read back — control works by RESETTING to a new value
// the admin sets and sees here (copy / WhatsApp to the customer).

function genPassword(): string {
  // Readable, no ambiguous chars (0/O, 1/l), always mixes letters + digits.
  const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pool = letters + digits;
  let out = "";
  for (let i = 0; i < 8; i++) out += pool[Math.floor(Math.random() * pool.length)];
  // Guarantee at least one digit for a decent strength.
  return out.slice(0, 7) + digits[Math.floor(Math.random() * digits.length)];
}

/**
 * "This customer says they cannot sign in."
 *
 * The portal login refuses in four ways and two of them print the same
 * sentence — "wrong phone number or password" covers both "no account with
 * that number" and "that password does not match". So staff reset the
 * password, the customer still cannot get in, staff reset it again, and
 * nobody learns anything.
 *
 * This walks the same path the login walks, with the number typed the way the
 * customer types it, and says which step fails.
 */
function LoginDiagnostic({ p, defaultMobile }: { p: (v: L) => string; defaultMobile: string }) {
  const [phone, setPhone] = useState(defaultMobile);
  const [pw, setPw] = useState("");
  const diagnose = trpc.portalCenter.diagnoseCustomerLogin.useMutation();

  // The stored number is the sensible starting point, but staff need to be
  // able to type what the customer actually typed.
  useEffect(() => { setPhone(defaultMobile); }, [defaultMobile]);

  const r = diagnose.data;
  const tone =
    r?.step === "ok" ? "text-emerald-600 dark:text-emerald-400"
      : r?.step === "reaches_password" ? "text-sky-600 dark:text-sky-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed p-2.5">
      <div className="text-[11px] font-semibold text-muted-foreground">
        {p({
          ku: "ناتوانێت بچێتە ژوورەوە؟ بیپشکنە",
          en: "Can't sign in? Check why",
          ar: "لا يستطيع الدخول؟ افحص السبب",
          zh: "无法登录？检查原因",
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-9 text-sm flex-1"
          dir="ltr"
          placeholder="07XX XXX XXXX"
        />
        <Input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="h-9 text-sm flex-1"
          dir="ltr"
          placeholder={p({ ku: "وشەی نهێنی (ئارەزوومەندانە)", en: "Password (optional)", ar: "كلمة المرور (اختياري)", zh: "密码（选填）" })}
        />
        <Button
          size="sm"
          className="h-9 px-2 shrink-0"
          disabled={phone.trim().length < 7 || diagnose.isPending}
          onClick={() => diagnose.mutate({
            mobileNumber: phone.trim(),
            // Empty means "do not test a password" rather than "test the
            // empty password".
            password: pw ? pw : undefined,
          })}
        >
          {diagnose.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {r && (
        <div className="space-y-1 pt-0.5">
          <p className={cn("text-[11px] font-semibold leading-snug", tone)}>{r.message}</p>
          {"found" in r && r.found && (
            <p className="text-[10px] text-muted-foreground leading-snug">
              {r.found.customerCode} · {r.found.fullName}
              {r.found.storedDiffersFromTyped && (
                <>
                  {" — "}
                  {p({
                    ku: "لە سیستەمدا بەم شێوەیە خەزنکراوە",
                    en: "stored in the system as",
                    ar: "مخزّن في النظام هكذا",
                    zh: "系统中存储为",
                  })}{" "}
                  <span dir="ltr" className="font-mono">{r.found.storedNumber}</span>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CustomerSecurityCard({ p, customerId }: { p: (v: L) => string; customerId: number }) {
  const utils = trpc.useUtils();
  const { data: sec, isLoading } = trpc.portalCenter.getCustomerSecurity.useQuery({ customerId });

  // Pre-filled, so the common case is one tap on Save.
  const [newPw, setNewPw] = useState(DEFAULT_RESET_PASSWORD);
  const [showPw, setShowPw] = useState(true);
  const [copied, setCopied] = useState(false);
  const [mobile, setMobile] = useState("");
  const [editingMobile, setEditingMobile] = useState(false);

  const resetPw = trpc.portalCenter.resetCustomerPassword.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "وشەی نهێنی نوێ دانرا", en: "New password set", ar: "تم تعيين كلمة مرور جديدة", zh: "已设置新密码" }));
      utils.portalCenter.getCustomerSecurity.invalidate({ customerId });
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMobile = trpc.portalCenter.updateCustomerMobile.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "ژمارە نوێکرایەوە", en: "Mobile updated", ar: "تم تحديث الرقم", zh: "手机号已更新" }));
      setEditingMobile(false);
      utils.portalCenter.getCustomerSecurity.invalidate({ customerId });
    },
    onError: (e) => toast.error(e.message),
  });
  const setActive = trpc.portalCenter.setCustomerActive.useMutation({
    onSuccess: () => {
      utils.portalCenter.getCustomerSecurity.invalidate({ customerId });
    },
    onError: (e) => toast.error(e.message),
  });

  const copyPw = () => {
    if (!newPw) return;
    navigator.clipboard?.writeText(newPw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const waSend = () => {
    if (!newPw || !sec?.mobileNumber) return;
    const msg = p({
      ku: `سڵاو ${sec.fullName}، وشەی نهێنی نوێی هەژمارەکەت: ${newPw}`,
      en: `Hello ${sec.fullName}, your new account password: ${newPw}`,
      ar: `مرحبا ${sec.fullName}، كلمة مرور حسابك الجديدة: ${newPw}`,
      zh: `你好 ${sec.fullName}，你的新账户密码：${newPw}`,
    });
    const num = sec.mobileNumber.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (!sec) return null;

  return (
    <div className="rounded-2xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          {p({ ku: "پاراستن و دەستگەیشتن", en: "Security & access", ar: "الأمان والوصول", zh: "安全与访问" })}
        </div>
        <Badge className={cn("text-[9px] border-0", sec.isActive ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300")}>
          {sec.isActive
            ? p({ ku: "چالاک", en: "Active", ar: "نشط", zh: "启用" })
            : p({ ku: "ناچالاک", en: "Disabled", ar: "معطل", zh: "停用" })}
        </Badge>
      </div>

      {/* Reset password */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {p({ ku: "دانانی وشەی نهێنی نوێ", en: "Set a new password", ar: "تعيين كلمة مرور جديدة", zh: "设置新密码" })}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Input
              type={showPw ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="••••••••"
              className="h-9 text-sm pe-9 font-mono"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
              className="absolute top-1/2 -translate-y-1/2 end-2 text-muted-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button size="sm" variant="outline" className="h-9 px-2 shrink-0"
            title={p({ ku: "دروستکردنی خۆکار", en: "Generate", ar: "توليد", zh: "生成" })}
            onClick={() => { setNewPw(genPassword()); setShowPw(true); }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-9 px-2 shrink-0" disabled={!newPw}
            title={p({ ku: "کۆپی", en: "Copy", ar: "نسخ", zh: "复制" })} onClick={copyPw}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-9 flex-1 gap-1.5" disabled={newPw.length < 6 || resetPw.isPending}
            onClick={() => resetPw.mutate({ customerId, newPassword: newPw })}>
            {resetPw.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            {p({ ku: "پاشەکەوتکردن", en: "Save", ar: "حفظ", zh: "保存" })}
          </Button>
          <Button size="sm" variant="outline" className="h-9 gap-1.5 shrink-0"
            disabled={!newPw || !sec.mobileNumber} onClick={waSend}>
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            {p({ ku: "واتساپ", en: "WhatsApp", ar: "واتساب", zh: "微信" })}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {p({
            ku: "وشە نهێنییەکان بە شێوەی پارێزراو (hash) هەڵدەگیرێن و ناخوێنرێنەوە. کۆنترۆڵ بەمەیە: وشەیەکی نوێ دابنێ و بۆ کڕیار بینێرە.",
            en: "Passwords are stored hashed and can't be read back. Control is via setting a new one and sending it to the customer.",
            ar: "كلمات المرور مخزّنة مشفّرة ولا يمكن قراءتها. التحكم يكون بتعيين كلمة جديدة وإرسالها للعميل.",
            zh: "密码经哈希存储，无法读取。通过设置新密码并发送给客户来控制。",
          })}
        </p>
      </div>

      {/* Why can't they sign in? */}
      <LoginDiagnostic p={p} defaultMobile={sec?.mobileNumber ?? ""} />

      {/* Login mobile */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {p({ ku: "ژمارەی چوونەژوورەوە", en: "Login mobile", ar: "رقم الدخول", zh: "登录手机号" })}
        </div>
        {editingMobile ? (
          <div className="flex items-center gap-1.5">
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-9 text-sm flex-1" dir="ltr" placeholder="07XXXXXXXXX" />
            <Button size="sm" className="h-9 px-2 shrink-0" disabled={mobile.length < 7 || updateMobile.isPending}
              onClick={() => updateMobile.mutate({ customerId, mobileNumber: mobile.trim() })}>
              {updateMobile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-9 px-2 shrink-0" onClick={() => setEditingMobile(false)}>✕</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-sm flex-1" dir="ltr">{sec.mobileNumber}</span>
            <Button size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => { setMobile(sec.mobileNumber); setEditingMobile(true); }}>
              {p({ ku: "گۆڕین", en: "Change", ar: "تغيير", zh: "更改" })}
            </Button>
          </div>
        )}
      </div>

      {/* Last sign-in + enable/disable */}
      <div className="flex items-center justify-between pt-1 border-t border-cyan-200/60 dark:border-cyan-900/40">
        <div className="text-[10px] text-muted-foreground">
          {p({ ku: "دواین چوونەژوورەوە", en: "Last sign-in", ar: "آخر دخول", zh: "上次登录" })}: {fmtDateTime(sec.lastSignedIn)}
        </div>
        <div className="flex items-center gap-1.5">
          <Power className={cn("h-3.5 w-3.5", sec.isActive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")} />
          <Switch checked={sec.isActive} disabled={setActive.isPending}
            onCheckedChange={(v) => setActive.mutate({ customerId, isActive: v })} />
        </div>
      </div>
    </div>
  );
}

function CustomerTimelineDialog({ p, customer, onClose }: {
  p: (v: L) => string;
  customer: { id: number; name: string; code: string };
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.portalCenter.getCustomerTimeline.useQuery({ customerId: customer.id });
  const utils = trpc.useUtils();
  const { data: notes } = trpc.portalCenter.listNotes.useQuery({ customerId: customer.id });
  const [note, setNote] = useState("");
  const addNote = trpc.portalCenter.addNote.useMutation({
    onSuccess: () => {
      setNote("");
      utils.portalCenter.listNotes.invalidate();
      toast.success(p({ ku: "تێبینی زیادکرا", en: "Note added", ar: "أُضيفت الملاحظة", zh: "已添加备注" }));
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            {customer.name}
            <span className="text-xs font-mono text-muted-foreground">{customer.code}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Internal staff notes — never visible to the customer */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
            <StickyNote className="h-3.5 w-3.5" />
            {p({ ku: "تێبینی ناوخۆیی (تەنها ستاف دەیبینێت)", en: "Internal notes (staff only)", ar: "ملاحظات داخلية (للموظفين فقط)", zh: "内部备注（仅员工可见）" })}
          </div>
          {notes && notes.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {notes.map((n: any) => (
                <div key={n.id} className="text-xs bg-white/70 dark:bg-black/20 rounded-lg px-2.5 py-1.5">
                  <p className="break-words">{n.note}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{n.createdByName || "—"} · {fmtDateTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} maxLength={2000}
              placeholder={p({ ku: "تێبینی نوێ...", en: "New note...", ar: "ملاحظة جديدة...", zh: "新备注..." })}
              className="flex-1 resize-none text-xs min-h-[34px]" />
            <Button size="sm" variant="outline"
              onClick={() => note.trim() && addNote.mutate({ customerId: customer.id, note: note.trim() })}
              disabled={!note.trim() || addNote.isPending}>
              {addNote.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StickyNote className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Security & access — reset password, change login mobile, enable/disable */}
        <CustomerSecurityCard p={p} customerId={customer.id} />

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

// ---------------------------------------------------------------------------
// Ratings tab — delivery ratings left by customers, newest first.
// ---------------------------------------------------------------------------
function RatingsTab({ p }: { p: (v: L) => string }) {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = trpc.portalCenter.listDeliveryRatings.useQuery({ page, pageSize });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        {data?.average != null && (
          <div className="mb-3 flex items-center gap-2">
            <div className="flex items-center gap-1" dir="ltr">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn(
                  "h-5 w-5",
                  data.average! >= n - 0.5 ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                )} />
              ))}
            </div>
            <span className="text-lg font-black tabular-nums">{data.average.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              ({data.total} {p({ ku: "هەڵسەنگاندن", en: "ratings", ar: "تقييم", zh: "条评价" })})
            </span>
          </div>
        )}

        {isLoading ? <TableSkeleton /> : !data || data.data.length === 0 ? (
          <EmptyRow text={p({ ku: "هێشتا هەڵسەنگاندن نییە", en: "No ratings yet", ar: "لا توجد تقييمات بعد", zh: "暂无评价" })} />
        ) : (
          <>
            <div className="space-y-2">
              {data.data.map((r: any) => (
                <div key={r.id} className="rounded-xl border p-3 dark:border-white/10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-0.5" dir="ltr">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={cn(
                          "h-4 w-4",
                          r.rating >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                        )} />
                      ))}
                    </div>
                    <span className="text-sm font-semibold">{r.customerName || "—"}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{r.customerCode}</span>
                    {r.trackingNumber && (
                      <span className="text-[11px] text-muted-foreground font-mono">· {r.trackingNumber}</span>
                    )}
                    <span className="ms-auto text-[11px] text-muted-foreground">{fmtDateTime(r.createdAt)}</span>
                  </div>
                  {r.comment && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
            <Pager page={page} pageSize={pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Yuan tab — sell rate settings + customer buy-CNY orders management.
// ---------------------------------------------------------------------------
const YUAN_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  processing: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const YUAN_STATUS_LABEL: Record<string, L> = {
  pending: { ku: "چاوەڕوانە", en: "Pending", ar: "قيد الانتظار", zh: "待处理" },
  processing: { ku: "جێبەجێدەکرێت", en: "Processing", ar: "قيد التنفيذ", zh: "处理中" },
  completed: { ku: "تەواوبوو", en: "Completed", ar: "مكتمل", zh: "已完成" },
  cancelled: { ku: "هەڵوەشایەوە", en: "Cancelled", ar: "ملغى", zh: "已取消" },
};

function YuanTab({ p }: { p: (v: L) => string }) {
  return (
    <div className="space-y-4">
      <YuanSettingsCard p={p} />
      <YuanOrdersCard p={p} />
    </div>
  );
}

function YuanSettingsCard({ p }: { p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.portalCenter.getYuanSettings.useQuery();
  const [form, setForm] = useState({
    enabled: true, rate: "6.4", minUsd: "", maxUsd: "",
    noteKu: "", noteEn: "", noteAr: "", noteZh: "",
  });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!loaded && !isLoading && data) {
      setForm({
        enabled: data.enabled,
        rate: String(data.rate),
        minUsd: data.minUsd != null ? String(data.minUsd) : "",
        maxUsd: data.maxUsd != null ? String(data.maxUsd) : "",
        noteKu: data.noteKu, noteEn: data.noteEn, noteAr: data.noteAr, noteZh: data.noteZh,
      });
      setLoaded(true);
    }
  }, [data, isLoading, loaded]);

  const save = trpc.portalCenter.setYuanSettings.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "پاشەکەوتکرا", en: "Saved", ar: "حُفظ", zh: "已保存" }));
      utils.portalCenter.getYuanSettings.invalidate();
      utils.customerPortal.getYuanExchangeInfo.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    const rate = parseFloat(form.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error(p({ ku: "نرخێکی دروست بنووسە", en: "Enter a valid rate", ar: "أدخل سعراً صحيحاً", zh: "请输入有效汇率" }));
      return;
    }
    const minUsd = parseFloat(form.minUsd);
    const maxUsd = parseFloat(form.maxUsd);
    save.mutate({
      enabled: form.enabled,
      rate,
      minUsd: Number.isFinite(minUsd) && minUsd > 0 ? minUsd : null,
      maxUsd: Number.isFinite(maxUsd) && maxUsd > 0 ? maxUsd : null,
      noteKu: form.noteKu, noteEn: form.noteEn, noteAr: form.noteAr, noteZh: form.noteZh,
    });
  };

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <span className="text-red-500 dark:text-red-400 font-black">¥</span>
            {p({ ku: "ڕێکخستنی فرۆشتنی یوان", en: "Yuan sell settings", ar: "إعدادات بيع اليوان", zh: "人民币出售设置" })}
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">
              {form.enabled ? p({ ku: "چالاکە", en: "On", ar: "مفعّل", zh: "开启" }) : p({ ku: "ناچالاکە", en: "Off", ar: "معطّل", zh: "关闭" })}
            </Label>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{p({ ku: "نرخی فرۆشتن (١ دۆلار = چەند یوان)", en: "Sell rate (CNY per 1 USD)", ar: "سعر البيع (يوان لكل دولار)", zh: "出售价（1美元兑人民币）" })}</Label>
            <Input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="font-mono font-bold" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{p({ ku: "کەمترین بڕ ($) — بەتاڵ = بێ سنوور", en: "Min amount ($) — empty = none", ar: "الحد الأدنى ($) — فارغ = بلا حد", zh: "最低金额（$）——留空为不限" })}</Label>
            <Input type="number" min="0" step="1" value={form.minUsd} onChange={(e) => setForm({ ...form, minUsd: e.target.value })} className="font-mono" dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{p({ ku: "زۆرترین بڕ ($) — بەتاڵ = بێ سنوور", en: "Max amount ($) — empty = none", ar: "الحد الأقصى ($) — فارغ = بلا حد", zh: "最高金额（$）——留空为不限" })}</Label>
            <Input type="number" min="0" step="1" value={form.maxUsd} onChange={(e) => setForm({ ...form, maxUsd: e.target.value })} className="font-mono" dir="ltr" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">{p({ ku: "تێبینی بۆ کڕیار (ئیختیاری)", en: "Note shown to customers (optional)", ar: "ملاحظة تظهر للعملاء (اختياري)", zh: "向客户显示的备注（可选）" })}</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Textarea rows={2} dir="rtl" value={form.noteKu} onChange={(e) => setForm({ ...form, noteKu: e.target.value })} placeholder="کوردی" />
            <Textarea rows={2} value={form.noteEn} onChange={(e) => setForm({ ...form, noteEn: e.target.value })} placeholder="English" />
            <Textarea rows={2} dir="rtl" value={form.noteAr} onChange={(e) => setForm({ ...form, noteAr: e.target.value })} placeholder="عربي" />
            <Textarea rows={2} value={form.noteZh} onChange={(e) => setForm({ ...form, noteZh: e.target.value })} placeholder="中文" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">
            1$ = {form.rate || "?"}¥ · $100 → ¥{(() => { const r = parseFloat(form.rate); return Number.isFinite(r) ? (100 * r).toFixed(0) : "?"; })()}
          </p>
          <Button onClick={submit} disabled={save.isPending} className="bg-red-600 hover:bg-red-700 text-white">
            {save.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}
            {p({ ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function YuanOrdersCard({ p }: { p: (v: L) => string }) {
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading } = trpc.portalCenter.listYuanOrders.useQuery({
    status: status === "all" ? undefined : (status as any),
    limit: 100,
  });

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold">
            {p({ ku: "داواکارییەکانی کڕینی یوان", en: "Yuan buy orders", ar: "طلبات شراء اليوان", zh: "人民币购买订单" })}
          </h3>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{p({ ku: "هەموو", en: "All", ar: "الكل", zh: "全部" })}</SelectItem>
              {Object.keys(YUAN_STATUS_LABEL).map((s) => (
                <SelectItem key={s} value={s}>{p(YUAN_STATUS_LABEL[s])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? <TableSkeleton /> : !data || data.length === 0 ? (
          <EmptyRow text={p({ ku: "هیچ داواکارییەک نییە", en: "No orders", ar: "لا توجد طلبات", zh: "暂无订单" })} />
        ) : (
          <div className="space-y-2">
            {data.map((row: any) => (
              <YuanOrderRow key={row.order.id} row={row} p={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YuanOrderRow({ row, p }: { row: any; p: (v: L) => string }) {
  const utils = trpc.useUtils();
  const o = row.order;
  const [status, setStatus] = useState<string>(o.status);
  const [adminNote, setAdminNote] = useState<string>(o.adminNote ?? "");
  const dirty = status !== o.status || (adminNote.trim() || "") !== (o.adminNote ?? "");

  const update = trpc.portalCenter.updateYuanOrderStatus.useMutation({
    onSuccess: () => {
      toast.success(p({ ku: "نوێکرایەوە و کڕیار ئاگادارکرایەوە", en: "Updated — customer notified", ar: "تم التحديث وإشعار العميل", zh: "已更新并通知客户" }));
      utils.portalCenter.listYuanOrders.invalidate();
      utils.portalCenter.countPendingYuanOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border p-3 dark:border-white/10 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">{row.customerName || "—"}</span>
        <span className="text-[11px] text-muted-foreground font-mono">{row.customerCode}</span>
        {row.customerMobile && (
          <a
            href={waLink(row.customerMobile)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 hover:text-emerald-700"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
            {row.customerMobile}
          </a>
        )}
        <Badge className={cn("border-0", YUAN_STATUS_COLORS[o.status] ?? YUAN_STATUS_COLORS.pending)}>
          {p(YUAN_STATUS_LABEL[o.status] ?? YUAN_STATUS_LABEL.pending)}
        </Badge>
        <span className="ms-auto text-[11px] text-muted-foreground">{fmtDateTime(o.createdAt)}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-black tabular-nums text-base" dir="ltr">
          ${Number(o.usdAmount).toLocaleString()} → ¥{Number(o.cnyAmount).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">1$ = {Number(o.rate)}¥</span>
      </div>

      {o.customerNote && (
        <p className="text-xs text-muted-foreground">
          💬 {o.customerNote}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.keys(YUAN_STATUS_LABEL).map((s) => (
              <SelectItem key={s} value={s}>{p(YUAN_STATUS_LABEL[s])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder={p({ ku: "تێبینی بۆ کڕیار...", en: "Note to customer...", ar: "ملاحظة للعميل...", zh: "给客户的备注..." })}
          className="h-8 text-xs flex-1 min-w-[180px]"
        />
        <Button
          size="sm"
          className="h-8"
          disabled={!dirty || update.isPending}
          onClick={() => update.mutate({ id: o.id, status: status as any, adminNote: adminNote.trim() || undefined })}
        >
          {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p({ ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" })}
        </Button>
      </div>
    </div>
  );
}
