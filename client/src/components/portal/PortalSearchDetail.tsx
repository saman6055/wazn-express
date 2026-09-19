import type { ReactNode } from "react";
import { Boxes, Calendar, Copy, Hash, MapPin, Receipt, Ruler, Scale, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/copyText";
import { onImageError } from "@/lib/imageFallback";
import { fmtCbm, fmtKg } from "@/lib/portalFormat";
import { formatPortalDate } from "@/lib/portalClock";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";
import { PackageThumb, usePackageImages } from "@/components/portal/PackageThumb";
import { PackageTrackingTimeline } from "@/components/portal/PackageTrackingTimeline";
import { PortalChip } from "@/components/portal/PortalStatusChip";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { PARCEL_NEXT_STEP, SEARCH_DATE_LABEL, type SearchItem } from "@/lib/portalSearch";

type Words = { ku: string; en: string; ar: string; zh: string };

interface Fact {
  key: string;
  icon: LucideIcon;
  label: Words;
  value: ReactNode;
}

/**
 * One answer, opened from the bottom of the screen — for a parcel that has
 * no page of its own to go to.
 *
 * What a customer asks about a parcel, in the order they ask it: how heavy,
 * which shipment, what it is, where it is now, and what to do next. The
 * journey with its dates comes last, fetched only now that it was asked for.
 */
export default function PortalSearchDetail({
  item,
  open,
  chip,
  boxReceipts,
  onRequestClose,
  onClosed,
  onNavigate,
}: {
  item: SearchItem;
  /**
   * Whether the details are the current step. Opening and closing belong to
   * the phone's history, so Back closes this sheet and nothing more.
   */
  open: boolean;
  /** The card's own chip, so the sheet says the same thing the card did. */
  chip: { tone: string; words: Words | null };
  boxReceipts: boolean;
  /** A swipe down, a tap outside, Escape: take the step back. */
  onRequestClose: () => void;
  /** The slide away has finished. */
  onClosed: () => void;
  onNavigate: (href: string) => void;
}) {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const L = (words: Words) => pickLang(language, words);

  const parcel = item.kind === "parcel" ? item.parcel : undefined;
  const lookup = String(parcel?.trackingNumber || parcel?.packageCode || "");
  // Where it was registered decides the journey drawn — a parcel registered
  // in Erbil never passed through the China warehouse — and only the server
  // knows which countries are the origin.
  const journeyQ = trpc.customerPortal.searchPackage.useQuery(
    { trackingNumber: lookup || "-" },
    { enabled: !!parcel && !!lookup, staleTime: 60_000, retry: false },
  );
  const eventsQ = trpc.customerPortal.getPackageTimeline.useQuery(
    { packageId: item.id },
    { enabled: !!parcel, staleTime: 60_000, retry: false },
  );
  const images = usePackageImages();

  const statusWords = chip.words ? L(chip.words) : "—";
  const concealed = parcel?.sizeConcealed === true;
  const shippingType = String(parcel?.shippingType ?? item.batch?.shippingType ?? "");
  const productName = item.order?.productName || parcel?.description || item.subtitle;

  const facts: Fact[] = [];
  if (parcel && !concealed && Number(parcel.weightKg) > 0) {
    facts.push({
      key: "weight",
      icon: Scale,
      label: { ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" },
      value: <bdi dir="ltr">{fmtKg(parcel.weightKg)}</bdi>,
    });
  }
  if (parcel && !concealed && shippingType === "sea" && Number(parcel.volumeCbm) > 0) {
    facts.push({
      key: "volume",
      icon: Ruler,
      label: { ku: "قەبارە", en: "Volume", ar: "الحجم", zh: "体积" },
      value: <bdi dir="ltr">{fmtCbm(parcel.volumeCbm)}</bdi>,
    });
  }
  if (item.batch?.batchCode) {
    facts.push({
      key: "batch",
      icon: Truck,
      label: { ku: "بار", en: "Shipment", ar: "الشحنة", zh: "货运" },
      value: <bdi dir="ltr" className="font-mono">{item.batch.batchCode}</bdi>,
    });
  }
  if (productName && item.kind !== "box") {
    facts.push({
      key: "product",
      icon: ShoppingBag,
      label: { ku: "کاڵا", en: "Product", ar: "المنتج", zh: "商品" },
      value: productName,
    });
  }
  facts.push({
    key: "now",
    icon: MapPin,
    label: { ku: "ئێستا لە کوێیە", en: "Where it is now", ar: "أين هو الآن", zh: "当前位置" },
    value: statusWords,
  });
  if (item.tab === "onTheWay" && item.batch?.estimatedArrival) {
    facts.push({
      key: "eta",
      icon: Calendar,
      label: { ku: "گەیشتنی چاوەڕوانکراو", en: "Expected", ar: "الوصول المتوقع", zh: "预计到达" },
      value: <bdi dir="ltr">{formatPortalDate(item.batch.estimatedArrival, language)}</bdi>,
    });
  }
  if (SHIPPING_TYPE_LABEL[shippingType]) {
    facts.push({
      key: "shipping",
      icon: Truck,
      label: { ku: "جۆری ناردن", en: "Shipping", ar: "نوع الشحن", zh: "运输方式" },
      value: L(SHIPPING_TYPE_LABEL[shippingType]),
    });
  }
  if (item.kind === "box" && item.box) {
    facts.push({
      key: "parcels",
      icon: Hash,
      label: { ku: "ژمارەی پاکەت", en: "Parcels", ar: "عدد الطرود", zh: "包裹数" },
      value: <bdi dir="ltr" className="tabular-nums">{item.box.totalPackages ?? item.box.packageIds?.length ?? 0}</bdi>,
    });
  }
  if (item.date) {
    facts.push({
      key: "date",
      icon: Calendar,
      // The same word the card put before this date.
      label: SEARCH_DATE_LABEL[item.dateKind],
      value: <bdi dir="ltr">{formatPortalDate(item.date, language)}</bdi>,
    });
  }

  const note = parcel ? PARCEL_NEXT_STEP[item.status] : undefined;
  const ready = item.status === "ready_for_delivery";

  const thumb = parcel ? (
    <PackageThumb resolved={images.resolve(parcel)} language={language} size={64} showBadge={false} />
  ) : (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
      {item.kind === "box" ? (
        <Boxes className="h-7 w-7 text-slate-400 dark:text-slate-500" />
      ) : (
        <ShoppingBag className="h-7 w-7 text-slate-400 dark:text-slate-500" />
      )}
      {item.image && (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onImageError}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );

  const copy = async () => {
    const ok = await copyText(item.title);
    if (ok) toast.success(L({ ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
  };

  const actionClass =
    "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <Drawer
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onRequestClose();
      }}
      onAnimationEnd={(isOpen) => {
        if (!isOpen) onClosed();
      }}
    >
      <DrawerContent className="max-h-[90dvh]">
        <div dir={isRTL ? "rtl" : "ltr"} data-wa-capture className="flex min-h-0 flex-1 flex-col text-start">
          <div className="flex shrink-0 items-start gap-3 px-4 pb-3 pt-3">
            {thumb}
            <div className="min-w-0 flex-1">
              <DrawerTitle className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">
                <bdi dir="ltr" className="font-mono tracking-wide">{item.title}</bdi>
              </DrawerTitle>
              <DrawerDescription className="sr-only">{statusWords}</DrawerDescription>
              <div className="mt-1.5">
                <PortalChip tone={chip.tone}>{statusWords}</PortalChip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label={L({ ku: "کۆپیکردنی ژمارە", en: "Copy number", ar: "نسخ الرقم", zh: "复制号码" })}
              className="relative tap-44 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-95 dark:bg-slate-800 dark:text-slate-300"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <dl className="grid grid-cols-2 gap-2">
              {facts.map((fact) => (
                <div key={fact.key} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <fact.icon className="h-3.5 w-3.5 shrink-0" />
                    {L(fact.label)}
                  </dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{fact.value}</dd>
                </div>
              ))}
            </dl>

            {note && (
              <p
                className={cn(
                  "rounded-xl border p-3 text-sm leading-relaxed",
                  ready
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
                )}
              >
                {L(note)}
              </p>
            )}

            {(item.batchId != null || (boxReceipts && item.boxId != null)) && (
              <div className="grid grid-cols-2 gap-2">
                {item.batchId != null && (
                  <button type="button" onClick={() => onNavigate(`/portal/shipments/${item.batchId}`)} className={actionClass}>
                    <Truck className="h-4 w-4" />
                    {L({ ku: "بینینی بار", en: "Open shipment", ar: "عرض الشحنة", zh: "查看货运" })}
                  </button>
                )}
                {boxReceipts && item.boxId != null && (
                  <button
                    type="button"
                    onClick={() => onNavigate(`/portal/financial?tab=boxes&box=${item.boxId}`)}
                    className={actionClass}
                  >
                    <Receipt className="h-4 w-4" />
                    {L({ ku: "پسووڵەی سندوق", en: "Box receipt", ar: "إيصال الصندوق", zh: "箱子收据" })}
                  </button>
                )}
              </div>
            )}

            {parcel && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {L({ ku: "شوێنکەوتنی بار", en: "Tracking progress", ar: "تتبّع الشحنة", zh: "运输进度" })}
                </h3>
                {journeyQ.isLoading || eventsQ.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <PackageTrackingTimeline
                    currentStatus={item.status}
                    events={eventsQ.data ?? []}
                    estimatedDelivery={
                      item.batch?.estimatedArrival ? new Date(item.batch.estimatedArrival).toISOString() : null
                    }
                    language={language}
                    registeredAtOrigin={journeyQ.data?.registeredAtOrigin ?? null}
                  />
                )}
              </section>
            )}

            <WhatsAppHelpButton
              language={language}
              section={L({ ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" })}
              details={[
                [{ ku: "تراکینگ", en: "Tracking", ar: "رقم التتبع", zh: "运单号" }, item.title],
                [{ ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" }, statusWords],
                [{ ku: "بار", en: "Shipment", ar: "الشحنة", zh: "货运" }, item.batch?.batchCode],
                [{ ku: "کاڵا", en: "Product", ar: "المنتج", zh: "商品" }, item.kind === "box" ? null : productName],
              ]}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
