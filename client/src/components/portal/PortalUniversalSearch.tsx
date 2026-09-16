import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  PackagePlus,
  SearchX,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { PORTAL_LIVE_QUERY } from "@/lib/portalQuery";
import { hasFeature } from "@shared/customerFeatures";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { onImageError } from "@/lib/imageFallback";
import { formatPortalDate } from "@/lib/portalClock";
import { PACKAGE_STATUS_LABEL, packageStatusTone } from "@/lib/packageStatus";
import { orderStatusLabel } from "@/lib/shipmentFilters";
import { cleanTrackingPaste } from "@/lib/entry/cleanPaste";
import { usePackageImages } from "@/components/portal/PackageThumb";
import { PortalChip } from "@/components/portal/PortalStatusChip";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { PortalSearchResultsSkeleton } from "@/components/portal/PortalListSkeleton";
import { BOX_STATUS_LABEL } from "@/components/portal/MyDeliveryBoxes";
import PortalSearchDetail from "@/components/portal/PortalSearchDetail";
import type { PortalSearchView } from "@/hooks/usePortalSearchView";
import {
  buildSearchIndex,
  clearRecentSearches,
  countByTab,
  loadRecentSearches,
  parseSearch,
  rememberSearch,
  searchItems,
  searchTarget,
  shouldAskServer,
  DECLARED_PENDING_LABEL,
  ORDER_NOT_SHIPPED_LABEL,
  SEARCH_DATE_LABEL,
  SEARCH_TABS,
  SEARCH_TAB_DOT,
  SEARCH_TAB_LABEL,
  SEARCH_TAB_TONE,
  type SearchItem,
} from "@/lib/portalSearch";

type Words = { ku: string; en: string; ar: string; zh: string };

/** Cards drawn at once; the rest one tap away. A long account has hundreds. */
const PAGE_SIZE = 30;

const KIND_ICON: Record<SearchItem["kind"], LucideIcon> = {
  parcel: Package,
  order: ShoppingBag,
  box: Boxes,
  declared: PackagePlus,
};

/** A parcel's status in the shared words — never a copy of them. */
function parcelStatusWords(status: string): Words | null {
  return PACKAGE_STATUS_LABEL[status] ?? null;
}

/** What the chip on a card says. */
export function searchStatusWords(item: SearchItem): Words | null {
  switch (item.kind) {
    case "parcel":
      return parcelStatusWords(item.status);
    case "order":
      if (item.status === "returned") return parcelStatusWords("returned");
      return orderStatusLabel(item.status) ?? ORDER_NOT_SHIPPED_LABEL;
    case "box":
      return BOX_STATUS_LABEL[item.status] ?? null;
    case "declared":
      return DECLARED_PENDING_LABEL;
  }
}

/**
 * The chip's colour: the tab's own — green arrived, blue on the way, grey
 * registered. Something under no tab keeps the shared parcel colour, which is
 * red for returned and cancelled.
 */
export function searchStatusTone(item: SearchItem): string {
  if (item.tab) return SEARCH_TAB_TONE[item.tab];
  if (item.kind === "box") return item.status === "delivered" ? SEARCH_TAB_TONE.arrived : SEARCH_TAB_TONE.onTheWay;
  if (item.kind === "parcel" || item.status === "returned") return packageStatusTone(item.status);
  return SEARCH_TAB_TONE.registered;
}

export interface PortalUniversalSearchProps {
  /**
   * The words, the tab and the open details, kept in the phone's history so
   * Back takes one step — see hooks/usePortalSearchView. Owned by the sheet
   * or the page around this.
   */
  view: PortalSearchView;
}

