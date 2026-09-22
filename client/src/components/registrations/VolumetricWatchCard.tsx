import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, MessageCircle, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { buildVolumetricMessage, buildWhatsAppLink } from "@shared/volumetricAlert";
import { usePermissions } from "@/hooks/usePermissions";
import { RISK_BORDER, RISK_CHIP, RISK_ICON, RISK_STRIPE } from "@/lib/riskStyle";
import { volumetricLevel, worstLevel, VOLUMETRIC_CRITICAL_RATIO, RISK_LEVEL_LABEL } from "@shared/riskRules";
import { customerCodeOnly } from "@shared/customerCode";
import { CopyButton } from "@/components/CopyButton";
import { OrderNumbers } from "@/components/OrderNumbers";
import { AlertParcelSheet, type AlertParcel } from "@/components/registrations/AlertParcelSheet";
import type { ParcelOrderRef } from "@shared/parcelSource";

type L = { ku: string; en: string; ar: string; zh: string };

const COPY_CODE: L = { ku: "کۆپی کۆدی کڕیار", en: "Copy customer code", ar: "نسخ رمز العميل", zh: "复制客户编号" };
const COPY_TRACKING: L = { ku: "کۆپی تراکینگ", en: "Copy tracking number", ar: "نسخ رقم التتبع", zh: "复制运单号" };
const OPEN_PARCEL: L = { ku: "کردنەوەی پاکەت", en: "Open parcel", ar: "فتح الطرد", zh: "打开包裹" };

type Parcel = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  customerMobile: string | null;
  shippingType: string;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  registeredAt: Date | string | null;
  batchId: number | null;
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  extraKg: number;
  ratio: number;
  divisor: number;
  acknowledgedAt: string | Date | null;
  orderNumbers?: string[];
  /** The orders it belongs to: each number is then a door to its order. */
  orders?: ParcelOrderRef[];
};

/** Where the whole list lives: this card on the registrations page, opened out. */
export const VOLUMETRIC_ALERT_HREF = "/packages/registrations?alert=volumetric";

const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

function waLinkFor(r: Parcel): string | null {
  return buildWhatsAppLink(
    r.customerMobile,
    buildVolumetricMessage({
      customerName: r.customerName || "",
      trackingNumber: r.trackingNumber || r.packageCode,
      lengthCm: r.lengthCm,
      widthCm: r.widthCm,
      heightCm: r.heightCm,
      assessment: {
        actualKg: r.actualKg,
        volumetricKg: r.volumetricKg,
        chargeableKg: r.chargeableKg,
        extraKg: r.extraKg,
        ratio: r.ratio,
        divisor: r.divisor,
        billedOnVolume: true,
        alert: true,
      },
    }),
  );
}

/**
 * Every parcel currently billed on its size rather than its weight.
 *
 * Air sells space, so a light bulky carton is invoiced at several times what
 * the scale says. The customer weighed it themselves and will dispute the
 * invoice unless somebody explains first — and after the parcel ships is too
 * late. This is the standing list of those conversations, biggest gap first,
 * because that is the order in which they get difficult.
 *
 * Silent when there is nothing outstanding. A card that is always on screen
 * stops being read, and this one has to be read.
 *
 * Every part of it leads somewhere (owner, 2026-09-16): the customer to their
 * page, the tracking and the figures to the parcel's details, the title to
 * the whole list. On the dashboard it shows the biggest three.
 */
