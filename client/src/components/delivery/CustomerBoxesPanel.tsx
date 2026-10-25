/**
 * A customer's boxes at a glance (owner, 2026-10-19): "when a new box is made,
 * show the earlier boxes - or a button for all of them - the box section must
 * carry useful information." How many boxes, what was paid, what was given
 * off and what is still owed; a warning naming every earlier discount; and
 * each box with its receipts - printed, sent, paid, undone - by whom and when,
 * the paper itself one click away.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ChevronDown, ChevronLeft, ExternalLink, History, Loader2, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/portalFormat";
import { fmtWhen } from "@/lib/numericDate";
import { HANDOVER_LABELS, RECEIPT_ACTION_LABELS, type HandoverMode } from "@shared/boxHandover";
import { DISCOUNT_REASON_LABELS, type DiscountReason } from "@shared/boxSettlement";

type Words = { ku: string; en: string; ar: string; zh: string };

export function CustomerBoxesPanel({ customerId, currentBoxId }: { customerId: number; currentBoxId?: number }) {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  // A receipt's discount reason is stored as its code ("damaged"), a printed
  // one as words already; the code is said in the reader's language.
  const reasonText = (r: string | null | undefined) => {
    if (!r) return "";
    const [code, ...rest] = r.split(" — ");
    const label = (DISCOUNT_REASON_LABELS as Record<string, Words>)[code as DiscountReason];
    return [label ? L(label) : code, ...rest].join(" — ");
  };
  const { data, isLoading } = trpc.deliveryBox.customerBoxes.useQuery({ customerId }, { enabled: customerId > 0 });
  const [open, setOpen] = useState<Set<number>>(() => new Set(currentBoxId ? [currentBoxId] : []));
  const [paperId, setPaperId] = useState<number | null>(null);
  // Folded to one button (owner, 2026-10-21: «یەک دوگمە ... تەنها کاتێ کلیکت کرد ئێنجا نیشان بدات»).
  const [shown, setShown] = useState(false);
  const paper = trpc.deliveryBox.receiptEventHtml.useQuery({ id: paperId ?? 0 }, { enabled: paperId !== null });

  // The paper opens in a window of its own, as it was printed.
  useEffect(() => {
    if (paperId === null || !paper.data) return;
    if (paper.data.html) {
      const w = window.open("", "_blank");
      if (w) { w.document.write(paper.data.html); w.document.close(); }
    }
    setPaperId(null);
  }, [paperId, paper.data]);

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!data || data.boxes.length === 0) return null;
  const t = data.totals;

  // One box open at a time (owner, 2026-10-25): opening another closes the last.
  const toggle = (id: number) => setOpen((old) => (old.has(id) ? new Set() : new Set([id])));

  if (!shown) {
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        className="flex w-full flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted/50"
        data-testid="customer-boxes-button"
      >
        <History className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {L({ ku: "بۆکسەکانی ئەم کڕیارە", en: "This customer's boxes", ar: "صناديق هذا الزبون", zh: "该客户的箱子" })} ({t.boxes})
        </span>
        {t.owedUsd > 0 && (
          <span className="text-xs font-semibold text-red-700 dark:text-red-400">
            · {L({ ku: "ماوە", en: "Owed", ar: "متبقٍ", zh: "欠款" })} <bdi dir="ltr">{fmtUsd(t.owedUsd)}</bdi>
          </span>
        )}
        {data.discounts.length > 0 && <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
        <ChevronDown className="ms-auto h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="customer-boxes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <History className="h-4 w-4" />
          {L({ ku: "بۆکسەکانی ئەم کڕیارە", en: "This customer's boxes", ar: "صناديق هذا الزبون", zh: "该客户的箱子" })}
        </p>
        <button type="button" onClick={() => setShown(false)} className="ms-auto text-xs text-muted-foreground hover:underline" data-testid="customer-boxes-hide">
          {L({ ku: "داخستن", en: "Hide", ar: "إخفاء", zh: "收起" })}
        </button>
        <Link href={`/customer-delivery-scanner?customer=${customerId}`} className="flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
          {L({ ku: "هەموو بۆکسەکانی", en: "All their boxes", ar: "كل صناديقه", zh: "全部箱子" })}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: { ku: "بۆکس", en: "Boxes", ar: "صناديق", zh: "箱数" }, v: String(t.boxes), tone: "" },
          { k: { ku: "دراو", en: "Paid", ar: "مدفوع", zh: "已付" }, v: fmtUsd(t.paidUsd), tone: "" },
          { k: { ku: "داشکان", en: "Discounts", ar: "خصومات", zh: "折扣" }, v: fmtUsd(t.discountUsd), tone: t.discountUsd > 0 ? "text-amber-700 dark:text-amber-400" : "" },
          { k: { ku: "ماوە", en: "Owed", ar: "متبقٍ", zh: "欠款" }, v: fmtUsd(t.owedUsd), tone: t.owedUsd > 0 ? "text-red-700 dark:text-red-400" : "" },
        ].map((m) => (
          <div key={m.k.en} className="rounded-md bg-muted/50 p-2.5">
            <div className="text-xs text-muted-foreground">{L(m.k)}</div>
            <div className={cn("text-lg font-semibold", m.tone)}><bdi dir="ltr">{m.v}</bdi></div>
          </div>
        ))}
      </div>

      {data.discounts.length > 0 && (
        <div className="space-y-0.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" data-testid="earlier-discounts">
          {data.discounts.map((d) => (
            <p key={d.receipt} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {L({ ku: "داشکانی پێشوو", en: "Earlier discount", ar: "خصم سابق", zh: "此前折扣" })}: <bdi dir="ltr">{fmtUsd(d.usd)}</bdi>
                {" — "}<bdi dir="ltr">{d.boxCode}</bdi> · <bdi dir="ltr">{d.receipt}</bdi>
                {d.reason ? ` · «${reasonText(d.reason)}»` : ""} · <bdi dir="ltr">{fmtWhen(d.at, true)}</bdi>
              </span>
            </p>
          ))}
        </div>
      )}

      <ul className="space-y-1.5">
        {data.boxes.map((b) => {
          const isOpen = open.has(b.id);
          const current = b.id === currentBoxId;
          return (
            <li key={b.id} className={cn("rounded-md border", current && "border-primary/60")}>
              <div className="flex cursor-pointer flex-wrap items-center gap-2 px-2.5 py-2" onClick={() => toggle(b.id)}>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rtl:rotate-180" />}
                <bdi dir="ltr" className="font-mono text-sm font-medium">{b.boxCode}</bdi>
                {current && <span className="text-xs text-primary">{L({ ku: "(ئەم بۆکسە)", en: "(this box)", ar: "(هذا الصندوق)", zh: "（本箱）" })}</span>}
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-xs",
                  b.status === "cancelled" ? "bg-muted text-muted-foreground"
                    : b.paidInFull ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : b.paidInPart ? "bg-orange-100 font-semibold text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
                )}>
                  {b.status === "cancelled"
                    ? L({ ku: "هەڵوەشێنراوە", en: "Cancelled", ar: "ملغى", zh: "已取消" })
                    : b.paidInFull
                      ? L({ ku: "دراوە", en: "Paid", ar: "مدفوع", zh: "已付" })
                      : b.paidInPart
                        ? `${L({ ku: "بەشێکی دراوە · ماوە", en: "Paid in part · left", ar: "مدفوع جزئياً · المتبقي", zh: "部分已付 · 剩余" })} ${fmtUsd(b.owedUsd)}`
                        : `${L({ ku: "ماوە", en: "Owes", ar: "متبقٍ", zh: "欠" })} ${fmtUsd(b.owedUsd)}`}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />{b.totalPackages} · <bdi dir="ltr">{fmtUsd(b.totalValueUsd)}</bdi>
                  {b.discountUsd > 0 && <> · {L({ ku: "داشکان", en: "discount", ar: "خصم", zh: "折扣" })} <bdi dir="ltr">{fmtUsd(b.discountUsd)}</bdi></>}
                  {b.handoverMode && <> · {L(HANDOVER_LABELS[b.handoverMode as HandoverMode])}{b.carrierName ? ` (${b.carrierName})` : ""}</>}
                  {" · "}<bdi dir="ltr">{fmtWhen(b.createdAt, false)}</bdi>
                </span>
                {!current && (
                  <Link
                    href={`/customer-delivery-scanner?box=${b.id}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="ms-auto flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {L({ ku: "کردنەوە", en: "Open", ar: "فتح", zh: "打开" })}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {isOpen && (
                <div className="border-t px-3 py-2">
                  {b.carrierTrackings.length > 0 && (
                    <p className="mb-1 text-xs text-muted-foreground">
                      {L({ ku: "تراکی کۆمپانیا", en: "Company tracking", ar: "تتبع الشركة", zh: "快递单号" })}: <bdi dir="ltr" className="font-mono">{b.carrierTrackings.join(" · ")}</bdi>
                    </p>
                  )}
                  {b.history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{L({ ku: "هێشتا هیچ وەسڵێک چاپ نەکراوە یان نەنێردراوە.", en: "No receipt printed or sent yet.", ar: "لم يُطبع أو يُرسل أي إيصال بعد.", zh: "尚未打印或发送收据。" })}</p>
                  ) : (
                    <ol className="space-y-1 border-s-2 ps-3 text-sm">
                      {b.history.map((e, i) => (
                        <li key={i} className={cn(e.kind === "reversed" && "text-red-700 dark:text-red-300")}>
                          <span className="font-medium">{L(RECEIPT_ACTION_LABELS[e.kind])}</span>
                          {e.receipt ? <> · <bdi dir="ltr">{e.receipt}</bdi></> : null}
                          {e.totalUsd !== undefined ? <> · <bdi dir="ltr">{fmtUsd(e.totalUsd)}</bdi></> : null}
                          {e.paidUsd !== undefined ? <> · <bdi dir="ltr">{fmtUsd(e.paidUsd)}</bdi></> : null}
                          {e.discountUsd ? <> · <span className="text-amber-700 dark:text-amber-400">{L({ ku: "داشکان", en: "discount", ar: "خصم", zh: "折扣" })} <bdi dir="ltr">{fmtUsd(e.discountUsd)}</bdi></span></> : null}
                          {e.discountReason ? ` «${reasonText(e.discountReason)}»` : ""}
                          {e.reason ? ` «${e.reason}»` : ""}
                          <span className="block text-xs text-muted-foreground">
                            {e.by ?? "—"} · <bdi dir="ltr">{fmtWhen(e.at, true)}</bdi>
                            {e.hasPaper && e.eventId ? (
                              <> · <button type="button" className="text-primary hover:underline" onClick={() => setPaperId(e.eventId!)}>
                                {L({ ku: "بینینی وەسڵ", en: "View the receipt", ar: "عرض الإيصال", zh: "查看收据" })}
                              </button></>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
