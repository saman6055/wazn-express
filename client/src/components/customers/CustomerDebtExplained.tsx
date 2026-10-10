/**
 * The customer's debt, explained.
 *
 * Owner, 2026-10-08, on the finance profile: "it is very confused. A
 * transaction's detail has no tracking, no platform order number, no photo
 * of the order, no link to it; the table is hard to read." And the rule he
 * has said many times: the box is the touchstone — whoever had a box
 * receipted owes nothing for it.
 *
 * So the profile opens with the one question a debt raises — what is it
 * for? — answered in the four places goods can be, each thing with its
 * photo, tracking, order number and the door to it. The same subject is
 * shown on every ledger row below (LedgerSubjectLine) and in its detail
 * (LedgerSubjectCard). The verdicts are the server's, from the one shared
 * rule (shared/boxPaidStillOwed → explainDebt); nothing is decided here.
 */
import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { AlertTriangle, Boxes, CheckCircle2, Package, PackageCheck, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/CopyButton";
import { OrderNumbers } from "@/components/OrderNumbers";
import { OrderThumb, OrderThumbs } from "@/components/orders/OrderThumb";
import { parcelListHref, parcelSourceTarget, type ParcelOrderType } from "@shared/parcelSource";

export interface LedgerSubject {
  verdict: string | null;
  orderId: number | null;
  orderType: string | null;
  orderCode: string | null;
  orderNumber: string | null;
  productName: string | null;
  hasImage: boolean;
  orderStatus: string | null;
  packageId: number | null;
  tracking: string | null;
  boxId: number | null;
  boxCode: string | null;
}

type Bucket = "road" | "arrived" | "openBox" | "parcel";
const BUCKETS: Bucket[] = ["road", "openBox", "arrived", "parcel"];

const BUCKET_TEXT: Record<Bucket, { ku: string; en: string; ar: string; zh: string }> = {
  road: { ku: "کاڵای سەر ڕێگا — هێشتا نەگەیشتووە", en: "Goods on the road — not arrived yet", ar: "بضاعة في الطريق — لم تصل بعد", zh: "在途货物 — 尚未到达" },
  openBox: { ku: "لە بۆکسدایە — هێشتا واسڵ نەکراوە", en: "In a box — not receipted yet", ar: "في صندوق — لم يُستلم ثمنه بعد", zh: "已装箱 — 尚未收款" },
  arrived: { ku: "گەیشتووە — لە هیچ بۆکسێکدا نییە", en: "Arrived — in no box", ar: "وصلت — ليست في أي صندوق", zh: "已到达 — 未装箱" },
  parcel: { ku: "پاکەتی خۆی — چاوەڕێی بۆکسە", en: "Own parcel — waiting for a box", ar: "طرده الخاص — بانتظار صندوق", zh: "自寄包裹 — 等待装箱" },
};

const VERDICT_TEXT: Record<string, { ku: string; en: string; ar: string; zh: string }> = {
  ...BUCKET_TEXT,
  road: { ku: "سەر ڕێگا", en: "On the road", ar: "في الطريق", zh: "在途" },
  openBox: { ku: "بۆکسی واسڵنەکراو", en: "Box not receipted", ar: "صندوق غير مستلم", zh: "箱未收款" },
  arrived: { ku: "گەیشتوو، بێ بۆکس", en: "Arrived, no box", ar: "وصلت، بلا صندوق", zh: "已到，未装箱" },
  parcel: { ku: "پاکەت، بێ بۆکس", en: "Parcel, no box", ar: "طرد، بلا صندوق", zh: "包裹，未装箱" },
  paid: { ku: "دراوە — بۆکسەکەی واسڵ کراوە", en: "Paid — its box was receipted", ar: "مدفوع — صندوقه مستلم", zh: "已付 — 箱已收款" },
  settled: { ku: "تەواو بووە — حیساب سفر کرابووەوە", en: "Settled — the account was zeroed", ar: "مسوّى — تم تصفير الحساب", zh: "已结清 — 账户曾清零" },
  back: { ku: "گەڕێندراوەتەوە", en: "Taken back", ar: "أُلغي", zh: "已冲回" },
};

const OWED = new Set(["road", "arrived", "openBox", "parcel"]);

function bucketIcon(bucket: Bucket) {
  if (bucket === "road") return Truck;
  if (bucket === "openBox") return Boxes;
  if (bucket === "arrived") return PackageCheck;
  return Package;
}

/** The door to what a row is about: its order, or the parcel in the list. */
function subjectHref(subject: LedgerSubject): string | null {
  if (subject.orderId != null && subject.orderType) {
    return parcelSourceTarget(
      [{ orderId: subject.orderId, orderType: subject.orderType as ParcelOrderType, orderCode: subject.orderCode, orderNumber: subject.orderNumber }],
      subject.tracking,
    ).href;
  }
  return subject.tracking ? parcelListHref(subject.tracking) : null;
}

const boxHref = (boxId: number) => `/customer-delivery-scanner?box=${boxId}`;

/** A chip saying where the charge stands: owed in red, paid in green. */
export function VerdictChip({ verdict, className }: { verdict: string | null; className?: string }) {
  const { language } = useTranslation();
  if (!verdict || !VERDICT_TEXT[verdict]) return null;
  const owed = OWED.has(verdict);
  return (
    <span
      data-testid="ledger-verdict"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap",
        owed
          ? "border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200"
          : "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      {!owed && verdict !== "back" && <CheckCircle2 className="h-3 w-3" />}
      {pickLang(language, VERDICT_TEXT[verdict])}
    </span>
  );
}

/**
 * One compact line under a ledger row's text: the tracking, the platform
 * order number, the box — each copyable, each a door. Clicks stay inside it
 * so the row's own click (its detail) is not fired.
 */
export function LedgerSubjectLine({ subject }: { subject?: LedgerSubject | null }) {
  if (!subject || (!subject.tracking && !subject.orderNumber && !subject.boxCode)) return null;
  const href = subjectHref(subject);
  return (
    <div
      data-testid="ledger-subject-line"
      className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground"
      onClick={(e) => e.stopPropagation()}
    >
      {subject.tracking && (
        <span className="inline-flex items-center gap-1">
          {href ? (
            <Link href={href} className="font-mono underline decoration-dotted underline-offset-2 hover:text-foreground">
              <bdi dir="ltr">{subject.tracking}</bdi>
            </Link>
          ) : (
            <bdi dir="ltr" className="font-mono">{subject.tracking}</bdi>
          )}
          <CopyButton value={subject.tracking} />
        </span>
      )}
      <OrderNumbers numbers={subject.orderNumber} />
      {subject.boxCode && (
        subject.boxId != null ? (
          <Link href={boxHref(subject.boxId)} className="underline decoration-dotted underline-offset-2 hover:text-foreground">
            <bdi dir="ltr">{subject.boxCode}</bdi>
          </Link>
        ) : (
          <bdi dir="ltr">{subject.boxCode}</bdi>
        )
      )}
      <VerdictChip verdict={subject.verdict} />
    </div>
  );
}

/** The same subject, in full, for a transaction's detail: photo, name, numbers, doors. */
export function LedgerSubjectCard({ subject }: { subject?: LedgerSubject | null }) {
  const { language } = useTranslation();
  if (!subject || (!subject.tracking && !subject.orderId && !subject.boxCode)) return null;
  const href = subjectHref(subject);
  return (
    <div data-testid="ledger-subject-card" className="rounded-xl border bg-muted/30 p-3 space-y-3">
      <div className="flex items-start gap-3">
        {subject.orderId != null && (
          <OrderThumbs orders={[{ id: subject.orderId, hasImage: subject.hasImage }]}>
            <OrderThumb order={{ id: subject.orderId, productName: subject.productName, hasImage: subject.hasImage }} className="h-16 w-16 shrink-0" />
          </OrderThumbs>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {subject.productName && <p className="text-sm font-medium break-words">{subject.productName}</p>}
          {subject.orderCode && (
            <p className="text-xs text-muted-foreground"><bdi dir="ltr" className="font-mono">{subject.orderCode}</bdi></p>
          )}
          <VerdictChip verdict={subject.verdict} />
        </div>
      </div>
      <div className="space-y-2 text-sm">
        {subject.tracking && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">{pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "رقم التتبع", zh: "物流单号" })}</span>
            <span className="inline-flex items-center gap-1">
              <bdi dir="ltr" className="font-mono">{subject.tracking}</bdi>
              <CopyButton value={subject.tracking} />
            </span>
          </div>
        )}
        {subject.orderNumber && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">{pickLang(language, { ku: "ئۆردەر نەمبەر", en: "Order no.", ar: "رقم الطلب", zh: "订单号" })}</span>
            <OrderNumbers numbers={subject.orderNumber} bare className="text-sm text-foreground" />
          </div>
        )}
        {subject.boxCode && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">{pickLang(language, { ku: "بۆکس", en: "Box", ar: "الصندوق", zh: "箱子" })}</span>
            <span className="inline-flex items-center gap-1">
              <bdi dir="ltr" className="font-mono">{subject.boxCode}</bdi>
              <CopyButton value={subject.boxCode} />
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {href && (
          <Link href={href} className="inline-flex min-h-9 items-center rounded-lg border bg-background px-3 text-sm hover:bg-muted">
            {subject.orderId != null
              ? pickLang(language, { ku: "کردنەوەی داواکارییەکە", en: "Open the order", ar: "فتح الطلب", zh: "打开订单" })
              : pickLang(language, { ku: "کردنەوەی پاکەتەکە", en: "Open the parcel", ar: "فتح الطرد", zh: "打开包裹" })}
          </Link>
        )}
        {subject.boxId != null && (
          <Link href={boxHref(subject.boxId)} className="inline-flex min-h-9 items-center rounded-lg border bg-background px-3 text-sm hover:bg-muted">
            {pickLang(language, { ku: "کردنەوەی بۆکسەکە", en: "Open the box", ar: "فتح الصندوق", zh: "打开箱子" })}
          </Link>
        )}
      </div>
    </div>
  );
}

/** The address of the card on the account page: a balance pressed anywhere lands on it. */
export const DEBT_ANCHOR = "#debt";

/** The hook the page shares with the rows below: one request, one answer. */
export function useDebtExplained(customerId: number) {
  return trpc.ledger.debtExplained.useQuery({ customerId }, { enabled: customerId > 0, staleTime: 30_000 });
}

export function CustomerDebtExplained({ customerId }: { customerId: number }) {
  const { language } = useTranslation();
  const { data, isLoading } = useDebtExplained(customerId);
  const [open, setOpen] = useState<Bucket | null>(null);

  const byBucket = useMemo(() => {
    const out: Record<Bucket, NonNullable<typeof data>["items"]> = { road: [], openBox: [], arrived: [], parcel: [] };
    for (const item of data?.items ?? []) if (OWED.has(item.verdict ?? "")) out[item.verdict as Bucket].push(item);
    return out;
  }, [data]);

  /*
   * Somebody who pressed a balance came for this card (`#debt`): bring it
   * to them once it has something to say. Before the early returns - a hook
   * under one of them breaks the page.
   */
  const ready = !isLoading && !!data;
  useEffect(() => {
    if (!ready || window.location.hash !== DEBT_ANCHOR) return;
    // More than once: the page above the card is still arriving, and each
    // part that lands pushes the card further down.
    const go = () => document.getElementById(DEBT_ANCHOR.slice(1))?.scrollIntoView({ block: "start" });
    go();
    const timers = [350, 1200].map((ms) => window.setTimeout(go, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ready]);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!data || (data.balanceUsd <= 0.005 && data.items.length === 0)) return null;

  const shown = open ?? BUCKETS.find((b) => byBucket[b].length > 0) ?? null;

  return (
    <Card id={DEBT_ANCHOR.slice(1)} className="scroll-mt-16 border-0 shadow-lg" data-testid="debt-explained">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {pickLang(language, { ku: "ئەم قەرزە بۆ چییە؟", en: "What is this debt for?", ar: "عن ماذا هذا الدين؟", zh: "这笔欠款是什么？" })}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {pickLang(language, {
            ku: "هەر شتێک لە بۆکسێکی واسڵکراودا بێت پارەی دراوە و لێرە نییە. ئەوەی لێرەیە هێشتا نەدراوە.",
            en: "Anything in a receipted box is paid and is not here. What is here has not been paid yet.",
            ar: "كل ما في صندوق مستلم مدفوع وليس هنا. ما هنا لم يُدفع بعد.",
            zh: "已收款箱子里的货物已付清，不在此处。此处为尚未付款的部分。",
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {BUCKETS.map((bucket) => {
            const Icon = bucketIcon(bucket);
            const usd = data.owedUsd[bucket];
            const count = byBucket[bucket].length;
            return (
              <button
                key={bucket}
                type="button"
                data-testid={`debt-bucket-${bucket}`}
                disabled={count === 0}
                onClick={() => setOpen(bucket)}
                className={cn(
                  "rounded-xl border p-3 text-start transition-colors min-h-[72px]",
                  shown === bucket ? "border-primary bg-primary/5" : "bg-muted/30 hover:bg-muted/60",
                  count === 0 && "opacity-50",
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="leading-tight">{pickLang(language, BUCKET_TEXT[bucket])}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold" dir="ltr">{fmtUsd(usd)}</span>
                  <span className="text-xs text-muted-foreground">{count}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border divide-y text-sm">
          {data.paidOnAccountUsd > 0.005 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-muted-foreground">{pickLang(language, { ku: "پارەی دراو بێ واسڵی بۆکس (لێی کەم دەکرێتەوە)", en: "Paid without a box receipt (taken off)", ar: "مدفوع بدون وصل صندوق (يُخصم)", zh: "无箱收据的付款（已扣除）" })}</span>
              <span className="font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300" dir="ltr">−{fmtUsd(data.paidOnAccountUsd)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="font-medium">{pickLang(language, { ku: "قەرزی ڕاستەقینە", en: "Really owed", ar: "الدين الحقيقي", zh: "实际欠款" })}</span>
            <span className="font-semibold whitespace-nowrap" dir="ltr" data-testid="debt-still-owed">{fmtUsd(data.stillOwedUsd)}</span>
          </div>
          {data.falseDebtUsd > 0.005 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30" data-testid="debt-false">
              <span className="inline-flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {pickLang(language, { ku: "دووجار نووسراوە — قەرز نییە", en: "Written twice — not owed", ar: "مكتوب مرتين — ليس ديناً", zh: "重复记账 — 非欠款" })}
              </span>
              <span className="inline-flex items-center gap-3">
                <span className="font-semibold whitespace-nowrap text-red-700 dark:text-red-300" dir="ltr">{fmtUsd(data.falseDebtUsd)}</span>
                <Link href="/finance/box-double-charges" className="underline text-xs">
                  {pickLang(language, { ku: "بەڵگە و ڕاستکردنەوە", en: "Proof and correction", ar: "الدليل والتصحيح", zh: "凭据与更正" })}
                </Link>
              </span>
            </div>
          )}
          {Math.abs(data.unexplainedUsd) > 0.5 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-muted-foreground">{pickLang(language, { ku: "ڕوون نەبووەتەوە — پێویستی بە سەیرکردنە", en: "Not explained — needs a look", ar: "غير مفسَّر — يحتاج مراجعة", zh: "未能解释 — 需要查看" })}</span>
              <span className="font-medium whitespace-nowrap" dir="ltr">{fmtUsd(data.unexplainedUsd)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-muted-foreground">{pickLang(language, { ku: "ئەوەی سیستەم نیشانی دەدات", en: "What the account shows", ar: "ما يظهره الحساب", zh: "账户显示" })}</span>
            <span className="font-medium whitespace-nowrap" dir="ltr">{fmtUsd(data.balanceUsd)}</span>
          </div>
        </div>

        {shown && byBucket[shown].length > 0 && (
          <OrderThumbs orders={byBucket[shown].filter((i) => i.orderId != null).map((i) => ({ id: i.orderId as number, hasImage: i.hasImage }))}>
            <ul className="rounded-xl border divide-y" data-testid="debt-items">
              {byBucket[shown].map((item) => {
                const href = subjectHref(item);
                return (
                  <li key={item.key} className="flex items-start gap-3 p-3">
                    {item.orderId != null ? (
                      <OrderThumb order={{ id: item.orderId, productName: item.productName, hasImage: item.hasImage }} className="h-12 w-12 shrink-0" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden="true">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        {href ? (
                          <Link href={href} className="text-sm font-medium break-words hover:underline">
                            {item.productName || item.orderCode || item.tracking || "—"}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium break-words">{item.productName || item.tracking || "—"}</span>
                        )}
                        <span className="font-semibold whitespace-nowrap" dir="ltr">{fmtUsd(item.usd)}</span>
                      </div>
                      {item.orderCode && (
                        <p className="text-xs text-muted-foreground"><bdi dir="ltr" className="font-mono">{item.orderCode}</bdi></p>
                      )}
                      <LedgerSubjectLine subject={{ ...item, verdict: null }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </OrderThumbs>
        )}
      </CardContent>
    </Card>
  );
}