export default function PortalUniversalSearch({ view }: PortalUniversalSearchProps) {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const L = (words: Words) => pickLang(language, words);
  const { query, tab, setTab, submitted } = view;

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [recents, setRecents] = useState<string[]>(loadRecentSearches);

  // The lists the portal already keeps. Each is shared with the screen that
  // owns it, so opening the search usually costs no request at all.
  const parcelsQ = trpc.customerPortal.getMyPackages.useQuery(undefined, PORTAL_LIVE_QUERY);
  const ordersQ = trpc.customerPortal.getMyFullPackageOrders.useQuery({}, PORTAL_LIVE_QUERY);
  const batchesQ = trpc.customerPortal.getMyBatches.useQuery(undefined, PORTAL_LIVE_QUERY);
  const boxesQ = trpc.customerPortal.getMyDeliveryBoxes.useQuery(undefined, PORTAL_LIVE_QUERY);
  const declaredQ = trpc.customerPortal.getMyDeclaredPackages.useQuery(undefined, PORTAL_LIVE_QUERY);
  const { data: features } = trpc.customerPortal.getMyFeatures.useQuery();
  const { portalTheme } = usePortalTheme();
  // Box receipts live on the classic money page, and only for customers
  // given them; the other two skins' money pages have no box tab to open.
  const boxReceipts =
    hasFeature(features, "finance_detail") && portalTheme !== "modern" && portalTheme !== "skin3";
  const images = usePackageImages();

  const index = useMemo(
    () =>
      buildSearchIndex({
        parcels: parcelsQ.data,
        orders: ordersQ.data,
        batches: batchesQ.data,
        boxes: boxesQ.data,
        declared: declaredQ.data,
      }),
    [parcelsQ.data, ordersQ.data, batchesQ.data, boxesQ.data, declaredQ.data],
  );

  // Typing stays instant; the list follows a moment behind on a slow phone.
  const deferredQuery = useDeferredValue(query);
  const parsed = useMemo(() => parseSearch(deferredQuery), [deferredQuery]);
  const matches = useMemo(() => searchItems(index, parsed), [index, parsed]);
  const counts = useMemo(() => countByTab(matches), [matches]);
  const shown = useMemo(() => (tab ? matches.filter((i) => i.tab === tab) : matches), [matches, tab]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [parsed.key, parsed.text, tab]);

  useEffect(() => {
    if (submitted > 0) setRecents((current) => rememberSearch(query, current));
    // Only on Enter, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted]);

  // ── The server, only when nothing loaded holds the number ──────────────
  // An older parcel than the list carries, an order not in it, or a parcel
  // nobody has claimed. Asked once the typing pauses.
  const loaded = parcelsQ.isSuccess;
  const wanted = loaded && shouldAskServer(parsed, matches.length) ? cleanTrackingPaste(deferredQuery).slice(0, 100) : "";
  const asked = useDebouncedValue(wanted, 400);
  const askServer = asked.length >= 5 && asked === wanted;
  const serverOptions = { enabled: askServer, retry: false, staleTime: 30_000 } as const;
  const serverParcelQ = trpc.customerPortal.searchPackage.useQuery({ trackingNumber: asked || "-" }, serverOptions);
  const serverOrderQ = trpc.customerPortal.searchOrder.useQuery({ query: asked || "-" }, serverOptions);
  const serverExtraQ = trpc.customerPortal.searchTrackingExtra.useQuery({ trackingNumber: asked || "-" }, serverOptions);
  const waitingForServer =
    wanted.length > 0 && (!askServer || serverParcelQ.isFetching || serverOrderQ.isFetching || serverExtraQ.isFetching);

  const serverItems = useMemo(() => {
    if (!askServer) return [];
    const found = serverParcelQ.data;
    const order = serverOrderQ.data;
    return buildSearchIndex({
      parcels: found ? [found] : [],
      orders: [...(order ? [order] : []), ...(ordersQ.data ?? [])],
      batches: batchesQ.data,
      boxes: boxesQ.data,
    }).filter((i) => i.kind === "parcel" || (i.kind === "order" && i.id === order?.id));
  }, [askServer, serverParcelQ.data, serverOrderQ.data, ordersQ.data, batchesQ.data, boxesQ.data]);
  const unclaimed = askServer ? serverExtraQ.data?.unclaimed ?? null : null;

  const open = (item: SearchItem) => {
    if (parsed.active) setRecents((current) => rememberSearch(query, current));
    const href = searchTarget(item, { boxReceipts });
    // Either way a step the phone's Back undoes: a page of its own, or the
    // details rising over the answers.
    if (href) view.leave(href);
    else view.openDetail(item.key);
  };

  // The open details, found by key — which is all a history entry remembers.
  // Kept a moment after closing so the sheet can slide away.
  const detailItem = useMemo(
    () =>
      view.detail
        ? index.find((i) => i.key === view.detail) ?? serverItems.find((i) => i.key === view.detail) ?? null
        : null,
    [view.detail, index, serverItems],
  );
  const [closingItem, setClosingItem] = useState<SearchItem | null>(null);
  useEffect(() => {
    if (detailItem) setClosingItem(detailItem);
  }, [detailItem]);
  const drawerItem = detailItem ?? closingItem;

  const registerHref = parsed.key.length >= 5 ? `/portal/declare?tracking=${encodeURIComponent(cleanTrackingPaste(query))}` : "/portal/declare";

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const renderCards = (items: SearchItem[]) => (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = KIND_ICON[item.kind];
        const thumb = item.parcel ? images.resolve(item.parcel).url ?? item.image : item.image;
        const words = searchStatusWords(item);
        return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => open(item)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-start shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                <Icon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                {thumb && (
                  <img
                    src={thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={onImageError}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                {/* The number reads left to right; the line it sits on keeps the
                    page's direction, so it lines up with the words below it. */}
                <span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                  <bdi dir="ltr" className="font-mono tracking-wide">{item.title}</bdi>
                </span>
                {item.subtitle && (
                  <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</span>
                )}
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <PortalChip tone={searchStatusTone(item)} className="px-2 py-0.5 text-[11px]">
                    {words ? L(words) : "—"}
                  </PortalChip>
                  {item.date && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {L(SEARCH_DATE_LABEL[item.dateKind])}{" "}
                      <bdi dir="ltr" className="tabular-nums">
                        {formatPortalDate(item.date, language)}
                      </bdi>
                    </span>
                  )}
                </span>
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
            </button>
          </li>
        );
      })}
    </ul>
  );

  const body = (() => {
    if (parcelsQ.isError) {
      return <PortalErrorState onRetry={() => void parcelsQ.refetch()} isRetrying={parcelsQ.isFetching} />;
    }
    if (parcelsQ.isLoading) return <PortalSearchResultsSkeleton tabs={false} />;

    if (shown.length > 0) {
      const visible = shown.slice(0, limit);
      return (
        <div className="space-y-2">
          {parsed.active && (
            <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
              {L({ ku: "ئەنجام", en: "results", ar: "نتيجة", zh: "个结果" })}:{" "}
              <bdi dir="ltr" className="font-semibold tabular-nums">{shown.length}</bdi>
            </p>
          )}
          {renderCards(visible)}
          {shown.length > visible.length && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {L({ ku: "زیاتر پیشان بدە", en: "Show more", ar: "عرض المزيد", zh: "显示更多" })}{" "}
              <bdi dir="ltr" className="tabular-nums">({shown.length - visible.length})</bdi>
            </button>
          )}
        </div>
      );
    }

    // Found, but under another tab than the one chosen.
    if (matches.length > 0 && tab) {
      return (
        <PortalEmptyState
          compact
          icon={SearchX}
          title={L({
            ku: "لەم بەشەدا هیچ نییە",
            en: "Nothing under this tab",
            ar: "لا شيء في هذا القسم",
            zh: "此分类下没有结果",
          })}
          action={
            <button
              type="button"
              onClick={() => setTab(null)}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
            >
              {L({ ku: "هەموو ئەنجامەکان", en: "All results", ar: "كل النتائج", zh: "全部结果" })}{" "}
              <bdi dir="ltr" className="tabular-nums">({matches.length})</bdi>
            </button>
          }
        />
      );
    }

    if (!parsed.active) {
      return (
        <PortalEmptyState
          icon={Package}
          title={L({ ku: "هێشتا هیچ بارێکت نییە", en: "No parcels yet", ar: "لا توجد طرود بعد", zh: "还没有包裹" })}
          hint={L({
            ku: "کاتێک بارەکەت گەیشتە کۆگاکەمان، لێرە دەردەکەوێت.",
            en: "Your parcels appear here once they reach our depot.",
            ar: "تظهر طرودك هنا عند وصولها إلى مستودعنا.",
            zh: "包裹到达我们的仓库后会显示在这里。",
          })}
          action={
            <button
              type="button"
              onClick={() => view.leave("/portal/declare")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {L({ ku: "تۆمارکردنی تراک", en: "Register a tracking", ar: "تسجيل رقم تتبع", zh: "登记运单号" })}
            </button>
          }
        />
      );
    }

    if (waitingForServer) return <PortalSearchResultsSkeleton rows={1} tabs={false} />;

    if (askServer && serverParcelQ.isError && serverOrderQ.isError) {
      return (
        <PortalErrorState
          onRetry={() => {
            void serverParcelQ.refetch();
            void serverOrderQ.refetch();
            void serverExtraQ.refetch();
          }}
          isRetrying={serverParcelQ.isFetching}
        />
      );
    }

    if (serverItems.length > 0) return renderCards(serverItems);

    if (unclaimed) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertTriangle className="mx-auto h-9 w-9 text-amber-500 dark:text-amber-400" />
          <p className="mt-2 font-bold text-slate-800 dark:text-slate-100">
            {L({ ku: "ئەم پاکەتە بێ‌خاوەنە", en: "This package is unclaimed", ar: "هذا الطرد بلا صاحب", zh: "此包裹无主" })}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {L({
              ku: "ئەگەر هی تۆیە، داوای خاوەنداری بکە و بەڵگە بنێرە",
              en: "If it's yours, submit a claim with proof",
              ar: "إذا كان لك، قدّم مطالبة مع الإثبات",
              zh: "如果是您的，请提交认领并附凭证",
            })}
          </p>
          <p className="mt-2 font-mono text-sm text-slate-700 dark:text-slate-200">
            <bdi dir="ltr">{unclaimed.trackingNumber || unclaimed.packageCode}</bdi>
          </p>
          <button
            type="button"
            onClick={() => view.leave("/portal/no-mark")}
            className="mt-3 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {L({ ku: "داواکاری خاوەنداری", en: "Claim ownership", ar: "المطالبة بالملكية", zh: "认领所有权" })}
          </button>
        </div>
      );
    }

    return (
      <PortalEmptyState
        icon={SearchX}
        title={L({ ku: "هیچ نەدۆزرایەوە", en: "Nothing found", ar: "لم يتم العثور على شيء", zh: "未找到任何结果" })}
        hint={L({
          ku: "ژمارەکە بپشکنە. ئەگەر تازە کڕیوتە، تراکەکەی تۆمار بکە تا کاتی گەیشتن بزانین هی تۆیە.",
          en: "Check the number. Just bought it? Register the tracking so we know it is yours when it arrives.",
          ar: "تحقق من الرقم. اشتريته للتو؟ سجّل رقم التتبع لنعرف أنه لك عند وصوله.",
          zh: "请检查号码。刚购买？请登记运单号，到货时我们就知道是您的。",
        })}
        action={
          <button
            type="button"
            onClick={() => view.leave(registerHref)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {L({ ku: "تۆمارکردنی ئەم تراکە", en: "Register this tracking", ar: "تسجيل رقم التتبع هذا", zh: "登记此运单号" })}
          </button>
        }
      />
    );
  })();

  return (
    <div className="space-y-3 px-4 pt-3">
      {/* The three stages, each with how many answers sit under it. A tab
          with none stays in view — the zero is the answer — but cannot be
          chosen; the chosen one can always be tapped off again. */}
      <div
        role="group"
        aria-label={L({ ku: "دۆخی بارەکان", en: "Parcel stage", ar: "مرحلة الطرد", zh: "包裹阶段" })}
        className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/70"
      >
        {SEARCH_TABS.map((id) => {
          const isActive = tab === id;
          const count = counts[id];
          const isEmpty = count === 0 && !isActive;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              disabled={isEmpty}
              onClick={() => setTab(isActive ? null : id)}
              className={cn(
                "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition",
                isActive
                  ? "bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
                  : "hover:bg-white/60 dark:hover:bg-slate-900/40",
                isEmpty && "opacity-45",
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", SEARCH_TAB_DOT[id])} />
                {L(SEARCH_TAB_LABEL[id])}
              </span>
              <span dir="ltr" className="text-lg font-bold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                {parcelsQ.isLoading ? "–" : count}
              </span>
            </button>
          );
        })}
      </div>

      {!parsed.active && recents.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {L({ ku: "دواین گەڕانەکان", en: "Recent searches", ar: "عمليات البحث الأخيرة", zh: "最近搜索" })}
            </span>
            <button
              type="button"
              onClick={() => {
                clearRecentSearches();
                setRecents([]);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {L({ ku: "پاککردنەوە", en: "Clear", ar: "مسح", zh: "清除" })}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => view.setQuery(q)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Clock className="h-3 w-3 opacity-60" />
                <bdi className="font-mono">{q}</bdi>
              </button>
            ))}
          </div>
        </div>
      )}

      {body}

      {!parsed.active && index.length > 0 && (
        <button
          type="button"
          onClick={() => view.leave("/portal/declare")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-blue-700 dark:border-slate-600 dark:text-blue-300"
        >
          <PackagePlus className="h-4 w-4" />
          {L({ ku: "تۆمارکردنی تراکی نوێ", en: "Register a new tracking", ar: "تسجيل رقم تتبع جديد", zh: "登记新运单号" })}
        </button>
      )}

      {drawerItem && (
        <PortalSearchDetail
          item={drawerItem}
          open={!!detailItem}
          chip={{ tone: searchStatusTone(drawerItem), words: searchStatusWords(drawerItem) }}
          boxReceipts={boxReceipts}
          onRequestClose={view.closeDetail}
          onClosed={() => setClosingItem(null)}
          onNavigate={view.leave}
        />
      )}
    </div>
  );
}
