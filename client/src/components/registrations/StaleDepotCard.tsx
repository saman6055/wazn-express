import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Warehouse, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { RISK_BORDER, RISK_CHIP, RISK_ICON, RISK_STRIPE } from "@/lib/riskStyle";
import { staleDepotLevel, worstLevel, STALE_IN_DEPOT_CRITICAL_DAYS, RISK_LEVEL_LABEL } from "@shared/riskRules";
import { customerCodeOnly } from "@shared/customerCode";
import { buildWhatsAppLink } from "@shared/volumetricAlert";
import { AlertParcelSheet, type AlertParcel } from "@/components/registrations/AlertParcelSheet";

type L = { ku: string; en: string; ar: string; zh: string };

type Stale = {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  customerMobile: string | null;
  shippingType: string;
  weightKg: string | null;
  volumeCbm: string | null;
  registeredAt: Date | string | null;
  daysInDepot: number;
};

/** Where the whole list lives: this card on the registrations page, opened out. */
export const STALE_ALERT_HREF = "/packages/registrations?alert=stale";

/** An opening line for the customer about their waiting parcel; the office writes the rest. */
function staleMessage(r: Stale): string {
  return [`سڵاو ${r.customerName ?? ""}،`.replace(" ،", "،"), `دەربارەی پاکەتەکەت ${r.trackingNumber || r.packageCode} کە لە کۆگاکەمانی چینە:`].join("\n");
}

/**
 * Parcels on the China shelf that no batch has picked up.
 *
 * A registration that never joins a batch never ships. Nothing surfaced that,
 * so a forgotten box could sit for a month while the customer waited and the
 * office assumed it was on its way. Silent when there is nothing to report —
 * a card that is always on screen stops being read.
 *
 * Every part of it leads somewhere (owner, 2026-09-16): the customer to their
 * page, the tracking and the days to the parcel's details, the title and the
 * count to the whole list. On the dashboard it shows the worst three and a
 * way to all of them.
 */
export function StaleDepotCard({ className, variant = "page" }: { className?: string; variant?: "page" | "dashboard" }) {
  const { language } = useLanguage();
  const label = (v: L) => pickLang(language, v);
  const isRTL = language === "ku" || language === "ar";
  const { canViewPath } = usePermissions();
  const search = useSearch();
  const focused = variant === "page" && new URLSearchParams(search).get("alert") === "stale";

  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.packages.staleInDepot.useQuery(undefined, {
    staleTime: 300_000,
    retry: false,
  });
  const rows = (data ?? []) as Stale[];

  // Arriving from the dashboard or the bell: the whole list, brought into view.
  useEffect(() => {
    if (!focused || rows.length === 0) return;
    setShowAll(true);
    // Again once the cards above have finished loading and pushed it down.
    const timers = [0, 300, 900].map((ms) =>
      window.setTimeout(() => cardRef.current?.scrollIntoView({ block: "start" }), ms),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [focused, rows.length]);

  if (isLoading) return <Skeleton className={cn("h-40 w-full rounded-2xl", className)} />;
  if (rows.length === 0) return null;

  const oldest = rows[0]?.daysInDepot ?? 0;
  const worst = worstLevel(rows.map((r) => staleDepotLevel(r.daysInDepot))) ?? "high";
  const critical = rows.filter((r) => staleDepotLevel(r.daysInDepot) === "critical").length;
  const limit = variant === "dashboard" ? 3 : 4;
  const shown = showAll && variant === "page" ? rows : rows.slice(0, limit);
  const canList = canViewPath("/packages/registrations");
  const canCustomers = canViewPath("/customers");
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
        weightKg: open.weightKg,
        daysInDepot: open.daysInDepot,
      }
    : null;

  const title = label({
    ku: "لە کۆگای چین ماونەتەوە",
    en: "Stuck in the China warehouse",
    ar: "عالقة في مستودع الصين",
    zh: "滞留在中国仓库",
  });

  return (
    <Card ref={cardRef} className={cn("overflow-hidden rounded-2xl scroll-mt-20", RISK_BORDER[worst], focused && "ring-2 ring-red-400/60", className)}>
      <div className={cn("h-1", RISK_STRIPE[worst])} />
      <CardContent className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Warehouse className={cn("h-5 w-5", RISK_ICON[worst])} />
          {variant === "dashboard" && canList ? (
            <Link href={STALE_ALERT_HREF} className="font-bold hover:underline">
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
            ku: `${rows.length} پارچە تۆمار کراون بەڵام نەخراونەتە ناو هیچ بارێک — کۆنترینیان ${oldest} ڕۆژە`,
            en: `${rows.length} parcel(s) registered but in no batch — the oldest has waited ${oldest} days`,
            ar: `${rows.length} طرد مسجّل دون إدراجه في أي دفعة — أقدمها ${oldest} يوماً`,
            zh: `${rows.length} 个包裹已登记但未入任何批次 — 最久的已 ${oldest} 天`,
          })}
          {critical > 0 &&
            label({
              ku: ` · ${critical}یان زیاتر لە ${STALE_IN_DEPOT_CRITICAL_DAYS} ڕۆژ`,
              en: ` · ${critical} over ${STALE_IN_DEPOT_CRITICAL_DAYS} days`,
              ar: ` · ${critical} منها أكثر من ${STALE_IN_DEPOT_CRITICAL_DAYS} يوماً`,
              zh: ` · 其中 ${critical} 个超过 ${STALE_IN_DEPOT_CRITICAL_DAYS} 天`,
            })}
        </p>

        <div className="space-y-1.5">
          {shown.map((r) => {
            const level = staleDepotLevel(r.daysInDepot);
            const code = customerCodeOnly(r.customerCode) || "—";
            const customer = (
              <>
                <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] text-blue-900 dark:bg-blue-950/50 dark:text-blue-100">
                  {code}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{r.customerName ?? "—"}</span>
              </>
            );
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                {canCustomers && r.customerId ? (
                  <Link href={`/customers/${r.customerId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                    {customer}
                  </Link>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-2">{customer}</span>
                )}
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="shrink-0 font-mono text-[11px] text-sky-700 hover:underline dark:text-sky-300"
                  dir="ltr"
                >
                  {r.trackingNumber ?? r.packageCode}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  title={label(RISK_LEVEL_LABEL[level])}
                  className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", RISK_CHIP[level])}
                >
                  <Clock className="h-3 w-3" />
                  <span dir="ltr">{r.daysInDepot}</span>
                </button>
              </div>
            );
          })}
        </div>

        {rows.length > limit &&
          (variant === "dashboard" ? (
            canList && (
              <Link href={STALE_ALERT_HREF} className="mt-2 flex items-center justify-center gap-1 text-[11.5px] font-medium text-sky-600 hover:underline dark:text-sky-400">
                {label({
                  ku: `بینینی هەموو ${rows.length} پاکەتەکە`,
                  en: `See all ${rows.length} parcels`,
                  ar: `عرض كل الطرود الـ ${rows.length}`,
                  zh: `查看全部 ${rows.length} 个包裹`,
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
        kind="stale"
        level={open ? staleDepotLevel(open.daysInDepot) : "high"}
        whatsappHref={open ? buildWhatsAppLink(open.customerMobile, staleMessage(open)) : null}
        onClose={() => setOpenId(null)}
      />
    </Card>
  );
}
