import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { lazy } from "react";
// Lazy: only the active skin's chunk is downloaded — the skin is a global
// admin setting, so shipping all three variants to every customer tripled
// the route bundle for nothing.
const ModernPortalShipments = lazy(() => import("./modern/ModernPortalShipments"));
const Skin3PortalShipments = lazy(() => import("./skin3/Skin3PortalShipments"));
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Package, ChevronRight, Truck, CheckCircle, Clock, AlertCircle, 
  Plane, Ship, Box, AlertTriangle, Search, Filter, X, Calendar,
  ArrowUpDown, Download, Share2, HelpCircle, Info, Warehouse, Copy
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { PortalListSkeleton } from "@/components/portal/PortalListSkeleton";
import { BatchJourneyTimeline } from "@/components/portal/BatchJourneyTimeline";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { ChinaDepotList, useChinaDepotItems } from "@/components/portal/ChinaDepotList";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { getBatchEta, formatBatchEta } from "@/lib/batchEta";
import { matchesStage, countByStage, STATUS_LABEL, orderStageOf, type ShipmentStage } from "@/lib/shipmentFilters";
import { tint, gradient } from "@/lib/portalModes";
import { formatClockDate } from "@/lib/portalClock";
import { filterChinaDepot, matchesRoute } from "@/lib/chinaDepotFilter";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
// "" is no filter — which is what the old "All" chip meant. Dropping the chip
// and letting nothing-selected mean everything is one less thing to explain.
type StatusFilter = ShipmentStage;
type ShippingFilter = "" | "air_regular" | "sea" | "air_irregular";
type SortOption = "newest" | "oldest" | "status";

