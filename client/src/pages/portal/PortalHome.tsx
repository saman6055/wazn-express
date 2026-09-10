import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { PORTAL_LIVE_QUERY, PORTAL_SETTINGS_QUERY } from "@/lib/portalQuery";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  Package, PackageCheck, Bell, ChevronRight, Truck, CheckCircle, Clock, Calculator,
  AlertCircle, Plane, Ship, Megaphone, Search, Plus,
  MessageCircle, AlertTriangle, BookOpen, Coins, User,
} from "lucide-react";
import { pickLang } from "@/lib/lang";
import { mostRelevantShipment } from "@shared/nextStep";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useState, useEffect } from "react";
import { WaznNewsCarousel } from "@/components/portal/WaznNewsCarousel";
import { DeliveryRatingCard } from "@/components/portal/DeliveryRatingCard";
import { GreetingCard } from "@/components/portal/GreetingCard";
import { MyShareLinks } from "@/components/portal/MyShareLinks";
import { ReferralCard } from "@/components/portal/ReferralCard";
import { MyDeliveryBoxes } from "@/components/portal/MyDeliveryBoxes";
import { PortalClock, PortalLanguagePicker } from "@/components/portal/PortalHeaderControls";
import { formatPortalDate } from "@/lib/portalClock";
import { ChinaDepotList, useChinaDepotItems } from "@/components/portal/ChinaDepotList";
import { isDebt, isCredit } from "@/lib/portalMoney";
import { onImageError } from "@/lib/imageFallback";
import { BRAND_LOGO_ON_DARK_URL, BRAND_LOGO_URL } from "@/lib/brand";
import { PortalWelcomeCard } from "@/components/portal/PortalWelcomeCard";
import { stageOf, isInIraqNotDelivered, STATUS_LABEL, type BatchStatus } from "@/lib/shipmentFilters";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { PortalChip } from "@/components/portal/PortalStatusChip";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { batchStatusTone } from "@/lib/shipmentFilters";
import { fmtCount, fmtNumber, fmtUsd } from "@/lib/portalFormat";

