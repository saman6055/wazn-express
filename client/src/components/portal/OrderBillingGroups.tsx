import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronDown, Hash, Package, ShoppingBag, Receipt, Truck, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { WhatsAppHelpButton } from "./WhatsAppHelpButton";
import { PhotoStack } from "@/components/PhotoStack";
import { formatPortalDate } from "@/lib/portalClock";

// ---------------------------------------------------------------------------
// OrderBillingGroups — presentation-only fix for "one item, three receipts".
// Groups the customer's ledger charges by their source order (referenceType +
// referenceId), so purchase + commission + shipping of the same order show as
// ONE billing card with a breakdown inside. No backend/logic changes at all.
// ---------------------------------------------------------------------------

type L10n = { ku: string; en: string; ar: string; zh: string };

export interface LedgerTxLike {
  id: number;
  transactionType: string;
  amountUsd: string | number | null;
  description: string | null;
  createdAt: string | Date;
  referenceType: string | null;
  referenceId: number | null;
  invoiceId?: number | null;
}

const GROUPABLE: Record<string, { label: L10n; icon: typeof Package }> = {
  commission: {
    label: { ku: "ئۆردەری عمولە", en: "Commission order", ar: "طلب عمولة", zh: "佣金订单" },
    icon: ShoppingBag,
  },
  full_package: {
    label: { ku: "پاکێجی تەواو", en: "Full package", ar: "طرد كامل", zh: "全包裹" },
    icon: ShoppingBag,
  },
  purchase_request: {
    label: { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" },
    icon: ShoppingBag,
  },
  package: {
    label: { ku: "پاکێجی بار", en: "Shipping package", ar: "طرد شحن", zh: "运输包裹" },
    icon: Package,
  },
};

interface Group {
  key: string;
  refType: string;
  refId: number;
  total: number;
  firstAt: Date;
  lines: LedgerTxLike[];
}

export function OrderBillingGroups({
  transactions,
  language,
  isDark = false,
}: {
  transactions: LedgerTxLike[] | undefined;
  language: string;
  isDark?: boolean;
}) {
  const pick = (v: L10n) => pickLang(language, v);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Read-only enrichment: join each billing group to the order/package it
  // charges (photo, order code, tracking, quantity) purely on the client from
  // queries the portal already exposes — no backend or billing-logic changes.
  const { data: fpOrders } = trpc.customerPortal.getMyFullPackageOrders.useQuery(
    {},
    { staleTime: 60_000, retry: false },
  );
  const { data: myPackages } = trpc.customerPortal.getMyPackages.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const orderById = useMemo(
    () => new Map((fpOrders ?? []).map((o: any) => [o.id as number, o])),
    [fpOrders],
  );
  const pkgById = useMemo(
    () => new Map((myPackages ?? []).map((p: any) => [p.id as number, p])),
    [myPackages],
  );

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const tx of transactions ?? []) {
      // Only charges tied to a source order; payments/adjustments stay in the
      // normal transactions list untouched.
      if (!tx.referenceType || tx.referenceId == null) continue;
      if (!GROUPABLE[tx.referenceType]) continue;
      if (!String(tx.transactionType || "").startsWith("DEBIT")) continue;
      const key = `${tx.referenceType}:${tx.referenceId}`;
      const amount = Number(tx.amountUsd) || 0;
      const at = new Date(tx.createdAt);
      const existing = map.get(key);
      if (existing) {
        existing.total += amount;
        existing.lines.push(tx);
        if (at < existing.firstAt) existing.firstAt = at;
      } else {
        map.set(key, {
          key,
          refType: tx.referenceType,
          refId: tx.referenceId,
          total: amount,
          firstAt: at,
          lines: [tx],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.firstAt.getTime() - a.firstAt.getTime());
  }, [transactions]);

  if (!groups.length) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Receipt className={cn("h-4 w-4", isDark ? "text-indigo-400" : "text-indigo-600")} />
        <h3 className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
          {pick({
            ku: "حیسابی هەر ئۆردەرێک بە یەکەوە",
            en: "Billing grouped per order",
            ar: "فواتير كل طلب معاً",
            zh: "按订单汇总的账单",
          })}
        </h3>
      </div>
      <p className={cn("text-[11px] leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
        {pick({
          ku: "هەموو پارەدانەکانی یەک ئۆردەر (کڕین، عمولە، گواستنەوە...) لێرە بە یەک کۆ دەبینیت",
          en: "All charges of one order (purchase, commission, shipping...) shown as a single total here",
          ar: "جميع مصاريف الطلب الواحد (شراء، عمولة، شحن...) تظهر هنا كمجموع واحد",
          zh: "同一订单的所有费用（采购、佣金、运费等）在此合并显示",
        })}
      </p>

      {groups.map((g) => {
        const meta = GROUPABLE[g.refType];
        const Icon = meta.icon;
        const open = openKey === g.key;
        // The first line's description usually carries the order code — use it
        // as the card subtitle so the customer recognises the order.
        const subtitle = (g.lines[g.lines.length - 1]?.description || "").split("\n")[0];
        // Client-side join to the source order/package for identity info.
        const fp = g.refType !== "package" ? orderById.get(g.refId) : undefined;
        const pkg = g.refType === "package" ? pkgById.get(g.refId) : undefined;
        // Every picture of the thing being billed, not just the first: the
        // warehouse shots and the product shot are all evidence of what the
        // customer is paying for.
        const images: string[] = [
          ...(Array.isArray(pkg?.photos) ? (pkg.photos as string[]) : []),
          ...(fp?.productImage ? [fp.productImage as string] : []),
          ...(Array.isArray((fp as any)?.productImages) ? ((fp as any).productImages as string[]) : []),
        ];
        const code = fp?.orderCode || pkg?.packageCode || null;
        const tracking = fp?.trackingNumber || pkg?.trackingNumber || null;
        const quantity = fp?.quantity != null && Number(fp.quantity) > 0 ? Number(fp.quantity) : null;
        const title = fp?.productName || pick(meta.label);
        return (
          <div
            key={g.key}
            className={cn(
              "rounded-2xl border overflow-hidden transition-colors",
              isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100 dark:border-slate-800/60 shadow-sm",
            )}
          >
            {/* The thumbnail sits outside the expand button rather than inside
                it: opening the photos and opening the row are two different
                actions, and a button inside a button is not valid markup. */}
            <div className="flex items-center gap-3 p-3.5">
              <PhotoStack
                photos={images}
                className="h-12 w-12 rounded-xl ring-1 ring-black/5 dark:ring-white/10"
                fallback={
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                      isDark ? "bg-indigo-900/40 text-indigo-400" : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                }
              />
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : g.key)}
                className="min-w-0 flex-1 text-start"
              >
                <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                      {title}
                      {quantity != null && quantity > 1 && (
                        <span className={cn("ms-1.5 font-black", isDark ? "text-amber-400" : "text-amber-600")} dir="ltr">
                          ×{quantity}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn("shrink-0 text-base font-black tabular-nums", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")}
                      dir="ltr"
                    >
                      ${g.total.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {code && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-mono font-bold",
                          isDark
                            ? "border-violet-800 bg-violet-950/40 text-violet-300"
                            : "border-violet-200 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
                        )}
                        dir="ltr"
                      >
                        <Hash className="h-3 w-3" />
                        {code}
                      </span>
                    )}
                    {tracking && (
                      <span
                        className={cn("inline-flex items-center gap-1 text-[11px] font-mono", isDark ? "text-slate-400" : "text-slate-500")}
                        dir="ltr"
                      >
                        <Truck className="h-3 w-3" />
                        {tracking}
                      </span>
                    )}
                    {quantity != null && (
                      <span className={cn("text-[11px] font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                        {pick({ ku: "عەدەد", en: "Qty", ar: "الكمية", zh: "数量" })}: <b dir="ltr">{quantity}</b>
                      </span>
                    )}
                    <span className={cn("ms-auto shrink-0 text-[10px] tabular-nums", isDark ? "text-slate-500" : "text-slate-400")} dir="ltr">
                      {formatPortalDate(g.firstAt, language)}
                    </span>
                  </div>
                  {!code && (
                    <div className="mt-0.5">
                      <span className={cn("truncate text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>
                        {subtitle}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    open && "rotate-180",
                    isDark ? "text-slate-500" : "text-slate-400",
                  )}
                />
              </div>
              {g.lines.length > 1 && !open && (
                <p className={cn("mt-1.5 text-[10px] font-medium", isDark ? "text-indigo-400" : "text-indigo-600")}>
                  {pick({
                    ku: `${g.lines.length} بڕگە لەم ئۆردەرەدا — کلیک بکە بۆ وردەکاری`,
                    en: `${g.lines.length} charges in this order — tap for details`,
                    ar: `${g.lines.length} بنود في هذا الطلب — اضغط للتفاصيل`,
                    zh: `此订单包含 ${g.lines.length} 项费用——点击查看明细`,
                  })}
                </p>
              )}
              </button>
            </div>

            {open && (
              <div className={cn("border-t px-3.5 py-2", isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60")}>
                {g.lines
                  .slice()
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((line) => (
                    <div key={line.id} className="flex items-start justify-between gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-medium leading-snug", isDark ? "text-slate-200" : "text-slate-700 dark:text-slate-300")}>
                          {line.description ||
                            pick({ ku: "بڕگە", en: "Charge", ar: "بند", zh: "费用" })}
                        </p>
                        <p className={cn("text-[10px] tabular-nums", isDark ? "text-slate-500" : "text-slate-400")} dir="ltr">
                          {formatPortalDate(line.createdAt, language)}
                        </p>
                      </div>
                      <span className={cn("shrink-0 text-xs font-bold tabular-nums", isDark ? "text-slate-200" : "text-slate-700 dark:text-slate-300")} dir="ltr">
                        ${(Number(line.amountUsd) || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                <div className={cn("mt-1 flex items-center justify-between border-t pt-2", isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60")}>
                  <span className={cn("flex items-center gap-1 text-xs font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                    <Wallet className="h-3.5 w-3.5" />
                    {/* Grouped from the transactions this screen was handed,
                        which is the most recent fifty — so on a long-standing
                        account an older order card summed only the charges
                        that happened to fall in that window and presented it
                        as the definitive order total. Say what it actually
                        is. */}
                    {pick({ ku: "کۆی ئەم بڕگانە", en: "Total of these charges", ar: "مجموع هذه البنود", zh: "以上费用合计" })}
                  </span>
                  <span className={cn("text-sm font-black tabular-nums", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")} dir="ltr">
                    ${g.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-end pb-1 pt-1.5">
                  <WhatsAppHelpButton
                    language={language}
                    section={pick({ ku: "دارایی — حیسابی ئۆردەر", en: "Financial — order billing", ar: "المالية — فواتير الطلب", zh: "财务——订单账单" })}
                    topic={[
                      code ? `${code}` : subtitle,
                      quantity != null ? `${pick({ ku: "عەدەد", en: "Qty", ar: "الكمية", zh: "数量" })}: ${quantity}` : null,
                      tracking ? `${pick({ ku: "تراک", en: "Tracking", ar: "التتبع", zh: "运单号" })}: ${tracking}` : null,
                      `$${g.total.toFixed(2)}`,
                    ].filter(Boolean).join(" · ")}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
