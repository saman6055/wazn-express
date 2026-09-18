import { useState, type ReactNode } from "react";
import { AlertTriangle, Banknote, Box, Hash, ImageOff, PackageX, ScanLine, Scale, UserX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { CopyButton } from "@/components/CopyButton";
import { OrderNumbers } from "@/components/OrderNumbers";
import { AlertParcelSheet } from "@/components/registrations/AlertParcelSheet";
import { customerCodeOnly } from "@shared/customerCode";
import {
  batchAtLoss,
  type CloseCheckBox,
  type CloseCheckMoney,
  type CloseCheckParcel,
} from "@shared/batchCloseCheck";

/**
 * The owner's checks before a batch is closed or marked delivered
 * (2026-09-18), in the pre-delivery dialog: the money, the cartons with no box
 * and the ones never checked in on arrival — each with its code and tracking
 * to copy, and a click that opens the carton with its photos — and the rest
 * worth a second look. Warnings only: the dialog's button still goes on.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

export interface CloseCheckAudit {
  packageCount: number;
  money?: CloseCheckMoney | null;
  findings: {
    unboxed?: CloseCheckParcel[];
    notArrivalChecked?: CloseCheckParcel[];
    unmeasured?: CloseCheckParcel[];
    ownerless?: CloseCheckParcel[];
    unpaidBoxes?: CloseCheckBox[];
    unpaidBoxesCapped?: boolean;
    missingNumber?: string[];
  };
}

const MISSING_NUMBER: Record<string, Words> = {
  awb: { ku: "ژمارەی بارنامەی ئاسمانی (AWB) تۆمار نەکراوە", en: "No air waybill (AWB) recorded", ar: "لم يُسجَّل رقم بوليصة الشحن الجوي (AWB)", zh: "未登记空运提单号 (AWB)" },
  container: { ku: "ژمارەی کۆنتەینەر تۆمار نەکراوە", en: "No container number recorded", ar: "لم يُسجَّل رقم الحاوية", zh: "未登记集装箱号" },
  "flight-number": { ku: "ژمارەی فڕین تۆمار نەکراوە", en: "No flight number recorded", ar: "لم يُسجَّل رقم الرحلة", zh: "未登记航班号" },
};

/** The three extra tiles beside the dialog's own two. */
export function CloseCheckTiles({ audit }: { audit: CloseCheckAudit }) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  const unboxed = audit.findings.unboxed?.length ?? 0;
  const unchecked = audit.findings.notArrivalChecked?.length ?? 0;
  const money = audit.money;
  const loss = batchAtLoss(money);
  return (
    <>
      <Tile label={L({ ku: "بێ بۆکس", en: "No box", ar: "بلا صندوق", zh: "未装箱" })} value={String(unboxed)} warn={unboxed > 0} />
      <Tile label={L({ ku: "بێ پشکنینی گەیشتن", en: "Not checked in", ar: "بلا فحص وصول", zh: "未到货核验" })} value={String(unchecked)} warn={unchecked > 0} />
      <Tile
        label={L({ ku: "قازانج / زەرەر", en: "Profit / loss", ar: "الربح / الخسارة", zh: "盈亏" })}
        value={money && !money.costMissing && money.profitUsd != null ? fmtUsd(money.profitUsd) : "—"}
        danger={loss}
        mono
      />
    </>
  );
}

function Tile({ label, value, warn, danger, mono }: { label: string; value: string; warn?: boolean; danger?: boolean; mono?: boolean }) {
  return (
    <div className="p-2 rounded border bg-muted/30">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-bold text-lg",
          mono && "font-mono tabular-nums",
          warn && "text-amber-700 dark:text-amber-300",
          danger && "text-rose-700 dark:text-rose-300",
        )}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}

