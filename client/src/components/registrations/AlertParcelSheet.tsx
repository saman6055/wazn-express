import type { ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  History,
  ListFilter,
  MessageCircle,
  Package,
  Phone,
  Ruler,
  Scale,
  ScanLine,
  Truck,
  User,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/copyText";
import { fmtDate, fmtDateTime } from "@/lib/numericDate";
import { dedupePhotos } from "@/lib/photoList";
import { PACKAGE_STATUS_LABEL } from "@/lib/packageStatus";
import { SHIPPING_TYPE_LABEL } from "@/lib/shipmentFilters";
import { RISK_CHIP } from "@/lib/riskStyle";
import { usePermissions } from "@/hooks/usePermissions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { packagesHref } from "@shared/listLinks";
import { customerCodeOnly } from "@shared/customerCode";
import { RISK_LEVEL_LABEL, type RiskLevel } from "@shared/riskRules";

type Words = { ku: string; en: string; ar: string; zh: string };

/** One parcel an alert card is worried about — what the card already knows of it. */
export interface AlertParcel {
  id: number;
  packageCode: string;
  trackingNumber: string | null;
  customerId: number | null;
  customerName: string | null;
  customerCode: string | null;
  customerMobile: string | null;
  shippingType?: string | null;
  registeredAt?: Date | string | null;
  batchId?: number | null;
  weightKg?: string | null;
  lengthCm?: string | null;
  widthCm?: string | null;
  heightCm?: string | null;
  /** Stuck in the China warehouse: how long. */
  daysInDepot?: number;
  /** Billed on volume: the scale, the bill, the gap. */
  actualKg?: number;
  chargeableKg?: number;
  extraKg?: number;
  ratio?: number;
}

const kg = (n: number | string | null | undefined) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/\.?0+$/, "")} kg`;
};

const asDate = (value: Date | string | null | undefined) => (value ? new Date(value) : null);

/**
 * One parcel from an alert, opened: who it belongs to, what it weighs, how
 * long it has waited, what happened to it — and a way onward from each.
 *
 * The owner's word (2026-09-16): an alert is not a display, everything in it
 * leads somewhere. Every link here goes to the place that thing lives; every
 * action is one the office already takes elsewhere. Nothing here moves a
 * parcel into a batch by itself — that charges shipping on a priced batch,
 * so it stays on the scanner, where it is done on purpose.
 */
export function AlertParcelSheet({
  parcel,
  kind,
  level,
  whatsappHref,
  onClose,
  onAcknowledge,
  acknowledging,
}: {
  parcel: AlertParcel | null;
  kind: "stale" | "volumetric";
  level: RiskLevel;
  /** The message to the customer, already written by the card. */
  whatsappHref?: string | null;
  onClose: () => void;
  /** Volumetric only: record that the customer has been told. */
  onAcknowledge?: () => void;
  acknowledging?: boolean;
}) {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const L = (words: Words) => pickLang(language, words);
  const { canViewPath } = usePermissions();

  const open = parcel !== null;
  const id = parcel?.id ?? 0;
  const detailQ = trpc.packages.getById.useQuery({ id }, { enabled: open && id > 0, staleTime: 60_000, retry: false });
  const historyQ = trpc.scanning.getStatusHistory.useQuery(
    { packageId: id },
    { enabled: open && id > 0, staleTime: 60_000, retry: false },
  );

  const detail = detailQ.data as
    | { status?: string | null; description?: string | null; photos?: unknown; weightKg?: string | null }
    | null
    | undefined;
  const tracking = parcel?.trackingNumber || parcel?.packageCode || "";
  const code = customerCodeOnly(parcel?.customerCode);
  const photos = dedupePhotos(detail?.photos).slice(0, 6);
  const history = ((historyQ.data ?? []) as Array<{ id: number; toStatus: string; changedAt: Date | string }>).slice(0, 8);

  const canCustomers = canViewPath("/customers") && !!parcel?.customerId;
  const canParcels = canViewPath("/packages/all");
  const canBatches = canViewPath("/batches");
  const canScanner = canViewPath("/batch-assignment-scanner");

  const facts: Array<{ key: string; icon: typeof User; label: Words; value: ReactNode }> = [];
  if (parcel) {
    facts.push({
      key: "customer",
      icon: User,
      label: { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" },
      value: canCustomers ? (
        <Link href={`/customers/${parcel.customerId}`} className="text-sky-700 underline-offset-2 hover:underline dark:text-sky-300">
          {parcel.customerName ?? "—"} <bdi dir="ltr" className="font-mono text-xs">{code}</bdi>
        </Link>
      ) : (
        <span>
          {parcel.customerName ?? "—"} <bdi dir="ltr" className="font-mono text-xs">{code}</bdi>
        </span>
      ),
    });
    if (parcel.customerMobile) {
      facts.push({
        key: "mobile",
        icon: Phone,
        label: { ku: "مۆبایل", en: "Mobile", ar: "الهاتف", zh: "手机" },
        value: (
          <a href={`tel:${parcel.customerMobile}`} dir="ltr" className="font-mono text-sky-700 hover:underline dark:text-sky-300">
            {parcel.customerMobile}
          </a>
        ),
      });
    }
    if (parcel.registeredAt) {
      facts.push({
        key: "registered",
        icon: CalendarDays,
        label: { ku: "تۆمارکرا", en: "Registered", ar: "سُجّل", zh: "登记" },
        value: <bdi dir="ltr">{fmtDate(asDate(parcel.registeredAt)!)}</bdi>,
      });
    }
    if (kind === "stale" && parcel.daysInDepot != null) {
      facts.push({
        key: "days",
        icon: Clock,
        label: { ku: "لە کۆگای چین", en: "In the China warehouse", ar: "في مستودع الصين", zh: "在中国仓库" },
        value: (
          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", RISK_CHIP[level])}>
            <bdi dir="ltr">{parcel.daysInDepot}</bdi> {L({ ku: "ڕۆژ", en: "days", ar: "يوماً", zh: "天" })}
          </span>
        ),
      });
    }
    if (kind === "volumetric") {
      facts.push({
        key: "weights",
        icon: Scale,
        label: { ku: "کێشی تەرازوو ← حیساب", en: "Scale → billed", ar: "الميزان ← المحتسب", zh: "实重 → 计费" },
        value: (
          <bdi dir="ltr" className="font-mono">
            {kg(parcel.actualKg)} → {kg(parcel.chargeableKg)}
          </bdi>
        ),
      });
      facts.push({
        key: "extra",
        icon: Scale,
        label: { ku: "زیادە", en: "Extra", ar: "الزيادة", zh: "多出" },
        value: (
          <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold", RISK_CHIP[level])} dir="ltr">
            +{kg(parcel.extraKg)} · ×{(parcel.ratio ?? 0).toFixed(2)}
          </span>
        ),
      });
    } else if (Number(parcel.weightKg ?? detail?.weightKg) > 0) {
      facts.push({
        key: "weight",
        icon: Scale,
        label: { ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" },
        value: <bdi dir="ltr" className="font-mono">{kg(parcel.weightKg ?? detail?.weightKg)}</bdi>,
      });
    }
    if (parcel.lengthCm && parcel.widthCm && parcel.heightCm) {
      facts.push({
        key: "dims",
        icon: Ruler,
        label: { ku: "قەبارە", en: "Size", ar: "الأبعاد", zh: "尺寸" },
        value: (
          <bdi dir="ltr" className="font-mono">
            {Number(parcel.lengthCm)}×{Number(parcel.widthCm)}×{Number(parcel.heightCm)} cm
          </bdi>
        ),
      });
    }
    if (parcel.shippingType && SHIPPING_TYPE_LABEL[parcel.shippingType]) {
      facts.push({
        key: "shipping",
        icon: Truck,
        label: { ku: "جۆری ناردن", en: "Shipping", ar: "نوع الشحن", zh: "运输方式" },
        value: L(SHIPPING_TYPE_LABEL[parcel.shippingType]),
      });
    }
    if (detail?.status && PACKAGE_STATUS_LABEL[detail.status]) {
      facts.push({
        key: "status",
        icon: Package,
        label: { ku: "دۆخ", en: "Status", ar: "الحالة", zh: "状态" },
        value: L(PACKAGE_STATUS_LABEL[detail.status]),
      });
    }
    if (parcel.batchId) {
      facts.push({
        key: "batch",
        icon: Boxes,
        label: { ku: "بار", en: "Batch", ar: "الدفعة", zh: "批次" },
        value: canBatches ? (
          <Link href={`/batches?edit=${parcel.batchId}`} className="text-sky-700 hover:underline dark:text-sky-300">
            #{parcel.batchId}
          </Link>
        ) : (
          <span>#{parcel.batchId}</span>
        ),
      });
    }
  }

  const action =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition hover:bg-muted";

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side={isRTL ? "left" : "right"} dir={isRTL ? "rtl" : "ltr"} className="w-full overflow-y-auto sm:max-w-md">
        {parcel && (
          <>
            <SheetHeader className="text-start">
              <SheetTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 shrink-0" />
                <bdi dir="ltr" className="truncate font-mono">{tracking}</bdi>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(tracking)) toast.success(L({ ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
                  }}
                  aria-label={L({ ku: "کۆپیکردن", en: "Copy", ar: "نسخ", zh: "复制" })}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", RISK_CHIP[level])}>{L(RISK_LEVEL_LABEL[level])}</span>
                <span>
                  {kind === "stale"
                    ? L({ ku: "تۆمار کراوە بەڵام نەخراوەتە ناو هیچ بارێک", en: "Registered but in no batch", ar: "مسجّل دون إدراجه في أي دفعة", zh: "已登记但未入任何批次" })
                    : L({ ku: "لەسەر قەبارە حساب دەکرێت و هێشتا لەگەڵ کڕیار چێک نەکراوە", en: "Billed on volume, not yet checked with the customer", ar: "يُحتسب على الحجم ولم يُراجَع مع العميل", zh: "按体积计费，尚未与客户核实" })}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              <dl className="grid grid-cols-2 gap-2">
                {facts.map((fact) => (
                  <div key={fact.key} className="rounded-xl border p-2.5">
                    <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <fact.icon className="h-3.5 w-3.5 shrink-0" />
                      {L(fact.label)}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              {detail?.description && <p className="rounded-xl bg-muted/40 p-3 text-sm">{detail.description}</p>}

              {/* The way onward from here — each to where that job is done. */}
              <div className="grid grid-cols-2 gap-2">
                {canCustomers && (
                  <Link href={`/customers/${parcel.customerId}`} className={action}>
                    <User className="h-3.5 w-3.5" />
                    {L({ ku: "پەڕەی کڕیار", en: "Customer page", ar: "صفحة العميل", zh: "客户页面" })}
                  </Link>
                )}
                {canParcels && code && (
                  <Link href={packagesHref({ search: code })} className={action}>
                    <ListFilter className="h-3.5 w-3.5" />
                    {L({ ku: "هەموو پاکەتەکانی ئەم کڕیارە", en: "All this customer's parcels", ar: "كل طرود هذا العميل", zh: "该客户的全部包裹" })}
                  </Link>
                )}
                {canParcels && tracking && (
                  <Link href={packagesHref({ search: tracking })} className={action}>
                    <Package className="h-3.5 w-3.5" />
                    {L({ ku: "لە لیستی پاکەتەکان", en: "In the parcels list", ar: "في قائمة الطرود", zh: "在包裹列表中" })}
                  </Link>
                )}
                {kind === "stale" && canScanner && (
                  <Link href="/batch-assignment-scanner" className={action}>
                    <ScanLine className="h-3.5 w-3.5" />
                    {L({ ku: "بیخەرە ناو بار", en: "Put into a batch", ar: "أضِفه إلى دفعة", zh: "加入批次" })}
                  </Link>
                )}
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(action, "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300")}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {L({ ku: "پەیام بۆ کڕیار", en: "Message the customer", ar: "راسل العميل", zh: "给客户发消息" })}
                  </a>
                )}
                {kind === "volumetric" && onAcknowledge && (
                  <button
                    type="button"
                    disabled={acknowledging}
                    onClick={onAcknowledge}
                    className={cn(action, "border-red-300 text-red-800 disabled:opacity-50 dark:border-red-800 dark:text-red-200")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {L({ ku: "چێک کرا لەگەڵ کڕیار", en: "Checked with the customer", ar: "رُوجع مع العميل", zh: "已与客户核实" })}
                  </button>
                )}
              </div>

              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 overflow-hidden rounded-lg border">
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  {L({ ku: "مێژووی پاکەت", en: "Parcel history", ar: "سجل الطرد", zh: "包裹记录" })}
                </p>
                {historyQ.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {L({ ku: "هیچ گۆڕانکارییەک تۆمار نەکراوە", en: "No changes recorded", ar: "لا تغييرات مسجلة", zh: "暂无记录" })}
                  </p>
                ) : (
                  <ol className="space-y-1.5">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                        <span>{PACKAGE_STATUS_LABEL[h.toStatus] ? L(PACKAGE_STATUS_LABEL[h.toStatus]) : h.toStatus}</span>
                        <bdi dir="ltr" className="font-mono text-muted-foreground">{fmtDateTime(new Date(h.changedAt))}</bdi>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