function ClassicPortalShipments() {
  // Banner colour follows the mode the customer picked, like every other page.
  const { banner: portalBanner, palette: pal } = usePortalPalette();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  // Get URL params for initial filter
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  // A link may deep-link to a status; no param means no filter.
  const initialStatus = (urlParams.get("status") as StatusFilter) || "";
  
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [shippingType, setShippingType] = useState<ShippingFilter>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);

  // The filter bar shrinks once the reader scrolls past choosing, handing the
  // screen back to the list. Two thresholds, not one: a single boundary makes
  // the bar flip back and forth while a finger rests near it.
  const [compactFilters, setCompactFilters] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompactFilters(prev => (prev ? y > 24 : y > 72));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  
  const { data: batches, isLoading, isError, isFetching, refetch } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: unbatchedPackages, refetch: refetchUnbatched } = trpc.customerPortal.getMyUnbatchedPackages.useQuery();
  // Full-package and commission orders travel the same road but live in their
  // own table with their own status names. Leaving them out is why an order
  // could say "in China" on My Goods and be missing here entirely.
  const { data: myOrders } = trpc.customerPortal.getMyFullPackageOrders.useQuery({});

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchUnbatched()]);
  };
  const { pullToRefreshProps, pullDistance } = usePullToRefresh(handleRefresh);

  // Filter and sort batches
  const filteredBatches = useMemo(() => {
    let result = batches || [];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(batch => 
        batch.batchCode?.toLowerCase().includes(query)
      );
    }
    
    // Status filter. "arrived" and "customs" mean the goods reached Iraq and
    // are with customs — they used to sit in the same bucket as "preparing",
    // which was wrong and only survived because that bucket was vaguely named.
    // From the customer's side anything not yet in their hands is on its way.
    result = result.filter(batch => matchesStage(batch.status, statusFilter));

    // Shipping type filter
    if (shippingType) {
      result = result.filter(batch => batch.shippingType === shippingType);
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      // Sort by status priority
      const statusPriority: Record<string, number> = {
        in_transit: 1,
        customs: 2,
        arrived: 3,
        at_depot: 4,
        preparing: 5,
        delivered: 6,
        closed: 7
      };
      return (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
    });
    
    return result;
  }, [batches, searchQuery, statusFilter, shippingType, sortBy]);

  /**
   * Everything of this customer's that is sitting in the China depot, from
   * both places it can be recorded: a loose package scanned onto their code,
   * and a full-package or commission order the office bought for them.
   *
   * They are two tables with two status vocabularies, which is precisely how
   * the portal came to contradict itself — an order could read "in China" on
   * My Goods and be absent here. One list, one wording.
   */
  const inChinaItems = useChinaDepotItems();


  /**
   * The China list has to obey the filters like everything else, or the page
   * says one thing at the top and another below it.
   *
   * The route is chosen at quick-register, so these parcels do belong under
   * one — an air-standard parcel has no business appearing under sea. An item
   * with no route recorded stays visible rather than disappearing from every
   * route at once.
   */
  const visibleInChina = useMemo(
    () => filterChinaDepot(inChinaItems, {
      stage: statusFilter,
      shippingType,
      search: searchQuery,
    }),
    [inChinaItems, statusFilter, shippingType, searchQuery],
  );

  /** Everything on screen, so the count and the empty state agree with it. */
  const totalResults = filteredBatches.length + visibleInChina.length;

  // Calculate progress percentage based on status
  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "preparing": return 20;
      case "in_transit": return 50;
      case "arrived": return 70;
      case "customs": return 80;
      case "at_depot": return 90;
      case "delivered": return 100;
      case "closed": return 100;
      default: return 10;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return { 
          bg: isDark ? "bg-emerald-900/50" : "bg-emerald-100 dark:bg-emerald-950/40", 
          text: isDark ? "text-emerald-400" : "text-emerald-700 dark:text-emerald-300", 
          icon: isDark ? "text-emerald-400" : "text-emerald-500",
          progress: "bg-emerald-500"
        };
      case "in_transit":
        return { 
          bg: isDark ? "bg-blue-900/50" : "bg-blue-100 dark:bg-blue-950/40", 
          text: isDark ? "text-blue-400" : "text-blue-700 dark:text-blue-300", 
          icon: isDark ? "text-blue-400" : "text-blue-500",
          progress: "bg-blue-500"
        };
      case "customs":
        return { 
          bg: isDark ? "bg-amber-900/50" : "bg-amber-100 dark:bg-amber-950/40", 
          text: isDark ? "text-amber-400" : "text-amber-700 dark:text-amber-300", 
          icon: isDark ? "text-amber-400" : "text-amber-500",
          progress: "bg-amber-500"
        };
      default:
        return { 
          bg: isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40", 
          text: isDark ? "text-slate-300" : "text-slate-600", 
          icon: isDark ? "text-slate-400" : "text-slate-400",
          progress: "bg-slate-400"
        };
    }
  };

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

  /**
   * The badge on each batch card.
   *
   * This was a fourth private copy of the status names, and it carried the
   * same fault the others did: "گەیشتووە" for both `arrived` and `delivered`,
   * so a batch that had reached Iraq and one already in the customer's hands
   * read identically. It also predated `at_depot`, which would have shown as
   * the raw column value, and used different words from the filters directly
   * above it — the page disagreeing with itself.
   */
  const getStatusText = (status: string) => {
    const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL];
    return label ? pickLang(language, label) : status;
  };

  const getShippingIcon = (type: string) => {
    if (type === "sea") return <Ship className="w-5 h-5" />;
    if (type === "air_irregular") return <AlertTriangle className="w-5 h-5" />;
    return <Plane className="w-5 h-5" />;
  };

  const getShippingColor = (type: string) => {
    if (type === "sea") return isDark ? "bg-cyan-900/50 text-cyan-400" : "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600";
    if (type === "air_irregular") return isDark ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 dark:bg-amber-950/40 text-amber-600";
    return isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 dark:bg-blue-950/40 text-blue-600";
  };

  // Shipping type tabs
  /**
   * How a shipment travels. The data always had these three; only the names
   * were opaque — "نائاسایی" on its own told a customer nothing, so each now
   * says what it carries and what that costs in speed or money. It doubles as
   * guidance for someone still deciding how to send.
   */
  const shippingTabs: {
    value: Exclude<ShippingFilter, "">;
    label: string; labelKu: string; labelAr: string;
    descKu: string; descEn: string; descAr: string;
    icon: any;
  }[] = [
    {
      value: "air_regular",
      label: "Air · standard", labelKu: "ئاسمانی ئاسایی", labelAr: "جوي عادي",
      descKu: "جل و بەرگ، جانتا، پێڵاو و کەلوپەلی ئاسایی. خێراترین ڕێگا.",
      descEn: "Clothes, bags, shoes and everyday goods. The fastest route.",
      descAr: "ملابس وحقائب وأحذية وبضائع اعتيادية. أسرع طريق.",
      icon: Plane,
    },
    {
      value: "air_irregular",
      label: "Air · special", labelKu: "ئاسمانی نائاسایی", labelAr: "جوي خاص",
      descKu: "شلەمەنی، پاتری، ماگنێت و هاوشێوەکانیان. ڕێگایەکی تایبەت و کاتی زیاتری دەوێت.",
      descEn: "Liquids, batteries, magnets and the like. A special route, and slower.",
      descAr: "سوائل وبطاريات ومغناطيس وما شابه. مسار خاص ويستغرق وقتًا أطول.",
      icon: AlertTriangle,
    },
    {
      value: "sea",
      label: "Sea", labelKu: "دەریایی", labelAr: "بحري",
      descKu: "کاڵای قەبارە گەورە کە پەلەت لە گەیشتنی نییە. هەرزانترین ڕێگا.",
      descEn: "Bulky goods you are not in a hurry for. The cheapest route.",
      descAr: "بضائع كبيرة الحجم لا تستعجلها. أرخص طريق.",
      icon: Ship,
    },
  ];

  /**
   * Where a shipment has got to. Three stages, in the order they happen.
   * "arrived" and "customs" belong with in-transit: the goods are in Iraq but
   * not yet in the customer's hands, so from their side they are still coming.
   */
  // Counts have to match what tapping the pill actually shows.
  //
  // Two things they used to get wrong: goods in the China depot belong to no
  // batch, so counting batches alone reported 0 while six items sat listed
  // underneath; and the route above is an upstream filter, so a count that
  // ignored it promised parcels the stage would not then show.
  const stageCounts = useMemo(() => {
    const inRoute = (type: string | null | undefined) => matchesRoute(type, shippingType);

    const counts = countByStage(
      (batches ?? []).filter(b => inRoute(b.shippingType)).map(b => b.status),
    );
    return {
      ...counts,
      in_china: counts.in_china + inChinaItems.filter(i => inRoute(i.shippingType)).length,
    };
  }, [batches, inChinaItems, shippingType]);
  const statusFilters: { value: Exclude<StatusFilter, "">; label: string; labelKu: string; labelAr: string; count: number }[] = [
    { value: "in_china", label: "In China", labelKu: "لە کۆگای چین", labelAr: "في مستودع الصين", count: stageCounts.in_china },
    { value: "in_transit", label: "On the way", labelKu: "لە ڕێگادا", labelAr: "في الطريق", count: stageCounts.in_transit },
    { value: "delivered", label: "Arrived", labelKu: "گەیشتوو", labelAr: "تم التسليم", count: stageCounts.delivered },
  ];

  const activeShipping = shippingTabs.find(t => t.value === shippingType);
  const shippingHint = activeShipping
    ? (language === "ku" ? activeShipping.descKu : language === "ar" ? activeShipping.descAr : activeShipping.descEn)
    : (language === "ku" ? "هەموو بارەکانت — یەکێک هەڵبژێرە بۆ پاڵاوتن."
      : language === "ar" ? "كل شحناتك — اختر واحدًا للتصفية."
      : "All your shipments — pick one to filter.");

  return (
    <CustomerPortalLayout>
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={portalBanner} />
        <div className="relative px-5 pt-14 pb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {language === "ku" ? "بارەکان" : language === "ar" ? "الشحنات" : "Shipments"}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-400 text-sm">
                  {language === "ku" ? "شوێنکەوتنی پاکەتەکانت" : language === "ar" ? "تتبع شحناتك" : "Track your packages"}
                </p>
                <Link href="/portal/guide#shipments">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 hover:bg-white/20 transition cursor-pointer">
                    <HelpCircle className="w-3 h-3" />
                    {language === "ku" ? "ئەمە چییە؟" : language === "ar" ? "ما هذا؟" : language === "zh" ? "这是什么？" : "What's this?"}
                  </span>
                </Link>
              </div>
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "p-3 rounded-xl transition-all duration-300",
                showFilters 
                  ? "bg-white text-slate-800 dark:text-slate-200" 
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "ku" ? "گەڕان بە کۆدی باچ..." : language === "ar" ? "البحث برمز الدفعة..." : "Search by batch code..."}
              className={cn(
                "w-full pl-12 pr-4 py-3.5 rounded-xl text-sm transition-all duration-300",
                isDark 
                  ? "bg-slate-800 text-white placeholder-slate-500 focus:bg-slate-700" 
                  : "bg-white/10 text-white placeholder-slate-400 focus:bg-white/20"
              )}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-slate-600 hover:bg-slate-500"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Type Tabs */}
      {/* Both filter rows in one frozen bar. It starts full height — heading,
          three tall cards, and the line explaining what the chosen type
          carries — then collapses on the first scroll to a single compact row
          per filter, so the list gets the screen back once the reader is past
          choosing. */}
      <div className={cn(
        "sticky top-14 z-20 border-b backdrop-blur-md transition-all duration-300",
        compactFilters ? "px-3 py-2" : "px-4 py-3",
        isDark ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-slate-100 dark:border-slate-800/60"
      )}>
        {!compactFilters && (
          <p className={cn("mb-2 text-[11px] font-medium", isDark ? "text-slate-500" : "text-slate-400")}>
            {language === "ku" ? "چۆن دەنێردرێت" : language === "ar" ? "كيف تُشحن" : "How it ships"}
          </p>
        )}

        <div className={cn("grid grid-cols-3 transition-all duration-300", compactFilters ? "gap-1.5" : "gap-2")}>
          {shippingTabs.map((tab) => {
            const isActive = shippingType === tab.value;
            return (
              <button
                key={tab.value}
                // Tapping the active one clears it — that is what the old "All"
                // chip did, without needing a chip of its own.
                onClick={() => setShippingType(isActive ? "" : tab.value)}
                aria-pressed={isActive}
                className={cn(
                  // Raised like the stage pills below: highlight on the top
                  // edge, shadow beneath, pressed flat on tap.
                  "flex items-center justify-center text-center font-semibold leading-tight",
                  "transition-all duration-300 -translate-y-px active:translate-y-0",
                  compactFilters
                    ? "flex-row gap-1.5 rounded-full px-2 py-1.5 text-[10.5px]"
                    : "flex-col gap-1.5 rounded-xl px-2 py-2.5 text-[11px]",
                  isActive
                    ? "text-white"
                    : (isDark
                        ? "bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600"
                        : "bg-white text-slate-600 border border-slate-200 dark:border-slate-800/60 hover:border-slate-300")
                )}
                style={isActive ? {
                  backgroundImage: gradient("135deg", pal.light, pal.brand),
                  boxShadow: `0 0 0 1px ${tint(pal.light, 0.55)}, 0 6px 14px -4px ${tint(pal.brand, 0.75)}, inset 0 1px 0 ${tint("#ffffff", 0.35)}`,
                } : {
                  boxShadow: isDark
                    ? "0 2px 5px -2px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)"
                    : "0 2px 5px -2px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
                }}
              >
                <tab.icon className={cn("shrink-0", compactFilters ? "w-3.5 h-3.5" : "w-4 h-4")} />
                <span>{language === "ku" ? tab.labelKu : language === "ar" ? tab.labelAr : tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* What the selected type carries — the point of the redesign. The old
            labels named the categories without saying what belonged in them.
            Once the reader has scrolled past choosing, it is just noise. */}
        {!compactFilters && (
          <div className={cn(
            "mt-2 flex items-start gap-2 rounded-xl px-3 py-2",
            isDark ? "bg-slate-800/60" : "bg-slate-50 dark:bg-slate-950/40"
          )}>
            <Info className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isDark ? "text-slate-500" : "text-slate-400")} />
            <p className={cn("text-[11.5px] leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
              {shippingHint}
            </p>
          </div>
        )}

        <div className={cn(
          "flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 pt-0.5 transition-all duration-300",
          compactFilters ? "mt-1.5" : "mt-2.5"
        )}>
          {statusFilters.map((filter) => {
            const isActive = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                // Same as the type row: tapping the active one clears it.
                onClick={() => setStatusFilter(isActive ? "" : filter.value)}
                aria-pressed={isActive}
                className={cn(
                  // Raised: a highlight along the top edge and a shadow beneath
                  // give the pill some depth, and it presses down when tapped.
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap",
                  "transition-all duration-200 -translate-y-px active:translate-y-0",
                  isActive
                    ? "text-white"
                    : (isDark
                        ? "bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600"
                        : "bg-white text-slate-600 border border-slate-200 dark:border-slate-800/60 hover:border-slate-300")
                )}
                style={isActive ? {
                  // The glow is the mode's own brand colour, so the row stays
                  // in step with the rest of the portal.
                  backgroundImage: gradient("135deg", pal.light, pal.brand),
                  boxShadow: `0 0 0 1px ${tint(pal.light, 0.55)}, 0 6px 14px -4px ${tint(pal.brand, 0.75)}, inset 0 1px 0 ${tint("#ffffff", 0.35)}`,
                } : {
                  boxShadow: isDark
                    ? "0 2px 5px -2px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)"
                    : "0 2px 5px -2px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.9)",
                }}
              >
                {language === "ku" ? filter.labelKu : language === "ar" ? filter.labelAr : filter.label}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-xs font-bold tabular-nums",
                    isActive
                      ? "bg-black/25 text-white"
                      : (isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 dark:bg-slate-950/40 text-slate-500")
                  )}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort Options (shown when filters expanded) */}
      {showFilters && (
        <div className={cn(
          "px-4 py-3 border-b transition-colors duration-300",
          isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-100 dark:border-slate-800/60"
        )}>
          <div className="flex items-center gap-2">
            <ArrowUpDown className={cn("w-4 h-4", isDark ? "text-slate-400" : "text-slate-500")} />
            <span className={cn("text-sm font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
              {language === "ku" ? "ڕیزکردن:" : language === "ar" ? "الترتيب:" : "Sort by:"}
            </span>
            <div className="flex gap-2">
              {[
                { value: "newest" as SortOption, label: language === "ku" ? "نوێترین" : language === "ar" ? "الأحدث" : "Newest" },
                { value: "oldest" as SortOption, label: language === "ku" ? "کۆنترین" : language === "ar" ? "الأقدم" : "Oldest" },
                { value: "status" as SortOption, label: language === "ku" ? "بارودۆخ" : language === "ar" ? "الحالة" : "Status" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSortBy(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    sortBy === option.value
                      ? (isDark ? "bg-white text-slate-900 dark:text-slate-200" : "bg-slate-800 text-white")
                      : (isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 dark:bg-slate-950/40 text-slate-600")
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* The list flows in the page rather than scrolling inside a fixed-height
          box. That box was why the news strip looked pinned: the page itself
          never scrolled, so the strip sat below the box, permanently on screen
          and never scrolled past. Pull-to-refresh still works — the hook now
          reads the page's scroll position when its container isn't the thing
          scrolling. */}
      <div
        className={cn("transition-colors duration-300", isDark ? "bg-slate-900" : "bg-slate-50 dark:bg-slate-950/40")}
        {...pullToRefreshProps}
      >
        {/* Pull indicator */}
        {pullDistance > 0 && (
          <div className={cn(
            "sticky top-0 z-10 flex items-center justify-center py-2 text-sm font-medium",
            isDark ? "text-slate-400" : "text-slate-500"
          )}>
            {pullDistance >= 80
              ? (language === "ku" ? "فڕێبدە بۆ نوێکردنەوە" : "Release to refresh")
              : (language === "ku" ? "بڕێوە بۆ نوێکردنەوە" : "Pull to refresh")}
          </div>
        )}
        {/* Results Count */}
        <div className={cn(
          "px-4 py-2 transition-colors duration-300",
          isDark ? "bg-slate-900" : "bg-white"
        )}>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
            {language === "ku" 
              ? `${totalResults} ئەنجام دۆزرایەوە` 
              : language === "ar"
              ? `${totalResults} نتيجة`
              : `${totalResults} results found`}
          </p>
        </div>

        {/* Batches List */}
        <div className={cn(
          "px-4 py-4 pb-24 transition-colors duration-300",
          isDark ? "bg-slate-900" : "bg-slate-50 dark:bg-slate-950/40"
        )}>
          {isLoading ? (
          <PortalListSkeleton rows={4} />
        ) : isError ? (
          /* Without this the failure fell through to "no shipments found" —
             telling a customer their goods are gone because a request timed
             out, with nothing to tap. */
          <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : totalResults === 0 ? (
          <div className={cn(
            "rounded-2xl p-10 text-center shadow-sm transition-colors duration-300",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
              isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40"
            )}>
              <Package className={cn("w-8 h-8", isDark ? "text-slate-500" : "text-slate-400")} />
            </div>
            <p className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
              {language === "ku" ? "هیچ بارێک نەدۆزرایەوە" : language === "ar" ? "لا توجد شحنات" : "No shipments found"}
            </p>
            <p className={cn("text-sm mt-1", isDark ? "text-slate-500" : "text-slate-400")}>
              {/* A customer with no shipments at all was told to try a
                  different filter. The filter was never the problem. */}
              {statusFilter || shippingType || searchQuery
                ? pickLang(language, { ku: "فلتەرێکی تر تاقی بکەرەوە", en: "Try a different filter", ar: "جرب فلتر مختلف", zh: "换一个筛选条件" })
                : pickLang(language, {
                    ku: "کاتێک یەکەم بارت بگاتە کۆگاکەمان لێرە دەردەکەوێت.",
                    en: "Your first shipment will appear here once it reaches our depot.",
                    ar: "ستظهر أول شحنة لك هنا فور وصولها إلى مستودعنا.",
                    zh: "您的第一批货物抵达我们仓库后会显示在这里。",
                  })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBatches.map((batch) => {
              const statusColors = getStatusColor(batch.status);

              return (
                <Link key={batch.id} href={`/portal/shipments/${batch.id}`}>
                  <div className={cn(
                    "rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border",
                    isDark 
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-750" 
                      : "bg-white border-slate-100 dark:border-slate-800/60"
                  )}>
                    {/* Top Row */}
                    <div className="flex items-start gap-4">
                      {/* Shipping Type Icon */}
                      <div className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                        getShippingColor(batch.shippingType || "air_regular")
                      )}>
                        {getShippingIcon(batch.shippingType || "air_regular")}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                            {batch.batchCode}
                          </p>
                          <ChevronRight className={cn(
                            "w-5 h-5 shrink-0",
                            isDark ? "text-slate-500" : "text-slate-400",
                            isRTL && "rotate-180"
                          )} />
                        </div>
                        
                        {/* Status Badge */}
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          statusColors.bg, statusColors.text
                        )}>
                          <span className={statusColors.icon}>{getStatusIcon(batch.status)}</span>
                          {getStatusText(batch.status)}
                        </div>
                      </div>
                    </div>

                    {/* Journey timeline — the batch's stages at a glance */}
                    <div className="mt-4">
                      <BatchJourneyTimeline
                        status={batch.status}
                        shippingType={batch.shippingType}
                        createdAt={batch.createdAt}
                        departureDate={batch.departureDate}
                        estimatedArrival={batch.estimatedArrival}
                        actualArrival={batch.actualArrival}
                        language={language}
                        isDark={isDark}
                      />
                      <div className="mt-2 flex justify-end">
                        <WhatsAppHelpButton
                          language={language}
                          section={language === "ku" ? "بارەکان" : language === "ar" ? "الشحنات" : language === "zh" ? "货运" : "Shipments"}
                          topic={`${batch.batchCode} — ${getStatusText(batch.status)}`}
                        />
                      </div>
                    </div>

                    {/* Route Indicator */}
                    <div className="flex items-center gap-2 mt-4 px-2">
                      <div className={cn("flex items-center gap-1 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                        <span className="text-lg">🇨🇳</span>
                        <span>{language === "ku" ? "چین" : language === "ar" ? "الصين" : "China"}</span>
                      </div>
                      <div className={cn(
                        "flex-1 border-t-2 border-dashed relative",
                        isDark ? "border-slate-600" : "border-slate-200 dark:border-slate-800/60"
                      )}>
                        <div className={cn(
                          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center",
                          batch.status === "in_transit" 
                            ? "bg-blue-500 text-white animate-pulse" 
                            : batch.status === "delivered" || batch.status === "closed"
                              ? "bg-emerald-500 text-white"
                              : (isDark ? "bg-slate-600 text-slate-400" : "bg-slate-200 text-slate-500")
                        )}>
                          {batch.status === "in_transit" ? (
                            <Plane className="w-3 h-3" />
                          ) : batch.status === "delivered" || batch.status === "closed" ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-1 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                        <span className="text-lg">🇮🇶</span>
                        <span>{language === "ku" ? "عێراق" : language === "ar" ? "العراق" : "Iraq"}</span>
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className={cn(
                      "flex items-center justify-between mt-4 pt-3 border-t",
                      isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn("flex items-center gap-1.5 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                          <Package className="w-4 h-4" />
                          <span>{batch.customerPackageCount} {language === "ku" ? "پاکەت" : language === "ar" ? "طرد" : "pkgs"}</span>
                        </div>
                        {/* The customer's own total, in the unit this batch is
                            billed by. This used to print batch.totalWeight —
                            the whole batch, everybody's goods — and always in
                            kg, including for sea batches billed by volume. */}
                        {(batch as any).customerChargeable > 0 && (
                          <div className={cn("flex items-center gap-1.5 text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                            <span>{(batch as any).customerUnit === "cbm" ? "📦" : "⚖️"}</span>
                            <span className="tabular-nums">
                              {(batch as any).customerChargeable}{" "}
                              {(batch as any).customerUnit === "cbm" ? "m³" : "kg"}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {(() => {
                        // Staff-set ETA, or a derived range from departure +
                        // shipping type (air 7–14d, sea 30–45d) when unset.
                        const eta = getBatchEta(batch);
                        if (eta) {
                          return (
                            <div className={cn(
                              "text-xs font-medium px-2 py-1 rounded-full",
                              isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-50 dark:bg-blue-950/40 text-blue-600"
                            )}>
                              {language === "ku" ? "گەیشتن: " : language === "ar" ? "الوصول: " : language === "zh" ? "预计: " : "ETA: "}
                              {formatBatchEta(eta)}
                            </div>
                          );
                        }
                        return batch.createdAt ? (
                          <div className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Unbatched Packages Section */}
        {/* Packages scanned onto this customer's code but not yet in a batch —
            in other words, the first rung of the journey: they have reached our
            China depot safely.

            This used to be an amber warning card showing nothing but a count.
            Goods arriving safely is good news, not a caution, and a customer
            who has just been told "3 packages" wants to know *which* three. */}
        <ChinaDepotList
          items={inChinaItems}
          stage={statusFilter}
          shippingType={shippingType}
          search={searchQuery}
          isDark={isDark}
        />
        </div>
      </div>
    </CustomerPortalLayout>
  );
}

export default function PortalShipments() {
  const { portalTheme } = usePortalTheme();
  
  if (portalTheme === "skin3") return <Skin3PortalShipments />;
  if (portalTheme === "modern") return <ModernPortalShipments />;
  return <ClassicPortalShipments />;
}