export function VolumetricWatchCard({ className, variant = "page" }: { className?: string; variant?: "page" | "dashboard" }) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);
  const isRTL = language === "ku" || language === "ar";
  const { canViewPath } = usePermissions();
  const search = useSearch();
  const focused = variant === "page" && new URLSearchParams(search).get("alert") === "volumetric";

  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.packages.volumetricParcels.useQuery(
    { pendingOnly: true },
    { staleTime: 120_000, retry: false },
  );
  const rows = (data ?? []) as Parcel[];

  const ack = trpc.packages.acknowledgeVolumetric.useMutation({
    onSuccess: () => {
      toast.success(label({
        ku: "تۆمار کرا کە لەگەڵ کڕیار چێک کراوەتەوە",
        en: "Recorded as checked with the customer",
        ar: "تم تسجيلها كمراجَعة مع العميل",
        zh: "已记录为与客户核实",
      }));
      setOpenId(null);
      utils.packages.volumetricParcels.invalidate();
      utils.packages.registrations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Arriving from the dashboard or the bell: the whole list, brought into view.
  useEffect(() => {
    if (!focused || rows.length === 0) return;
    setShowAll(true);
    // The page puts this card first when it is the one asked for, so nothing
    // above it loads late; the later passes only cover a slow first paint.
    const timers = [0, 300, 900].map((ms) =>
      window.setTimeout(() => cardRef.current?.scrollIntoView({ block: "start" }), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [focused, rows.length]);

  if (isLoading) return <Skeleton className={cn("h-44 w-full rounded-2xl", className)} />;
  if (rows.length === 0) return null;

  const limit = variant === "dashboard" ? 3 : 4;
  const shown = showAll && variant === "page" ? rows : rows.slice(0, limit);
  const totalExtra = rows.reduce((s, r) => s + r.extraKg, 0);
  const worst = worstLevel(rows.map((r) => volumetricLevel(r.ratio))) ?? "high";
  const critical = rows.filter((r) => volumetricLevel(r.ratio) === "critical").length;
  const canList = canViewPath("/packages/registrations");
  const Arrow = isRTL ? ChevronLeft : ChevronRight;

  const open = rows.find((r) => r.id === openId) ?? null;
  const openParcel: AlertParcel | null = open
    ? {
        id: open.id,
        packageCode: open.packageCode,
        trackingNumber: open.trackingNumber,
        customerId: open.customerId,
        customerName: open.customerName,
        customerCode: open.customerCode,
        customerMobile: open.customerMobile,
        shippingType: open.shippingType,
        registeredAt: open.registeredAt,
        batchId: open.batchId,
        lengthCm: open.lengthCm,
        widthCm: open.widthCm,
        heightCm: open.heightCm,
        actualKg: open.actualKg,
        chargeableKg: open.chargeableKg,
        extraKg: open.extraKg,
        ratio: open.ratio,
        orderNumbers: open.orderNumbers,
        orders: open.orders ?? [],
      }
    : null;

  const title = label({
    ku: "بارە قەبارەییەکان",
    en: "Volumetric parcels",
    ar: "الطرود الحجمية",
    zh: "体积重包裹",
  });

  return (
    <Card ref={cardRef} className={cn("overflow-hidden rounded-2xl scroll-mt-20", RISK_BORDER[worst], focused && "ring-2 ring-red-400/60", className)}>
      <div className={cn("h-1", RISK_STRIPE[worst])} />
      <CardContent className="pt-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <Scale className={cn("h-5 w-5", RISK_ICON[worst])} />
          {variant === "dashboard" && canList ? (
            <Link href={VOLUMETRIC_ALERT_HREF} className="font-bold hover:underline">
              {title}
            </Link>
          ) : (
            <h3 className="font-bold">{title}</h3>
          )}
          <span className={cn("rounded-lg px-2 py-0.5 text-xs font-medium", RISK_CHIP[worst])}>
            <bdi dir="ltr">{rows.length}</bdi>
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", RISK_CHIP[worst])}>
            {label(RISK_LEVEL_LABEL[worst])}
          </span>
        </div>

        <p className="mb-3 text-xs text-muted-foreground">
          {label({
            ku: `${rows.length} بار لەسەر قەبارە حساب دەکرێن — بە کۆی ${kg(totalExtra)} kg زیادە. هێشتا لەگەڵ کڕیار چێک نەکراونەتەوە.`,
            en: `${rows.length} parcel(s) billed on volume — ${kg(totalExtra)} kg extra in total. Not yet checked with the customer.`,
            ar: `${rows.length} طرد يُحتسب على الحجم — بزيادة ${kg(totalExtra)} kg إجمالاً. لم تُراجَع مع العميل بعد.`,
            zh: `${rows.length} 个包裹按体积计费 — 合计多出 ${kg(totalExtra)} kg。尚未与客户核实。`,
          })}
          {critical > 0 &&
            label({
              ku: ` ${critical}یان ×${VOLUMETRIC_CRITICAL_RATIO} یان زیاترن.`,
              en: ` ${critical} at ×${VOLUMETRIC_CRITICAL_RATIO} or more.`,
              ar: ` ${critical} منها ×${VOLUMETRIC_CRITICAL_RATIO} أو أكثر.`,
              zh: ` 其中 ${critical} 个达到 ×${VOLUMETRIC_CRITICAL_RATIO} 或以上。`,
            })}
        </p>

        <div className="space-y-1.5">
          {shown.map((r) => {
            const level = volumetricLevel(r.ratio);
            const waLink = waLinkFor(r);
            const rawCode = customerCodeOnly(r.customerCode);
            const reference = r.trackingNumber ?? r.packageCode;

            return (
              <div key={r.id} className="relative rounded-xl border border-red-200 bg-red-50/40 px-3 py-2 transition-colors hover:bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/20 dark:hover:bg-red-950/40">
                {/* The whole row opens the parcel itself (owner, 2026-09-17);
                    only the copy, message and "checked" controls sit above it. */}
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  aria-label={`${label(OPEN_PARCEL)} ${reference}`}
                  className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
                    {rawCode || "—"}
                  </span>
                  <CopyButton value={rawCode} label={label(COPY_CODE)} className="relative z-10" />
                  <span className="min-w-0 flex-1 truncate text-xs">{r.customerName ?? "—"}</span>
                  <bdi dir="ltr" className="shrink-0 font-mono text-[11px] text-sky-700 dark:text-sky-300">
                    {reference}
                  </bdi>
                  <CopyButton value={r.trackingNumber ?? r.packageCode} label={label(COPY_TRACKING)} className="relative z-10" />
                </div>

                {/* The platform order number staff check with the customer by
                    (owner, 2026-09-17). */}
                <OrderNumbers numbers={r.orderNumbers} orders={r.orders} className="mt-1 flex" copyClassName="relative z-10" />

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]" dir="ltr">
                  <span className="flex items-center gap-3">
                    <span><span className="text-muted-foreground">actual</span> {kg(r.actualKg)}</span>
                    <span className="font-medium"><span className="text-muted-foreground">charged</span> {kg(r.chargeableKg)}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5", RISK_CHIP[level])}>
                      <AlertTriangle className="h-3 w-3" />
                      +{kg(r.extraKg)} kg · ×{r.ratio.toFixed(2)}
                    </span>
                  </span>

                  <span className="relative z-10 ms-auto flex items-center gap-1.5">
                    {waLink && (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2 py-0.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        <MessageCircle className="h-3 w-3" />
                        {label({ ku: "پەیام", en: "Draft", ar: "رسالة", zh: "消息" })}
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={ack.isPending}
                      onClick={() => ack.mutate({ packageId: r.id })}
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-0.5 text-[11px] font-medium text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {label({ ku: "چێک کرا", en: "Checked", ar: "تمت", zh: "已核实" })}
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {rows.length > limit &&
          (variant === "dashboard" ? (
            canList && (
              <Link href={VOLUMETRIC_ALERT_HREF} className="mt-2 flex items-center justify-center gap-1 text-[11.5px] font-medium text-sky-600 hover:underline dark:text-sky-400">
                {label({
                  ku: `بینینی هەموو ${rows.length} بارە قەبارەییەکە`,
                  en: `See all ${rows.length} volumetric parcels`,
                  ar: `عرض كل الطرود الحجمية الـ ${rows.length}`,
                  zh: `查看全部 ${rows.length} 个体积重包裹`,
                })}
                <Arrow className="h-3.5 w-3.5" />
              </Link>
            )
          ) : (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 block w-full text-center text-[11.5px] font-medium text-sky-600 dark:text-sky-400"
            >
              {showAll
                ? label({ ku: "کەمکردنەوە", en: "Show less", ar: "عرض أقل", zh: "收起" })
                : label({
                    ku: `بینینی ${rows.length - limit}ی تر`,
                    en: `Show ${rows.length - limit} more`,
                    ar: `عرض ${rows.length - limit} أخرى`,
                    zh: `再显示 ${rows.length - limit} 个`,
                  })}
            </button>
          ))}
      </CardContent>

      <AlertParcelSheet
        parcel={openParcel}
        kind="volumetric"
        level={open ? volumetricLevel(open.ratio) : "high"}
        whatsappHref={open ? waLinkFor(open) : null}
        onClose={() => setOpenId(null)}
        onAcknowledge={open ? () => ack.mutate({ packageId: open.id }) : undefined}
        acknowledging={ack.isPending}
      />
    </Card>
  );
}