/** Every new section, in the order a person should read them. */
export function BatchCloseCheckSections({ audit }: { audit: CloseCheckAudit }) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  const [open, setOpen] = useState<{ parcel: CloseCheckParcel; reason: Words } | null>(null);
  const f = audit.findings;
  const show = (reason: Words) => (parcel: CloseCheckParcel) => setOpen({ parcel, reason });

  const REASON = {
    unboxed: { ku: "بۆکسی گەیاندنی بۆ دروست نەکراوە", en: "No delivery box made for it", ar: "لم يُنشأ له صندوق تسليم", zh: "尚未为其建立配送箱" },
    unchecked: { ku: "لە سکانەری گەیشتندا سکان نەکراوە", en: "Never scanned in on arrival", ar: "لم يُمسح عند الوصول", zh: "到货时未扫描" },
    unmeasured: { ku: "کێش و قەبارەی تۆمار نەکراوە", en: "No weight or size recorded", ar: "لم يُسجَّل وزن أو حجم", zh: "未登记重量或尺寸" },
    ownerless: { ku: "هیچ کڕیارێکی لەسەر نییە", en: "No customer on it", ar: "لا يوجد عميل عليه", zh: "没有客户" },
  };

  return (
    <>
      <MoneySection money={audit.money ?? null} />

      <ParcelSection
        icon={<PackageX className="h-4 w-4" />}
        title={L({ ku: "کارتۆنی بێ بۆکس", en: "Cartons with no box", ar: "كراتين بلا صندوق", zh: "未装箱的纸箱" })}
        hint={L({ ku: "بۆکسی گەیاندنیان بۆ دروست نەکراوە. کلیک لە هەر یەکێک بکە بۆ زانیاری و وێنە.", en: "No delivery box has been made for these. Click one for its details and photos.", ar: "لم يُنشأ لها صندوق تسليم. انقر على أي منها لتفاصيله وصوره.", zh: "尚未为这些纸箱建立配送箱。点击查看详情和照片。" })}
        parcels={f.unboxed ?? []}
        onOpen={show(REASON.unboxed)}
        testId="close-check-unboxed"
      />
      <ParcelSection
        icon={<ScanLine className="h-4 w-4" />}
        title={L({ ku: "کارتۆنی بێ پشکنینی گەیشتن", en: "Cartons never checked in on arrival", ar: "كراتين لم تُفحص عند الوصول", zh: "未做到货核验的纸箱" })}
        hint={L({ ku: "لە سکانەری گەیشتندا سکان نەکراون — ڕەنگە نەگەیشتبن یان لە مەخزەن ون بن.", en: "Never scanned in the arrival scanner — they may not have arrived, or be lost in the warehouse.", ar: "لم تُمسح في ماسح الوصول — ربما لم تصل أو فُقدت في المستودع.", zh: "未在到货扫描中出现——可能尚未到达，或在仓库中丢失。" })}
        parcels={f.notArrivalChecked ?? []}
        onOpen={show(REASON.unchecked)}
        testId="close-check-unchecked"
      />
      <ParcelSection
        icon={<Scale className="h-4 w-4" />}
        title={L({ ku: "کارتۆنی بێ کێش و قەبارە", en: "Cartons with no weight or size", ar: "كراتين بلا وزن أو حجم", zh: "无重量或尺寸的纸箱" })}
        hint={L({ ku: "پارەی گواستنەوەیان حساب ناکرێت تا کێش یان قەبارەیان تۆمار نەکرێت.", en: "Their shipping cannot be charged until a weight or size is recorded.", ar: "لا يمكن احتساب شحنها حتى يُسجَّل وزن أو حجم.", zh: "在登记重量或尺寸之前，无法计算其运费。" })}
        parcels={f.unmeasured ?? []}
        onOpen={show(REASON.unmeasured)}
        testId="close-check-unmeasured"
      />
      <ParcelSection
        icon={<UserX className="h-4 w-4" />}
        title={L({ ku: "کارتۆنی بێ خاوەن", en: "Cartons with no owner", ar: "كراتين بلا مالك", zh: "无主纸箱" })}
        hint={L({ ku: "هیچ کڕیارێک پارەیان لێ ناگیرێت تا خاوەنیان دیاری نەکرێت.", en: "Nobody is charged for these until an owner is set.", ar: "لن يُحاسَب أحد عليها حتى يُحدَّد مالكها.", zh: "在指定所有者之前，不会向任何人收费。" })}
        parcels={f.ownerless ?? []}
        onOpen={show(REASON.ownerless)}
        testId="close-check-ownerless"
      />

      <OtherSection boxes={f.unpaidBoxes ?? []} capped={!!f.unpaidBoxesCapped} missingNumber={f.missingNumber ?? []} />

      <AlertParcelSheet
        parcel={open ? { ...open.parcel } : null}
        kind="check"
        level="high"
        reason={open?.reason}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function MoneySection({ money }: { money: CloseCheckMoney | null }) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  if (!money) return null;
  const loss = batchAtLoss(money);
  if (!loss && !money.costMissing && !money.priceMissing) return null;
  const usd = (n: number) => <bdi dir="ltr" className="font-mono">{fmtUsd(n)}</bdi>;
  return (
    <div className="p-3 rounded-lg border-2 border-rose-300 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30" data-testid="close-check-money">
      <div className="font-bold text-rose-900 dark:text-rose-200 mb-2 flex items-center gap-1">
        <Banknote className="h-4 w-4" />
        {L({ ku: "پارە", en: "Money", ar: "المال", zh: "资金" })}
      </div>
      <ul className="space-y-1 text-rose-900 dark:text-rose-200">
        {loss && (
          <li>
            {L({ ku: "باچەکە لە زەرەردایە:", en: "The batch is at a loss:", ar: "الدفعة خاسرة:", zh: "该批次亏损：" })}{" "}
            {L({ ku: "داهات", en: "revenue", ar: "الإيراد", zh: "收入" })} {usd(money.revenueUsd)} ·{" "}
            {L({ ku: "تێچوو", en: "cost", ar: "التكلفة", zh: "成本" })} {usd(money.costUsd)} ·{" "}
            {L({ ku: "زەرەر", en: "loss", ar: "الخسارة", zh: "亏损" })} {usd(money.profitUsd ?? 0)}
          </li>
        )}
        {money.costMissing && (
          <li>
            {L({
              ku: "تێچووی گواستنەوەی ئەم باچە تۆمار نەکراوە، بۆیە قازانج یان زەرەری دیار نییە.",
              en: "No shipping cost is recorded for this batch, so its profit or loss cannot be told.",
              ar: "لم تُسجَّل تكلفة شحن هذه الدفعة، لذا لا يمكن معرفة ربحها أو خسارتها.",
              zh: "该批次未登记运输成本，因此无法判断盈亏。",
            })}
          </li>
        )}
        {money.priceMissing && (
          <li>
            {L({
              ku: "نرخی فرۆشتن بۆ ئەم باچە دانەنراوە، بۆیە پارەی گواستنەوە لە کڕیاران ناگیرێت.",
              en: "No selling price is set for this batch, so customers are not charged for shipping.",
              ar: "لم يُحدَّد سعر بيع لهذه الدفعة، لذا لا يُحاسَب العملاء على الشحن.",
              zh: "该批次未设置售价，因此不会向客户收取运费。",
            })}
          </li>
        )}
      </ul>
    </div>
  );
}