// Animated Counter Component
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      setCount(Math.floor(progress * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <>{count}</>;
}

// Announcements Section Component
function AnnouncementsSection({ isDark, language, t }: { isDark: boolean; language: string; t: (key: string, params?: Record<string, string | number>) => string }) {
  const company = useCompanyInfo();
  const { data: blogPosts, isLoading } = trpc.blog.featured.useQuery();

  if (isLoading) {
    return (
      <div className="px-4 mt-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-700 dark:text-slate-300")} />
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
            {t("portal.announcements") || "ڕاگەیاندنەکان"}
          </h2>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  // If no blog posts, show default welcome message
  if (!blogPosts || blogPosts.length === 0) {
    return (
      <div className="px-4 mt-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-700 dark:text-slate-300")} />
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
            {t("portal.announcements") || "ڕاگەیاندنەکان"}
          </h2>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                {t("new") || "New"}
              </span>
            </div>
            <p className="font-bold text-lg mb-2">{t("welcomeToWazn", { name: company?.name || "Wazn Express" })}</p>
            <p className="text-sm text-blue-100 leading-relaxed">
              {t("trackPackagesEasily") || "Track your packages easily through this portal. Get real-time updates on your shipments."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Featured posts → the Wazn News auto-rotating carousel (5 slides, 5s each).
  return <WaznNewsCarousel language={language} isDark={isDark} />;
}

/**
 * The one line a customer opens the portal for — and, when a shipment is
 * ready in the Erbil depot, the pulsing green collect-me banner.
 *
 * One component on purpose: "what happens next" and "your goods are ready"
 * are the same question at different stages, and two separate banners had
 * them repeating each other.
 */
function NextStepCard({
  batches, isDark, language, loading,
}: { batches: any[]; isDark: boolean; language: string; loading: boolean }) {
  const best = mostRelevantShipment(batches ?? []);
  if (loading || !best) return null;

  const { shipment, step } = best;
  const L = (k: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, k);

  const HEADLINE: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
    leaving_china: { ku: "لە کۆگای چین، چاوەڕوانی ناردن", en: "In the China warehouse, waiting to ship", ar: "في مستودع الصين بانتظار الشحن", zh: "在中国仓库，等待发运" },
    arriving_iraq: { ku: "لە ڕێگادایە بۆ عێراق", en: "On its way to Iraq", ar: "في طريقها إلى العراق", zh: "正在运往伊拉克" },
    clearing_customs: { ku: "گەیشتووەتە عێراق، لە گومرگدایە", en: "In Iraq, clearing customs", ar: "وصلت العراق، في الجمارك", zh: "已抵达伊拉克，清关中" },
    reaching_depot: { ku: "لە گومرگ دەرچووە، بەرەو کۆگای هەولێر", en: "Through customs, heading to the Erbil depot", ar: "خرجت من الجمارك، في طريقها إلى مستودع أربيل", zh: "已清关，正运往埃尔比勒仓库" },
    ready_to_collect: { ku: "بارت ئامادەیە بۆ وەرگرتن — کۆگای هەولێر", en: "Ready to collect — Erbil depot", ar: "شحنتك جاهزة للاستلام — مستودع أربيل", zh: "可领取——埃尔比勒仓库" },
    done: { ku: "", en: "", ar: "", zh: "" },
  };

  const ready = step.key === "ready_to_collect";
  /**
   * The portal's own date formatter, not a named month.
   *
   * This spelled the month out through the Arabic locale for Kurdish
   * readers — the exact thing lib/portalClock was written to stop, because
   * the Kurdish month names are the Levantine Arabic set and plenty of
   * customers cannot say which month تەممووز is without stopping to think.
   */
  const date = step.expectedAt ? formatPortalDate(step.expectedAt, language) : null;

  return (
    <div className="px-4 mt-3">
      <div className={cn(
        "rounded-2xl p-4 flex items-start gap-3.5 border",
        ready
          ? isDark ? "bg-emerald-950/50 border-emerald-500/50" : "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-500/50"
          : isDark ? "bg-[#152238] border-white/10" : "bg-white dark:bg-[#152238] border-slate-200 dark:border-slate-700 shadow-sm",
      )}>
        {/* The pulsing dot is the "come and collect" signal; before that,
            a plain truck. Green is reserved for goods actually arrived. */}
        {ready ? (
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center">
            <span className="relative flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
            </span>
          </span>
        ) : (
          <div className={cn("w-11 h-11 shrink-0 rounded-xl flex items-center justify-center", isDark ? "bg-[#2563EB]" : "bg-blue-500 dark:bg-[#2563EB]")}>
            <Truck className="w-5 h-5 text-white" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-medium uppercase tracking-wide",
                           ready
                             ? isDark ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400"
                             : isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
            {L({ ku: "دواتر", en: "Next", ar: "التالي", zh: "接下来" })}
          </p>
          <p className={cn("font-semibold leading-snug",
                           ready
                             ? isDark ? "text-emerald-200" : "text-emerald-800 dark:text-emerald-200"
                             : isDark ? "text-white" : "text-slate-800 dark:text-slate-100")}>
            {L(HEADLINE[step.key] ?? HEADLINE.leaving_china!)}
          </p>

          {/* Only ever shown when a date was recorded, and always as an
              estimate — never as a commitment nobody made. */}
          {date && (
            <p className={cn("text-sm mt-0.5",
                             step.overdue
                               ? isDark ? "text-amber-400" : "text-amber-600 dark:text-amber-400"
                               : isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")}>
              {step.overdue
                ? L({ ku: "چاوەڕوان بوو", en: "Was expected", ar: "كان متوقعًا", zh: "原预计" })
                : L({ ku: "چاوەڕوانە", en: "Expected", ar: "متوقع", zh: "预计" })}
              {" "}{date}
            </p>
          )}

          <p className={cn("text-xs mt-1 font-mono", isDark ? "text-slate-500" : "text-slate-400 dark:text-slate-500")} dir="ltr">
            {(shipment as any).batchCode}
          </p>
        </div>

        <Link href={`/portal/shipments/${(shipment as any).id}`}>
          <span className={cn("inline-flex items-center shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg",
                              ready
                                ? "bg-emerald-500 text-white"
                                : isDark ? "bg-slate-700 text-slate-200" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200")}>
            {ready ? <PackageCheck className="w-3.5 h-3.5 me-1" /> : null}
            {L({ ku: "بینین", en: "View", ar: "عرض", zh: "查看" })}
          </span>
        </Link>
      </div>
    </div>
  );
}

/**
 * The redesigned home — one design for every customer, laid out in the order
 * the owner fixed: rates, identity, the register-your-tracking action, money,
 * the three-stage pipeline, what happens next, recent shipments, four tools.
 * Blue is for actions, emerald strictly for success/arrival, amber for debt.
 */
export default function PortalHome() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  const accountQuery = trpc.customerPortal.getMyAccount.useQuery();
  const batchesQuery = trpc.customerPortal.getMyBatches.useQuery(undefined, PORTAL_LIVE_QUERY);
  const summaryQuery = trpc.customerPortal.getMyFinancialSummary.useQuery(undefined, PORTAL_LIVE_QUERY);

  const { data: account, isLoading: accountLoading } = accountQuery;
  const { data: batches, isLoading: batchesLoading } = batchesQuery;
  const { data: notificationCount } = trpc.customerPortal.getNotificationCount.useQuery(undefined, PORTAL_LIVE_QUERY);
  const { data: financialSummary, isLoading: summaryLoading } = summaryQuery;
  const { data: pendingOrders } = trpc.customerPortal.getMyPendingOrders.useQuery(undefined, PORTAL_LIVE_QUERY);
  const { data: prohibitedPackages } = trpc.prohibited.getMine.useQuery(undefined, PORTAL_LIVE_QUERY);
  // The admin-curated price list already carries today's exchange rates; the
  // ticker reads the same row rather than growing a second source of truth.
  const { data: priceList } = trpc.customerPortal.getPriceList.useQuery(undefined, PORTAL_SETTINGS_QUERY);

  // Everything the customer has sitting in the China depot — loose parcels
  // and bought orders, deduplicated by tracking (the shared hook's job).
  const chinaItems = useChinaDepotItems();

  /**
   * One banner rather than several: a dropped connection must say so once at
   * the top, not show $0.00 and four zero counters as though the account
   * were emptied.
   */
  const homeFailed =
    accountQuery.isError || batchesQuery.isError || summaryQuery.isError;
  const homeRetrying =
    accountQuery.isFetching || batchesQuery.isFetching || summaryQuery.isFetching;
  const retryHome = () => {
    void accountQuery.refetch();
    void batchesQuery.refetch();
    void summaryQuery.refetch();
  };
  const prohibitedPending = (prohibitedPackages || []).filter((p: any) => p.status === "pending").length;

  // Grouped with stageOf — the same grouping the shipments page filters by —
  // so no number on this screen can disagree with the list a tap opens.
  const totalBatches = batches?.length || 0;
  const deliveredCount = batches?.filter(b => stageOf(b.status) === "delivered").length || 0;
  // Parcels already boxed into a still-in-China batch are still in China:
  // the depot card counts loose items plus those batches' parcels.
  const chinaBatchParcels = (batches ?? [])
    .filter(b => stageOf(b.status) === "in_china")
    .reduce((sum, b) => sum + (Number((b as any).customerPackageCount) || 0), 0);
  const chinaCount = chinaItems.length + chinaBatchParcels;
  // The middle card is the road itself; the third is Iraq-side but not yet
  // handed over. Same predicates the tap-filter below uses — one rule.
  const onTheWay = (batches ?? []).filter(b => stageOf(b.status) === "in_transit" && !isInIraqNotDelivered(b.status));
  const inIraq = (batches ?? []).filter(b => isInIraqNotDelivered(b.status));

  // The soonest recorded arrival among what is moving. Never invented: no
  // date recorded means no countdown shown.
  const nextEtaDays = (() => {
    const now = Date.now();
    const days = onTheWay
      .map(b => (b as any).estimatedArrival ? new Date((b as any).estimatedArrival as any).getTime() : NaN)
      .filter(tms => Number.isFinite(tms) && tms > now)
      .map(tms => Math.ceil((tms - now) / 86400000));
    return days.length ? Math.min(...days) : null;
  })();

  // Tapping a pipeline card filters the list below in place; tapping it
  // again clears. The screen behaves as one board, not three doors.
  const [pipelineFilter, setPipelineFilter] = useState<null | "in_china" | "on_the_way" | "in_iraq">(null);
  const togglePipeline = (key: "in_china" | "on_the_way" | "in_iraq") =>
    setPipelineFilter(prev => (prev === key ? null : key));

  // The slim fixed bar appears once the full header has scrolled away, so
  // search and the bell stay reachable without the header eating the screen.
  const [pastHeader, setPastHeader] = useState(false);
  useEffect(() => {
    const onScroll = () => setPastHeader(window.scrollY > 150);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Balance info
  const balance = financialSummary?.balanceUsd || 0;
  const hasDebt = isDebt(balance);
  const balanceText = fmtUsd(Math.abs(balance));

  const rmbRate = priceList?.rates?.rmb != null && Number(priceList.rates.rmb) > 0 ? Number(priceList.rates.rmb) : null;
  const iqdRate = priceList?.rates?.iqd != null && Number(priceList.rates.iqd) > 0 ? Number(priceList.rates.iqd) : null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return <CheckCircle className="w-4 h-4" />;
      case "in_transit":
        return <Truck className="w-4 h-4" />;
      case "customs":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // The shared wording, not a second copy of it — see shipmentFilters.ts.
  const getStatusText = (status: string) =>
    STATUS_LABEL[status as BatchStatus]
      ? pickLang(language, STATUS_LABEL[status as BatchStatus]!)
      : status;

  const getShippingIcon = (type: string) => {
    if (type?.includes("sea")) return <Ship className="w-5 h-5" />;
    return <Plane className="w-5 h-5" />;
  };

  // Bold ¥ glyph styled like a lucide icon (lucide has no CNY symbol).
  const YuanIcon = ({ className }: { className?: string }) => (
    <span className={cn("flex items-center justify-center text-xl font-black leading-none", className)}>¥</span>
  );

  /**
   * Four tools, one row — everything else the fifteen-tile grid used to hold
   * now lives behind the bottom tabs (My shipments, Finance, Me) by the
   * owner's placement map. Order is deliberate: the price question first.
   */
  const quickActions = [
    {
      icon: Calculator,
      label: pickLang(language, { ku: "چەندم لەسەر دەبێت؟", en: "What will it cost?", ar: "كم ستكلفني؟", zh: "运费多少？" }),
      href: "/portal/calculator",
    },
    {
      icon: YuanIcon,
      label: pickLang(language, { ku: "کڕینی یوان", en: "Buy Yuan", ar: "شراء اليوان", zh: "购买人民币" }),
      href: "/portal/yuan-exchange",
    },
    {
      icon: AlertTriangle,
      label: pickLang(language, { ku: "بێ خاوەن", en: "Unclaimed", ar: "غير مُطالب به", zh: "无主" }),
      href: "/portal/no-mark",
    },
    {
      icon: BookOpen,
      label: pickLang(language, { ku: "ڕێبەر", en: "Guide", ar: "الدليل", zh: "指南" }),
      href: "/portal/guide",
    },
  ];

  const card = isDark ? "bg-[#152238] border-white/10" : "bg-white dark:bg-[#152238] border-slate-200 dark:border-slate-700";
  const glassPill = isDark
    ? "bg-white/10 border-white/20 text-white"
    : "bg-slate-900/[0.06] border-slate-900/10 text-slate-800 dark:text-slate-200";

  const recentSource =
    pipelineFilter === "on_the_way" ? onTheWay
    : pipelineFilter === "in_iraq" ? inIraq
    : (batches?.slice(0, 3) || []);

  return (
    <CustomerPortalLayout>
      <div className={cn("min-h-screen", isDark ? "bg-[#0B1120]" : "bg-slate-50 dark:bg-slate-950")}>

        {/* Slim fixed bar — code, search, bell — once the header scrolls away */}
        <div className={cn(
          "fixed inset-x-0 top-0 z-40 transition-transform duration-300",
          pastHeader ? "translate-y-0" : "-translate-y-full pointer-events-none",
        )}>
          <div
            className={cn(
              "border-b backdrop-blur-md",
              isDark ? "bg-[#0B1120]/95 border-white/10" : "bg-white/95 dark:bg-[#0B1120]/95 border-slate-200 dark:border-slate-700",
            )}
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
              <Link href="/portal/profile" aria-label={pickLang(language, { ku: "هەژماری من", en: "My account", ar: "حسابي", zh: "我的账户" })}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="relative shrink-0">
                    <span aria-hidden="true" className="wazn-breathe absolute -inset-0.5 rounded-full bg-blue-500 blur-sm" />
                    <span className={cn("relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full", isDark ? "bg-[#1D4ED8]" : "bg-blue-600 dark:bg-[#1D4ED8]")}>
                      {account?.photoUrl ? (
                        <img src={account.photoUrl} alt="" className="h-full w-full object-cover" onError={onImageError} />
                      ) : (
                        <User className="h-4 w-4 text-blue-100" />
                      )}
                    </span>
                  </span>
                  {account?.customerCode && (
                    <span dir="ltr" className={cn("truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums", isDark ? "border-blue-500/40 bg-blue-600/20 text-blue-300" : "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300")}>
                      {account.customerCode}
                    </span>
                  )}
                </span>
              </Link>
              <div className="flex items-center gap-1.5">
                <Link href="/portal/search" aria-label={pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" })}>
                  <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl border", card)}>
                    <Search className={cn("h-4 w-4", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")} />
                  </span>
                </Link>
                <Link href="/portal/notifications" aria-label={pickLang(language, { ku: "ئاگادارییەکان", en: "Notifications", ar: "الإشعارات", zh: "通知" })}>
                  <span className={cn("relative inline-flex h-9 w-9 items-center justify-center rounded-xl border", card)}>
                    <Bell className={cn("h-4 w-4", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")} />
                    {(notificationCount ?? 0) > 0 && (
                      <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Full header — language, the mark, the clock; then identity and the
            two icons. The owner wanted the mark in the middle of this row:
            three columns, the outer two equal, so it sits on the screen's
            centre line — and a wide clock pushes it aside rather than covering
            it. White ink on the dark theme, where the black mark vanishes. */}
        <div className="px-4 pt-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="justify-self-start">
              <PortalLanguagePicker glass={glassPill} />
            </div>
            <img
              src={isDark ? BRAND_LOGO_ON_DARK_URL : BRAND_LOGO_URL}
              alt="Wazn Express"
              className="h-7 w-auto select-none"
              draggable={false}
              onError={onImageError}
            />
            <div className="justify-self-end">
              <PortalClock onLight={!isDark} compact />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            {/* The avatar IS the account button — the owner removed the
                account tab from the bottom bar and pointed here instead. */}
            <Link href="/portal/profile" aria-label={pickLang(language, { ku: "هەژماری من", en: "My account", ar: "حسابي", zh: "我的账户" })}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="relative shrink-0">
                  <span aria-hidden="true" className="wazn-breathe absolute -inset-1 rounded-full bg-blue-500 blur-md" />
                  <span className={cn("relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full transition active:scale-95", isDark ? "bg-[#1D4ED8]" : "bg-blue-600 dark:bg-[#1D4ED8]")}>
                    {account?.photoUrl ? (
                      <img src={account.photoUrl} alt="" className="h-full w-full object-cover" onError={onImageError} />
                    ) : (
                      <User className="h-5 w-5 text-blue-100" />
                    )}
                  </span>
                </span>
                <span className="min-w-0 block">
                  {accountLoading ? (
                    <Skeleton className={cn("h-6 w-36", isDark && "bg-slate-700")} />
                  ) : (
                    <h1 className={cn("truncate text-base font-bold", isDark ? "text-white" : "text-slate-900 dark:text-slate-100")}>
                      {account?.fullName || account?.customerCode}
                    </h1>
                  )}
                  {account?.customerCode && (
                    <span dir="ltr" className={cn("mt-0.5 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums", isDark ? "border-blue-500/40 bg-blue-600/20 text-blue-300" : "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300")}>
                      {account.customerCode}
                    </span>
                  )}
                </span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link href="/portal/search" aria-label={pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" })}>
                <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-xl border", card)}>
                  <Search className={cn("h-[18px] w-[18px]", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")} />
                </span>
              </Link>
              {/* A red dot, not a number: "something is new" is the whole
                  message. Guard with a boolean — React renders a literal 0. */}
              <Link href="/portal/notifications" aria-label={pickLang(language, { ku: "ئاگادارییەکان", en: "Notifications", ar: "الإشعارات", zh: "通知" })}>
                <span className={cn("relative inline-flex h-11 w-11 items-center justify-center rounded-xl border", card)}>
                  <Bell className={cn("h-[18px] w-[18px]", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")} />
                  {(notificationCount ?? 0) > 0 && (
                    <span className="absolute top-2 end-2 h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  )}
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Currency ticker — admin-set rates; hidden entirely until set */}
        {(rmbRate || iqdRate) && (
          <div className="px-4 mt-3">
            <div className={cn(
              "flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs",
              isDark ? "border-sky-500/25 bg-sky-950/40 text-sky-300" : "border-sky-200 dark:border-sky-500/25 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300",
            )}>
              <Coins className="h-3.5 w-3.5 shrink-0" />
              <span dir="ltr" className="tabular-nums">
                {rmbRate ? `$1 = ¥${fmtNumber(rmbRate, 2)}` : ""}
                {rmbRate && iqdRate ? "  •  " : ""}
                {iqdRate ? `$100 = ${(iqdRate * 100).toLocaleString("en-US")} IQD` : ""}
              </span>
            </div>
          </div>
        )}

        {/* Hero action — the one thing a customer should do after every
            purchase. Blue is the action colour; green stays for arrival. */}
        <div className="px-4 mt-4">
          <Link href="/portal/declare">
            <span className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] p-4 shadow-lg shadow-blue-600/30 transition-transform active:scale-[0.99]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">
                  {pickLang(language, { ku: "هەرچیت کڕیوە؟ تراکەکەی تۆمار بکە", en: "Bought something? Register its tracking", ar: "اشتريت شيئًا؟ سجّل رقم تتبعه", zh: "买了东西？登记运单号" })}
                </span>
                <span className="block text-[11px] text-white/85">
                  {pickLang(language, { ku: "بەدواداچوونی خۆکار بۆ هەموو کڕینەکانت", en: "Automatic follow-up for every purchase", ar: "متابعة تلقائية لكل مشترياتك", zh: "自动跟进您的每一笔购买" })}
                </span>
              </span>
            </span>
          </Link>
        </div>

        {/* Money — amber while anything is owed, calm green when clear */}
        <div className="px-4 mt-3">
          {summaryLoading ? (
            <Skeleton className={cn("h-[72px] w-full rounded-2xl", isDark && "bg-slate-800")} />
          ) : hasDebt ? (
            <Link href="/portal/financial">
              <div className={cn(
                "rounded-2xl border p-4 transition-transform active:scale-[0.99]",
                isDark ? "border-amber-500/40 bg-amber-950/40" : "border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40",
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn("text-xs", isDark ? "text-amber-300" : "text-amber-700 dark:text-amber-300")}>
                      {t("portal.outstandingBalance")}
                    </p>
                    <p dir="ltr" className={cn("text-2xl font-bold tabular-nums", isDark ? "text-amber-400" : "text-amber-600 dark:text-amber-400")}>
                      {balanceText}
                    </p>
                  </div>
                  {/* Direct WhatsApp line for paying. Stops propagation so
                      tapping it doesn't follow the card into the finance page. */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const msg = pickLang(language, {
                        ku: `سڵاو، دەمەوێت باڵانسەکەم بدەم (${balanceText}). تکایە شێوازەکانی پارەدانم بۆ بنێرن.`,
                        en: `Hello, I'd like to pay my balance (${balanceText}). Please send me the payment options.`,
                        ar: `مرحبًا، أودّ دفع رصيدي (${balanceText}). الرجاء إرسال طرق الدفع.`,
                        zh: `您好，我想支付我的余额（${balanceText}）。请发送付款方式。`,
                      });
                      window.open(`https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 transition active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {pickLang(language, { ku: "پارەدان لە واتساپ", en: "Pay via WhatsApp", ar: "الدفع عبر واتساب", zh: "通过 WhatsApp 付款" })}
                  </button>
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/portal/financial">
              <div className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border p-4 transition-transform active:scale-[0.99]",
                isDark ? "border-emerald-500/30 bg-emerald-950/30" : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30",
              )}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle className={cn("h-5 w-5 shrink-0", isDark ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400")} />
                  <p className={cn("truncate text-sm font-semibold", isDark ? "text-emerald-200" : "text-emerald-800 dark:text-emerald-200")}>
                    {isCredit(balance)
                      ? pickLang(language, { ku: "پارەی خۆت لای ئێمەیە", en: "Your money is held with us", ar: "لديك رصيد محفوظ لدينا", zh: "您有余额存放在我们这里" })
                      : pickLang(language, { ku: "هیچ قەرزێکت لەسەر نییە", en: "Nothing owed", ar: "لا يوجد رصيد مستحق", zh: "没有欠款" })}
                  </p>
                </div>
                {balance !== 0 && (
                  <span dir="ltr" className={cn("shrink-0 text-sm font-bold tabular-nums", isDark ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-300")}>
                    {balanceText}
                  </span>
                )}
              </div>
            </Link>
          )}
        </div>

        {/* Prohibited packages — flashes while any item awaits the customer's decision */}
        {prohibitedPackages && prohibitedPackages.length > 0 && (
          <div className="px-4 mt-3">
            <Link href="/portal/prohibited-packages">
              <div className={cn(
                "rounded-2xl border p-3.5 cursor-pointer flex items-center gap-3 transition-all",
                prohibitedPending > 0
                  ? "wazn-prohibited-flash border-red-400"
                  : card,
              )}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900 dark:text-slate-100")}>
                    {pickLang(language, { ku: "کەل و پەلی قەدەغە", en: "Prohibited packages", ar: "طرود ممنوعة", zh: "违禁包裹" })}
                  </p>
                  <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                    {prohibitedPending > 0
                      ? pickLang(language, { ku: `${prohibitedPending} پاکێج پێویستی بە بڕیارتە`, en: `${prohibitedPending} need your decision`, ar: `${prohibitedPending} بحاجة لقرارك`, zh: `${prohibitedPending} 项需要您处理` })
                      : pickLang(language, { ku: "بینینی وردەکاری", en: "View details", ar: "عرض التفاصيل", zh: "查看详情" })}
                  </p>
                </div>
                <ChevronRight className={cn("h-5 w-5 shrink-0", isDark ? "text-slate-500" : "text-slate-400", isRTL && "rotate-180")} />
              </div>
            </Link>
          </div>
        )}

        {/* Something did not load. Say so once, near the top, rather than
            letting zero counters imply the account is empty. */}
        {homeFailed && (
          <div className="px-4 mt-3">
            <PortalErrorState compact onRetry={retryHome} isRetrying={homeRetrying} />
          </div>
        )}

        {/* Stats Cards */}
        {/* The three-stage pipeline: China → the road → Iraq. Tapping a card
            filters the list below in place; tapping again clears it. */}
        <div className="px-4 mt-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => togglePipeline("in_china")}
              aria-pressed={pipelineFilter === "in_china"}
              className={cn(
                "rounded-2xl border p-3 text-center transition-all active:scale-[0.98]",
                card,
                pipelineFilter === "in_china" && "ring-2 ring-blue-500",
              )}
            >
              <Package className={cn("mx-auto h-5 w-5", isDark ? "text-blue-300" : "text-blue-600 dark:text-blue-300")} />
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", isDark ? "text-white" : "text-slate-900 dark:text-slate-100")}>
                {batchesLoading ? "…" : <AnimatedCounter value={chinaCount} />}
              </p>
              <p className={cn("mt-0.5 text-[11px] leading-tight", isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                {pickLang(language, STATUS_LABEL.preparing)}
              </p>
            </button>

            <button
              type="button"
              onClick={() => togglePipeline("on_the_way")}
              aria-pressed={pipelineFilter === "on_the_way"}
              className={cn(
                "rounded-2xl border p-3 text-center transition-all active:scale-[0.98]",
                isDark ? "border-sky-500/35 bg-[#152238]" : "border-sky-300 dark:border-sky-500/35 bg-white dark:bg-[#152238]",
                pipelineFilter === "on_the_way" && "ring-2 ring-sky-500",
              )}
            >
              <Plane className={cn("mx-auto h-5 w-5", isDark ? "text-sky-400" : "text-sky-600 dark:text-sky-400")} />
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", isDark ? "text-sky-400" : "text-sky-600 dark:text-sky-400")}>
                {batchesLoading ? "…" : <AnimatedCounter value={onTheWay.length} />}
              </p>
              <p className={cn("mt-0.5 text-[11px] leading-tight", isDark ? "text-sky-300" : "text-sky-700 dark:text-sky-300")}>
                {pickLang(language, STATUS_LABEL.in_transit)}
                {nextEtaDays !== null && (
                  <span className="block tabular-nums">
                    {pickLang(language, { ku: `نزیکەی ${nextEtaDays} ڕۆژ ماوە`, en: `about ${nextEtaDays} days left`, ar: `نحو ${nextEtaDays} يومًا متبقية`, zh: `约剩 ${nextEtaDays} 天` })}
                  </span>
                )}
              </p>
            </button>

            <button
              type="button"
              onClick={() => togglePipeline("in_iraq")}
              aria-pressed={pipelineFilter === "in_iraq"}
              className={cn(
                "rounded-2xl border p-3 text-center transition-all active:scale-[0.98]",
                isDark ? "border-emerald-500/50 bg-emerald-950/40" : "border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40",
                pipelineFilter === "in_iraq" && "ring-2 ring-emerald-500",
              )}
            >
              <CheckCircle className={cn("mx-auto h-5 w-5", isDark ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400")} />
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", isDark ? "text-emerald-400" : "text-emerald-600 dark:text-emerald-400")}>
                {batchesLoading ? "…" : <AnimatedCounter value={inIraq.length} />}
              </p>
              <p className={cn("mt-0.5 text-[11px] leading-tight", isDark ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-300")}>
                {pickLang(language, STATUS_LABEL.arrived)}
              </p>
            </button>
          </div>
        </div>

        {/* What happens next — becomes the pulsing collect-me banner when a
            shipment is waiting in the Erbil depot */}
        <NextStepCard batches={batches ?? []} isDark={isDark} language={language} loading={batchesLoading} />

        {/* Recent shipments — or, with the China card tapped, the depot list */}
        <div className="px-4 mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {t("portal.recentShipments") || "گواستنەوە نوێیەکان"}
            </h2>
            <Link href="/portal/shipments">
              <span className="flex items-center gap-1 text-sm font-medium text-blue-500 dark:text-blue-400 transition-colors hover:text-blue-600">
                {t("portal.viewAll") || "هەموو ببینە"}
                <ChevronRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
              </span>
            </Link>
          </div>

          {pipelineFilter === "in_china" ? (
            chinaItems.length > 0 ? (
              <ChinaDepotList items={chinaItems} isDark={isDark} className="mt-0" />
            ) : (
              <PortalEmptyState
                compact
                icon={Package}
                title={pickLang(language, { ku: "هیچ پاکەتێکت لە کۆگای چین نییە", en: "Nothing of yours is in the China depot", ar: "لا توجد طرود لك في مستودع الصين", zh: "您在中国仓库没有包裹" })}
                hint={pickLang(language, { ku: "کاتێک پاکەتێکت بگاتە کۆگاکەمان، لێرە دەردەکەوێت.", en: "Parcels appear here as soon as they reach our depot.", ar: "تظهر الطرود هنا فور وصولها إلى مستودعنا.", zh: "包裹一到我们的仓库就会显示在这里。" })}
              />
            )
          ) : batchesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className={cn("h-24 w-full rounded-2xl", isDark && "bg-slate-800")} />
              ))}
            </div>
          ) : recentSource.length === 0 ? (
            /* A brand-new customer used to get a grey box saying "nothing
               here" at the one moment they most need telling what to do. */
            totalBatches === 0 ? (
              <PortalWelcomeCard customerCode={account?.customerCode} isDark={isDark} />
            ) : (
              <PortalEmptyState
                compact
                icon={Package}
                title={pipelineFilter
                  ? pickLang(language, { ku: "لەم قۆناغەدا هیچ نییە", en: "Nothing in this stage", ar: "لا يوجد شيء في هذه المرحلة", zh: "此阶段没有货件" })
                  : (t("portal.noShipments") || "هیچ گواستنەوەیەک نییە")}
              />
            )
          ) : (
            <div className="space-y-2.5">
              {recentSource.map((batch) => (
                <Link key={batch.id} href={`/portal/shipments/${batch.id}`}>
                  <div className={cn(
                    "rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]",
                    card,
                  )}>
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                        batch.shippingType?.includes("sea")
                          ? (isDark ? "bg-cyan-900/50 text-cyan-400" : "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400")
                          : (isDark ? "bg-sky-900/50 text-sky-400" : "bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400")
                      )}>
                        {getShippingIcon(batch.shippingType || "")}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p dir="ltr" className={cn("font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                            {batch.batchCode}
                          </p>
                          <PortalChip tone={batchStatusTone(batch.status)} icon={getStatusIcon(batch.status)}>
                            {getStatusText(batch.status)}
                          </PortalChip>
                        </div>
                        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                          {fmtCount(batch.customerPackageCount)}{" "}
                          {pickLang(language, { ku: "پاکەت", en: "packages", ar: "طرد", zh: "件包裹" })}
                        </p>
                      </div>

                      <ChevronRight className={cn(
                        "h-5 w-5 shrink-0",
                        isDark ? "text-slate-500" : "text-slate-400",
                        isRTL && "rotate-180"
                      )} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* The delivered history, one tap away — the pipeline shows the
              live stages, this line keeps the past reachable. */}
          {pipelineFilter === null && deliveredCount > 0 && (
            <Link href="/portal/shipments?status=delivered">
              <span className={cn("mt-2.5 flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium", card, isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>
                <CheckCircle className="h-3.5 w-3.5" />
                {pickLang(language, {
                  ku: `${deliveredCount} باری گەیشتوو ببینە`,
                  en: `See ${deliveredCount} delivered shipments`,
                  ar: `شاهد ${deliveredCount} شحنة مسلّمة`,
                  zh: `查看 ${deliveredCount} 个已送达货件`,
                })}
              </span>
            </Link>
          )}
        </div>

        {/* Four tools, one row — the owner's shortlist */}
        <div className="px-4 mt-5">
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href}>
                <span className={cn("flex h-full flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all active:scale-[0.97]", card)}>
                  <action.icon className={cn("h-5 w-5", isDark ? "text-blue-300" : "text-blue-600 dark:text-blue-300")} />
                  <span className={cn("text-[11px] font-medium leading-tight", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-300")}>
                    {action.label}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Pending Orders — orders not yet delivered, no invoice yet.
            Moves into the My-shipments tab in the next phase; until that tab
            exists this card is the road to those orders. Renders only when
            there is something pending. */}
        {pendingOrders && pendingOrders.count > 0 && (
          <div className="px-4 mt-5">
            <Link href="/portal/full-package">
              <div className={cn(
                "relative overflow-hidden rounded-2xl border p-4 transition-all hover:scale-[1.01] active:scale-[0.99]",
                isDark
                  ? "border-amber-700/50 bg-gradient-to-br from-amber-900/50 to-orange-900/40"
                  : "border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50 dark:from-amber-950/40 to-orange-50 dark:to-orange-950/40"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <div className={cn("rounded-xl p-2", isDark ? "bg-amber-600/30" : "bg-amber-500/20")}>
                        <Clock className={cn("h-5 w-5", isDark ? "text-amber-300" : "text-amber-700 dark:text-amber-300")} />
                      </div>
                      <div className="min-w-0">
                        <h3 className={cn("truncate text-base font-bold", isDark ? "text-amber-100" : "text-amber-900 dark:text-amber-200")}>
                          {t("portal.pendingOrdersTitle")}
                        </h3>
                        <p className={cn("text-xs", isDark ? "text-amber-300/80" : "text-amber-700 dark:text-amber-300")}>
                          {t("portal.pendingOrdersSubtitle")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className={cn("flex min-h-[28px] items-center justify-center text-[11px] font-medium leading-tight", isDark ? "text-amber-300/80" : "text-amber-700 dark:text-amber-300")}>
                          📦 {pickLang(language, { ku: "پاکێجی تەواو", en: "Full package", ar: "حزمة كاملة", zh: "完整套餐" })}
                        </p>
                        <p className={cn("text-xl font-bold", isDark ? "text-amber-100" : "text-amber-900 dark:text-amber-200")}>
                          <AnimatedCounter value={pendingOrders.byType.full_package} />
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn("flex min-h-[28px] items-center justify-center text-[11px] font-medium leading-tight", isDark ? "text-amber-300/80" : "text-amber-700 dark:text-amber-300")}>
                          🛍️ {pickLang(language, { ku: "کڕین بە تێچوو", en: "Markup purchase", ar: "شراء بهامش", zh: "加价采购" })}
                        </p>
                        <p className={cn("text-xl font-bold", isDark ? "text-amber-100" : "text-amber-900 dark:text-amber-200")}>
                          <AnimatedCounter value={pendingOrders.byType.commission} />
                        </p>
                      </div>
                      <div className="text-center">
                        <p className={cn("flex min-h-[28px] items-center justify-center text-[11px] font-medium leading-tight", isDark ? "text-amber-300/80" : "text-amber-700 dark:text-amber-300")}>
                          📝 {pickLang(language, { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" })}
                        </p>
                        <p className={cn("text-xl font-bold", isDark ? "text-amber-100" : "text-amber-900 dark:text-amber-200")}>
                          <AnimatedCounter value={pendingOrders.byType.purchase_request} />
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-end">
                    <p className={cn("mb-1 text-xs font-medium", isDark ? "text-amber-300/80" : "text-amber-700 dark:text-amber-300")}>
                      {t("portal.estimatedTotal")}
                    </p>
                    <p dir="ltr" className={cn("font-mono text-xl font-bold tabular-nums", isDark ? "text-amber-100" : "text-amber-900 dark:text-amber-200")}>
                      {fmtUsd(pendingOrders.totalPriceUsd)}
                    </p>
                    <div className={cn(
                      "mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                      isDark ? "bg-amber-600/30 text-amber-200" : "bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200"
                    )}>
                      {pendingOrders.count} {t("portal.orders")}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* The customer's own boxes. A box waiting to be confirmed is the most
            actionable thing on the page. Renders nothing when there are none. */}
        <MyDeliveryBoxes className="mt-4" />

        {/* Invite a friend — customer's code doubles as a referral code */}
        <ReferralCard isDark={isDark} language={language} />

        {/* Announcements Section */}
        <AnnouncementsSection isDark={isDark} language={language} t={t} />

        {/* The links they have handed out, and the way to close one. Renders
            nothing when nothing has been shared, which is most customers. */}
        <MyShareLinks isDark={isDark} language={language} />

        {/* A word on the days worth one — birthdays, Newroz, Eid. Down here on
            purpose: found while scrolling, never announced at the top. */}
        <GreetingCard isDark={isDark} language={language} />

        {/* Rate your delivery — a gentle inline card at the very bottom, never
            a blocking popup. Shows for the latest delivered, unrated package. */}
        <DeliveryRatingCard isDark={isDark} language={language} />
      </div>
    </CustomerPortalLayout>
  );
}