const ROWS_SHOWN = 5;

function ParcelSection({
  icon,
  title,
  hint,
  parcels,
  onOpen,
  testId,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  parcels: CloseCheckParcel[];
  onOpen: (parcel: CloseCheckParcel) => void;
  testId: string;
}) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  const [all, setAll] = useState(false);
  if (parcels.length === 0) return null;
  const shown = all ? parcels : parcels.slice(0, ROWS_SHOWN);
  const copyCode = L({ ku: "کۆپی کۆدی پاکەت", en: "Copy parcel code", ar: "نسخ رمز الطرد", zh: "复制包裹编号" });
  const copyTracking = L({ ku: "کۆپی تراکینگ", en: "Copy tracking", ar: "نسخ رقم التتبع", zh: "复制运单号" });

  return (
    <div className="p-3 rounded-lg border-2 border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30" data-testid={testId}>
      <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
        {icon}
        {title} ({parcels.length})
      </div>
      <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mb-2">{hint}</div>
      <div className="space-y-1.5">
        {shown.map((p) => (
          <div key={p.id} className="relative flex items-center gap-2 rounded bg-white/60 dark:bg-black/30 p-2 text-xs" data-close-check-parcel={p.packageCode}>
            {/* The whole row opens the carton; the copy buttons sit above it. */}
            <button
              type="button"
              className="absolute inset-0 rounded hover:bg-amber-100/40 dark:hover:bg-amber-900/20"
              onClick={() => onOpen(p)}
              aria-label={`${p.packageCode} ${p.trackingNumber ?? ""}`}
            />
            {p.photo ? (
              <img src={p.photo} alt="" className="h-9 w-9 shrink-0 rounded object-cover" loading="lazy" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                <ImageOff className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="inline-flex items-center gap-1">
                  <bdi dir="ltr" className="font-mono font-medium">{p.packageCode}</bdi>
                  <CopyButton value={p.packageCode} label={copyCode} className="relative z-10" />
                </span>
                {p.trackingNumber && (
                  <span className="inline-flex items-center gap-1">
                    <bdi dir="ltr" className="font-mono">{p.trackingNumber}</bdi>
                    <CopyButton value={p.trackingNumber} label={copyTracking} className="relative z-10" />
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted-foreground">
                {p.customerCode ? (
                  <span>
                    <bdi dir="ltr" className="font-mono">{customerCodeOnly(p.customerCode)}</bdi> {p.customerName}
                  </span>
                ) : (
                  <span>{L({ ku: "بێ کڕیار", en: "No customer", ar: "بلا عميل", zh: "无客户" })}</span>
                )}
                <Measure parcel={p} />
              </div>
              <OrderNumbers numbers={p.orderNumbers} className="mt-0.5 flex" copyClassName="relative z-10" />
            </div>
          </div>
        ))}
      </div>
      {parcels.length > ROWS_SHOWN && (
        <button type="button" className="mt-2 text-[11px] font-medium text-amber-900 underline dark:text-amber-200" onClick={() => setAll((v) => !v)}>
          {all
            ? L({ ku: "کەمتر نیشان بدە", en: "Show fewer", ar: "عرض أقل", zh: "收起" })
            : L({
                ku: `هەموویان نیشان بدە (${parcels.length})`,
                en: `Show all (${parcels.length})`,
                ar: `عرض الكل (${parcels.length})`,
                zh: `显示全部 (${parcels.length})`,
              })}
        </button>
      )}
    </div>
  );
}

function Measure({ parcel }: { parcel: CloseCheckParcel }) {
  if (parcel.shippingType === "sea") {
    const cbm = Number(parcel.volumeCbm);
    return cbm > 0 ? <bdi dir="ltr" className="font-mono">{Number(cbm.toFixed(3))} CBM</bdi> : null;
  }
  const kg = Number(parcel.weightKg);
  return kg > 0 ? <bdi dir="ltr" className="font-mono">{Number(kg.toFixed(2))} kg</bdi> : null;
}

function OtherSection({ boxes, capped, missingNumber }: { boxes: CloseCheckBox[]; capped: boolean; missingNumber: string[] }) {
  const { language } = useLanguage();
  const L = (w: Words) => pickLang(language, w);
  if (boxes.length === 0 && missingNumber.length === 0) return null;
  const owed = boxes.reduce((sum, b) => sum + b.outstandingUsd, 0);
  return (
    <div className="p-3 rounded-lg border-2 border-sky-300 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/30" data-testid="close-check-other">
      <div className="font-bold text-sky-900 dark:text-sky-200 mb-2 flex items-center gap-1">
        <AlertTriangle className="h-4 w-4" />
        {L({ ku: "زانیاری تر", en: "Also worth knowing", ar: "معلومات أخرى", zh: "其他信息" })}
      </div>
      {boxes.length > 0 && (
        <div className="text-sky-900 dark:text-sky-200">
          <div className="flex items-center gap-1">
            <Box className="h-3.5 w-3.5" />
            {L({
              ku: `${boxes.length} بۆکس هێشتا پارەیان ماوە:`,
              en: `${boxes.length} box(es) still owe:`,
              ar: `${boxes.length} صندوق لا يزال عليه مبلغ:`,
              zh: `${boxes.length} 个箱子仍有欠款：`,
            })}{" "}
            <bdi dir="ltr" className="font-mono font-semibold">{fmtUsd(owed)}</bdi>
            {capped && <span className="text-[11px] opacity-80">{L({ ku: "(زیاتریش هەیە)", en: "(and more)", ar: "(وأكثر)", zh: "（还有更多）" })}</span>}
          </div>
          <div className="mt-1.5 space-y-1">
            {boxes.map((b) => (
              <div key={b.boxId} className="flex flex-wrap items-center gap-2 rounded bg-white/60 dark:bg-black/30 px-2 py-1 text-xs" data-close-check-box={b.boxCode}>
                <span className="inline-flex items-center gap-1">
                  <bdi dir="ltr" className="font-mono font-medium">{b.boxCode}</bdi>
                  <CopyButton value={b.boxCode} label={L({ ku: "کۆپی کۆدی بۆکس", en: "Copy box code", ar: "نسخ رمز الصندوق", zh: "复制箱号" })} />
                </span>
                {b.customerCode && (
                  <span className="text-muted-foreground">
                    <bdi dir="ltr" className="font-mono">{customerCodeOnly(b.customerCode)}</bdi> {b.customerName}
                  </span>
                )}
                <bdi dir="ltr" className="ms-auto font-mono font-semibold">{fmtUsd(b.outstandingUsd)}</bdi>
              </div>
            ))}
          </div>
        </div>
      )}
      {missingNumber.map((piece) => (
        <div key={piece} className="mt-1.5 flex items-center gap-1 text-sky-900 dark:text-sky-200">
          <Hash className="h-3.5 w-3.5" />
          {L(MISSING_NUMBER[piece] ?? MISSING_NUMBER.awb)}
        </div>
      ))}
    </div>
  );
}
