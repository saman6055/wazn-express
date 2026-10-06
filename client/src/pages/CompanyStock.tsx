import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { PackageX } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { fmtUsd } from "@/lib/portalFormat";
import { cn } from "@/lib/utils";
import {
  REFUSAL_FAULT,
  REFUSAL_REASONS,
  REFUSAL_REASON_WORDS,
  STOCK_OLD_DAYS,
  stockLossSoFarUsd,
  stockOutcomeUsd,
  stockResultUsd,
  suggestKeep,
  type RefusalReason,
} from "@shared/refusedGoods";

type Words = { ku: string; en: string; ar: string; zh: string };

function Money({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return <bdi dir="ltr" className={cn("tabular-nums", className)}>{sign}{fmtUsd(Math.abs(value))}</bdi>;
}

/** The form that turns "the customer will not take it" into lines on the books. Main admin only. */
function RefuseForm({ L, initialCode }: { L: (w: Words) => string; initialCode: string }) {
  const utils = trpc.useUtils();
  const [code, setCode] = useState(initialCode);
  const [asked, setAsked] = useState(initialCode);
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<RefusalReason | "">("");
  const [keep, setKeep] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [fault, setFault] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const quantity = Math.max(1, Math.round(Number(qty)) || 1);
  // Found by what is in the office's hand — a tracking number, or the order's code.
  const found = trpc.ledger.searchRefusal.useQuery({ query: asked }, { enabled: asked.trim().length > 0, retry: false });
  const candidates = found.data?.orders ?? [];
  // One carton can carry several orders: with one match it is taken, with more the office picks.
  const orderId = picked ?? (candidates.length === 1 ? candidates[0].orderId : null);
  const preview = trpc.ledger.previewRefusal.useQuery({ orderId: orderId ?? 0, refuseQuantity: quantity }, { enabled: orderId != null, retry: false });
  const p = orderId != null ? preview.data ?? null : null;
  const ask = (value: string) => {
    setPicked(null);
    setAsked(value.trim());
  };

  const refuse = trpc.ledger.refuseGoods.useMutation({
    onSuccess: (res) => {
      void utils.ledger.companyStock.invalidate();
      void utils.ledger.goodsOnRoad.invalidate();
      void utils.ledger.workingCapital.invalidate();
      void utils.ledger.financeDashboard.invalidate();
      setAsked("");
      setPicked(null);
      setCode("");
      setReason("");
      setKeep(null);
      setNote("");
      setQty("1");
      toast.success(L({ ku: `${res.orderCode}: ${res.refused} دانە بوو بە کاڵای شەریکە`, en: `${res.orderCode}: ${res.refused} piece(s) are now company stock`, ar: `${res.orderCode}: أصبحت ${res.refused} قطعة مخزوناً للشركة`, zh: `${res.orderCode}：${res.refused} 件已转为公司库存` }));
    },
    onError: (e) => toast.error(e.message, { duration: 20_000 }),
  });

  const submit = () => {
    if (!p) return;
    if (!reason) return setFault(L({ ku: "هۆکارەکە هەڵبژێرە", en: "Choose the reason", ar: "اختر السبب", zh: "请选择原因" }));
    if (quantity > p.orderQuantity) return setFault(L({ ku: `ئەم داواکارییە تەنها ${p.orderQuantity} دانەیە`, en: `This order has only ${p.orderQuantity} piece(s)`, ar: `هذا الطلب ${p.orderQuantity} قطعة فقط`, zh: `此订单只有 ${p.orderQuantity} 件` }));
    if (reason === "other" && !note.trim()) return setFault(L({ ku: "لە خانەی تێبینی بنووسە بۆچی", en: "Write why in the note", ar: "اكتب السبب في الملاحظة", zh: "请在备注中写明原因" }));
    if (p.plan.keepableUsd > 0 && keep === null) return setFault(L({ ku: "بڵێ پارەکەی کڕیار دەگەڕێتەوە یان نا", en: "Say whether the customer's money goes back", ar: "حدّد هل يُعاد مال العميل", zh: "请说明是否退还客户的钱" }));
    setFault("");
    refuse.mutate({
      orderId: p.orderId,
      refuseQuantity: quantity,
      reason,
      keepUsd: keep ? p.plan.keepableUsd : 0,
      note: note.trim() || undefined,
      // What it was found by is what it will be found by again when it is sold.
      trackingNumber: asked && asked !== p.orderCode ? asked : undefined,
    });
  };

  return (
    <Card data-testid="refuse-form">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{L({ ku: "کاڵایەک ڕەتکرایەوە", en: "Goods were refused", ar: "بضاعة رُفضت", zh: "货物被拒收" })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder={L({ ku: "تراک یان کۆدی داواکاری", en: "Tracking number or order code", ar: "رقم التتبع أو رمز الطلب", zh: "运单号或订单编号" })} onKeyDown={(e) => { if (e.key === "Enter") ask(code); }} data-testid="refusal-search" />
          <Button variant="outline" onClick={() => ask(code)}>{L({ ku: "بیدۆزەوە", en: "Find it", ar: "ابحث", zh: "查找" })}</Button>
        </div>
        {(found.isFetching || preview.isFetching) && <Skeleton className="h-24 w-full" />}
        {preview.error && <p className="whitespace-pre-line text-red-700 dark:text-red-400">{preview.error.message}</p>}
        {asked && !found.isFetching && found.data && candidates.length === 0 && (
          <p className="text-red-700 dark:text-red-400">
            {found.data.plainParcel
              ? L({
                  ku: "ئەم تراکە هی پاکەتی خودی کڕیارە و داواکاریی کڕینی لەسەر نییە، بۆیە تێچووی کڕینی نییە تا ببێتە کاڵای شەریکە.",
                  en: "This tracking is the customer's own parcel with no purchase order behind it, so there is no buying cost to put in stock.",
                  ar: "هذا الرقم لطرد العميل نفسه ولا يوجد طلب شراء خلفه.",
                  zh: "此运单是客户自己的包裹，没有采购订单，因此没有可入库的采购成本。",
                })
              : found.data.allEnded
                ? L({ ku: "ئەم داواکارییە پێشتر هەڵوەشێنراوەتەوە یان ڕەت کراوەتەوە. لە لیستی خوارەوە بە هەمان تراک بیدۆزەوە.", en: "This order was already cancelled or refused. Find it in the list below by the same tracking.", ar: "هذا الطلب أُلغي أو رُفض سابقاً. ابحث عنه في القائمة أدناه.", zh: "该订单已取消或已拒收。请在下方列表中用同一运单号查找。" })
                : L({ ku: "هیچ داواکارییەک بەم تراک یان کۆدە نەدۆزرایەوە.", en: "No order with this tracking or code.", ar: "لا يوجد طلب بهذا الرقم أو الرمز.", zh: "没有此运单号或编号的订单。" })}
          </p>
        )}
        {candidates.length > 1 && (
          <div className="space-y-1 rounded-lg border p-2" data-testid="refusal-candidates">
            <div className="px-1 text-xs text-muted-foreground">
              {L({ ku: `ئەم تراکە ${candidates.length} داواکاریی تێدایە — یەکێکیان هەڵبژێرە`, en: `This tracking carries ${candidates.length} orders — pick one`, ar: `هذا الرقم يحمل ${candidates.length} طلبات — اختر واحداً`, zh: `此运单包含 ${candidates.length} 个订单 — 请选择` })}
            </div>
            {candidates.map((c) => (
              <button
                key={c.orderId}
                type="button"
                onClick={() => setPicked(c.orderId)}
                className={cn("flex w-full flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start hover:bg-muted", orderId === c.orderId && "bg-muted")}
              >
                <span>{c.productName ?? "—"} × <bdi dir="ltr">{c.quantity}</bdi></span>
                <span className="text-xs text-muted-foreground">{c.customerName ?? c.customerCode} · <bdi dir="ltr">{c.orderCode}</bdi></span>
              </button>
            ))}
          </div>
        )}
        {p && (
          <>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="font-medium">{p.customerName ?? p.customerCode} <span className="text-xs font-normal text-muted-foreground"><bdi dir="ltr">{p.customerCode}</bdi></span></div>
              <div className="text-xs text-muted-foreground">
                <bdi dir="ltr">{p.orderCode}</bdi> · {p.productName ?? "—"} × <bdi dir="ltr">{p.orderQuantity}</bdi> ·{" "}
                {L({ ku: "هەر دانە", en: "each", ar: "للقطعة", zh: "每件" })} <Money value={p.unitSellUsd} /> ({L({ ku: "تێچوو", en: "cost", ar: "التكلفة", zh: "成本" })} <Money value={p.unitBuyUsd} />) ·{" "}
                {p.charged ? L({ ku: "لەسەر کڕیار نووسراوە", en: "on the account", ar: "مقيَّد على العميل", zh: "已记账" }) : L({ ku: "لەسەر کڕیار نەنووسراوە", en: "not on the account", ar: "غير مقيَّد", zh: "未记账" })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">{L({ ku: `چەند دانە ڕەت کراوەتەوە (لە ${p.orderQuantity})`, en: `Pieces refused (of ${p.orderQuantity})`, ar: `القطع المرفوضة (من ${p.orderQuantity})`, zh: `拒收件数（共 ${p.orderQuantity}）` })}</span>
                <Input dir="ltr" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value); setFault(""); }} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">{L({ ku: "هۆکار", en: "Reason", ar: "السبب", zh: "原因" })}</span>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={reason} onChange={(e) => { setReason(e.target.value as RefusalReason); setKeep(null); setFault(""); }}>
                  <option value="">{L({ ku: "هەڵبژێرە…", en: "Choose…", ar: "اختر…", zh: "请选择…" })}</option>
                  {REFUSAL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {L(REFUSAL_REASON_WORDS[r])} — {REFUSAL_FAULT[r] === "office" ? L({ ku: "لای ئۆفیس", en: "office's side", ar: "من المكتب", zh: "办公室方" }) : L({ ku: "لای کڕیار", en: "customer's side", ar: "من العميل", zh: "客户方" })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Input value={note} onChange={(e) => { setNote(e.target.value); setFault(""); }} placeholder={L({ ku: "تێبینی (ئارەزوومەندانە)", en: "Note (optional)", ar: "ملاحظة (اختياري)", zh: "备注（可选）" })} />

            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3 border-b py-1.5"><span>{L({ ku: "لەسەر کڕیار لادەبرێت", en: "Comes off the customer", ar: "يُخصم من العميل", zh: "从客户账上减去" })}</span><Money value={p.plan.takenOffUsd} /></div>
              <div className="flex items-center justify-between gap-3 border-b py-1.5"><span>{L({ ku: "حیسابی کڕیار دوای ئەوە", en: "Customer's balance after", ar: "رصيد العميل بعدها", zh: "之后客户余额" })}</span><Money value={p.plan.balanceAfterUsd} /></div>
              <div className="flex items-center justify-between gap-3 py-1.5 font-medium"><span>{L({ ku: "دەبێتە کاڵای شەریکە، بە تێچووی", en: "Becomes company stock, at a cost of", ar: "يصبح مخزوناً للشركة بتكلفة", zh: "转为公司库存，成本" })}</span><Money value={p.plan.costUsd} /></div>
            </div>

            {p.plan.keepableUsd > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" data-testid="keep-question">
                <div className="font-medium">
                  {L({ ku: "پارەی کڕیار لای ئێمە دەمێنێتەوە:", en: "The customer's money left with us:", ar: "مال العميل الباقي عندنا:", zh: "客户留在我方的钱：" })} <Money value={p.plan.keepableUsd} /> — {L({ ku: "بۆی بگەڕێتەوە؟", en: "does it go back?", ar: "هل يُعاد؟", zh: "是否退还？" })}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button size="sm" variant={keep === false ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal py-1.5" onClick={() => { setKeep(false); setFault(""); }}>
                    {L({ ku: "بەڵێ، هی کڕیارە", en: "Yes, it is the customer's", ar: "نعم، هو للعميل", zh: "是，归客户" })}
                    {reason && !suggestKeep(reason) && <span className="ms-1 text-xs opacity-80">({L({ ku: "پێشنیار", en: "suggested", ar: "مقترح", zh: "建议" })})</span>}
                  </Button>
                  <Button size="sm" variant={keep === true ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal py-1.5" onClick={() => { setKeep(true); setFault(""); }}>
                    {L({ ku: "نەخێر، شەریکە دەیهێڵێتەوە", en: "No, the company keeps it", ar: "لا، تحتفظ به الشركة", zh: "否，公司保留" })}
                    {reason && suggestKeep(reason) && <span className="ms-1 text-xs opacity-80">({L({ ku: "پێشنیار", en: "suggested", ar: "مقترح", zh: "建议" })})</span>}
                  </Button>
                </div>
              </div>
            )}

            {fault && <p className="text-red-700 dark:text-red-400">{fault}</p>}
            <div className="flex justify-end">
              <Button onClick={submit} disabled={refuse.isPending}>{L({ ku: "بەڵێ، ڕەتکرایەوە", en: "Yes, it was refused", ar: "نعم، رُفض", zh: "是，已拒收" })}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Company stock — refused goods (owner, 2026-10-07): where an unwanted order
 * goes instead of vanishing, what it cost, how long it has sat, and how it
 * ended. Not a loss until it is sold for less or written off.
 */
export default function CompanyStock() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const { user } = useAuth();
  const isMainAdmin = user?.role === "super_admin";
  const search = useSearch();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.ledger.companyStock.useQuery();
  const all = data ?? [];
  const [find, setFind] = useState("");
  // Found again by the same tracking it was refused by — or by code, product or customer.
  const rows = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => [r.trackingNumber, r.orderCode, r.productName, r.customerName, r.customerCode].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [all, find]);
  const held = rows.filter((r) => r.status === "held");
  const closed = rows.filter((r) => r.status !== "held");
  const [acting, setActing] = useState<{ id: number; kind: "sell" | "writeOff" | "store" } | null>(null);
  const [price, setPrice] = useState("");
  const [buyer, setBuyer] = useState("");
  const [note, setNote] = useState("");

  const done = () => {
    void utils.ledger.companyStock.invalidate();
    void utils.ledger.workingCapital.invalidate();
    void utils.ledger.financeDashboard.invalidate();
    setActing(null);
    setPrice("");
    setBuyer("");
    setNote("");
  };
  const onError = (e: { message: string }) => toast.error(e.message, { duration: 20_000 });
  const sell = trpc.ledger.sellStock.useMutation({ onSuccess: (r) => { done(); toast.success(L({ ku: `فرۆشرا — ئەنجام ${r.resultUsd < 0 ? "−" : "+"}${fmtUsd(Math.abs(r.resultUsd))}`, en: `Sold — result ${r.resultUsd < 0 ? "−" : "+"}${fmtUsd(Math.abs(r.resultUsd))}`, ar: "تم البيع", zh: "已售出" })); }, onError });
  const writeOff = trpc.ledger.writeOffStock.useMutation({ onSuccess: () => { done(); toast.success(L({ ku: "وەک خەسارە تۆمار کرا", en: "Written off as a loss", ar: "سُجِّل كخسارة", zh: "已记为损失" })); }, onError });
  const toStore = trpc.ledger.listStockInStore.useMutation({ onSuccess: () => { done(); toast.success(L({ ku: "خرایە ناو وەزن ستۆر", en: "Listed in Wazn Store", ar: "أُضيف إلى متجر وزن", zh: "已上架 Wazn 商店" })); }, onError });

  const summary = useMemo(() => {
    const by = (fault: "customer" | "office") => {
      const list = rows.filter((r) => r.fault === fault);
      return { count: list.length, kept: list.reduce((s, r) => s + r.keptUsd, 0), outcome: list.reduce((s, r) => s + stockOutcomeUsd(r), 0), result: list.reduce((s, r) => s + stockResultUsd(r), 0) };
    };
    return { customer: by("customer"), office: by("office") };
  }, [rows]);
  const heldCost = held.reduce((s, r) => s + r.costUsd, 0);
  const lossSoFar = rows.reduce((s, r) => s + stockLossSoFarUsd(r), 0);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-6" data-testid="company-stock">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold"><PackageX className="h-5 w-5" />{L({ ku: "کاڵای ماوە", en: "Company stock", ar: "مخزون الشركة", zh: "公司库存" })}</h1>
          <p className="text-sm text-muted-foreground">
            {L({
              ku: "ئەو کاڵایانەی کڕیار وەریناگرێت یان بە هەڵە داواکراون. هی شەریکەن بە تێچووی خۆیان، تا دەفرۆشرێن یان فڕێ دەدرێن.",
              en: "Goods a customer will not take, or that were ordered by mistake. The company's own, at cost, until sold or written off.",
              ar: "بضائع لا يستلمها العميل أو طُلبت بالخطأ. ملك للشركة بتكلفتها حتى تُباع أو تُشطب.",
              zh: "客户不收或误订的货物，按成本归公司所有，直到售出或核销。",
            })}
          </p>
        </div>

        {isMainAdmin && <RefuseForm L={L} initialCode={new URLSearchParams(search).get("order") ?? ""} />}

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "لە دەستماندایە", en: "On our hands", ar: "في حوزتنا", zh: "在手" })}</div>
                <div className="text-2xl font-semibold"><bdi dir="ltr">{held.length}</bdi></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: "خەسارەی تا ئێستا", en: "Loss so far", ar: "الخسارة حتى الآن", zh: "迄今亏损" })}</div>
                <div className={cn("text-2xl font-semibold", lossSoFar > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}><Money value={-lossSoFar} signed /></div>
                <div className="text-xs text-muted-foreground">{L({ ku: "لەوە، هێشتا لە دەستماندایە", en: "of it, still on our hands", ar: "منها، ما زال في حوزتنا", zh: "其中仍在手" })} <Money value={heldCost} /></div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground">{L({ ku: `زیاتر لە ${STOCK_OLD_DAYS} ڕۆژ ماوەتەوە`, en: `Held over ${STOCK_OLD_DAYS} days`, ar: `أكثر من ${STOCK_OLD_DAYS} يوماً`, zh: `超过 ${STOCK_OLD_DAYS} 天` })}</div>
                <div className={cn("text-2xl font-semibold", held.some((r) => r.old) && "text-red-700 dark:text-red-400")}><bdi dir="ltr">{held.filter((r) => r.old).length}</bdi></div>
              </div>
            </div>

            <Input
              dir="ltr"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={L({ ku: "بە تراک، کۆد، کاڵا یان کڕیار بگەڕێ", en: "Search by tracking, code, product or customer", ar: "ابحث بالتتبع أو الرمز أو المنتج أو العميل", zh: "按运单号、编号、商品或客户搜索" })}
              data-testid="stock-search"
            />

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{L({ ku: "کاڵای خەسارە — لە دەستماندایە", en: "Loss goods — on our hands", ar: "بضائع خاسرة — في حوزتنا", zh: "亏损货物 — 在手" })}</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {held.length === 0 ? (
                  <p className="py-2 text-muted-foreground">{L({ ku: "هیچ کاڵایەک نەماوەتەوە.", en: "Nothing is held.", ar: "لا شيء في الحوزة.", zh: "没有库存。" })}</p>
                ) : (
                  <ul className="divide-y">
                    {held.map((r) => (
                      <li key={r.id} className="py-2">
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{r.productName ?? "—"} × <bdi dir="ltr">{r.quantity}</bdi></span>
                            <span className="block text-xs text-muted-foreground">
                              {r.trackingNumber ? <><bdi dir="ltr" className="font-medium text-foreground">{r.trackingNumber}</bdi> · </> : null}
                              {r.orderId ? <Link href={`/full-package/${r.orderId}`} className="underline"><bdi dir="ltr">{r.orderCode}</bdi></Link> : <bdi dir="ltr">{r.orderCode}</bdi>} ·{" "}
                              {r.customerId ? <Link href={`/finance/customer/${r.customerId}`} className="underline">{r.customerName ?? r.customerCode}</Link> : "—"} ·{" "}
                              {L(REFUSAL_REASON_WORDS[r.reason])}{r.note ? ` — ${r.note}` : ""} ·{" "}
                              <span className={cn(r.old && "text-red-700 dark:text-red-400")}>{L({ ku: `${r.days} ڕۆژ`, en: `${r.days} days`, ar: `${r.days} يوماً`, zh: `${r.days} 天` })}</span>
                              {r.by ? <> · {r.by}</> : null}
                              {r.keptUsd > 0 && <> · {L({ ku: "لە کڕیار مایەوە", en: "kept from the customer", ar: "احتُفظ به من العميل", zh: "从客户保留" })} <Money value={r.keptUsd} /></>}
                              {r.storeProductId ? <> · {L({ ku: "لە وەزن ستۆردایە", en: "in Wazn Store", ar: "في متجر وزن", zh: "已上架" })}</> : null}
                            </span>
                          </span>
                          <span className="shrink-0 text-end">
                            <Money value={-stockLossSoFarUsd(r)} signed className={cn("font-medium", stockLossSoFarUsd(r) > 0 && "text-red-700 dark:text-red-400")} />
                            <span className="block text-xs text-muted-foreground">{L({ ku: "تێچوو", en: "cost", ar: "التكلفة", zh: "成本" })} <Money value={r.costUsd} /></span>
                          </span>
                        </div>
                        {isMainAdmin && acting?.id !== r.id && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setActing({ id: r.id, kind: "sell" })}>{L({ ku: "فرۆشرا", en: "Sold", ar: "بِيع", zh: "已售" })}</Button>
                            {!r.storeProductId && <Button size="sm" variant="outline" className="h-8" onClick={() => setActing({ id: r.id, kind: "store" })}>{L({ ku: "بیخە ناو وەزن ستۆر", en: "List in Wazn Store", ar: "أضف إلى متجر وزن", zh: "上架 Wazn 商店" })}</Button>}
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setActing({ id: r.id, kind: "writeOff" })}>{L({ ku: "فڕێ درا / ون بوو", en: "Written off", ar: "شُطب", zh: "核销" })}</Button>
                          </div>
                        )}
                        {acting?.id === r.id && (
                          <div className="mt-2 space-y-2 rounded-lg border p-3" data-testid="stock-action">
                            {acting.kind !== "writeOff" && (
                              <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">{acting.kind === "sell" ? L({ ku: "بە چەند فرۆشرا ($)", en: "Sold for ($)", ar: "بِيع بـ ($)", zh: "售价 ($)" }) : L({ ku: "نرخی فرۆشتن لە ستۆر ($)", en: "Store price ($)", ar: "سعر المتجر ($)", zh: "商店售价 ($)" })}</span>
                                <Input dir="ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(r.costUsd)} />
                              </label>
                            )}
                            {acting.kind === "sell" && (
                              <>
                                <label className="block space-y-1">
                                  <span className="text-xs text-muted-foreground">{L({ ku: "کۆدی کڕیار، ئەگەر بە قەرز فرۆشرا (بەتاڵ = نەقد)", en: "Customer code if sold on account (empty = cash)", ar: "رمز العميل إن بِيع بالآجل (فارغ = نقداً)", zh: "若赊销请填客户编号（留空 = 现金）" })}</span>
                                  <Input dir="ltr" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="AZ018" />
                                </label>
                                {price.trim() !== "" && Number.isFinite(Number(price)) && (
                                  <p className={cn(Number(price) + r.keptUsd < r.costUsd ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                                    {L({ ku: "دەگەڕێتەوە", en: "Comes back", ar: "يعود", zh: "收回" })} <Money value={Number(price)} /> ·{" "}
                                    {Number(price) + r.keptUsd < r.costUsd ? L({ ku: "خەسارەی کۆتایی", en: "final loss", ar: "الخسارة النهائية", zh: "最终亏损" }) : L({ ku: "قازانجی کۆتایی", en: "final profit", ar: "الربح النهائي", zh: "最终盈利" })}: <Money value={Math.abs(Number(price) + r.keptUsd - r.costUsd)} />
                                  </p>
                                )}
                              </>
                            )}
                            {acting.kind !== "store" && (
                              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={acting.kind === "writeOff" ? L({ ku: "چی بەسەر کاڵاکەدا هات (پێویستە)", en: "What happened to it (required)", ar: "ماذا حدث لها (مطلوب)", zh: "货物情况（必填）" }) : L({ ku: "تێبینی (ئارەزوومەندانە)", en: "Note (optional)", ar: "ملاحظة (اختياري)", zh: "备注（可选）" })} />
                            )}
                            {acting.kind === "writeOff" && <p className="text-red-700 dark:text-red-400">{L({ ku: "خەسارە", en: "Loss", ar: "خسارة", zh: "亏损" })}: <Money value={r.costUsd} /></p>}
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setActing(null)}>{L({ ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}</Button>
                              <Button
                                size="sm"
                                disabled={sell.isPending || writeOff.isPending || toStore.isPending || (acting.kind !== "writeOff" && !(Number(price) >= 0 && price.trim() !== "")) || (acting.kind === "writeOff" && !note.trim())}
                                onClick={() => {
                                  if (acting.kind === "sell") sell.mutate({ stockId: r.id, priceUsd: Number(price), customerCode: buyer.trim() || undefined, note: note.trim() || undefined });
                                  else if (acting.kind === "store") toStore.mutate({ stockId: r.id, priceUsd: Number(price) });
                                  else writeOff.mutate({ stockId: r.id, note: note.trim() });
                                }}
                              >
                                {L({ ku: "بەڵێ", en: "Yes", ar: "نعم", zh: "确定" })}
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{L({ ku: "ئەنجام بە پێی هۆکار", en: "Result by side", ar: "النتيجة حسب الجهة", zh: "按责任方汇总" })}</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {(["customer", "office"] as const).map((side) => (
                  <div key={side} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0">
                    <span>
                      {side === "customer" ? L({ ku: "لە لایەن کڕیارەوە", en: "Customer's side", ar: "من جهة العميل", zh: "客户方" }) : L({ ku: "هەڵەی ئۆفیس یان دواکەوتن", en: "Office's side or lateness", ar: "من جهة المكتب أو التأخير", zh: "办公室方或延误" })}{" "}
                      <span className="text-xs text-muted-foreground">· {L({ ku: `${summary[side].count} جار`, en: `${summary[side].count} times`, ar: `${summary[side].count} مرة`, zh: `${summary[side].count} 次` })}</span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-x-3 text-xs">
                      <span>{L({ ku: "مایەوە", en: "kept", ar: "احتُفظ", zh: "保留" })} <Money value={summary[side].kept} /></span>
                      <span>{L({ ku: "فرۆشتن و فڕێدان", en: "sold and written off", ar: "بيع وشطب", zh: "售出与核销" })} <Money value={summary[side].outcome} signed /></span>
                      <Money value={summary[side].result} signed className={cn("text-sm font-semibold", summary[side].result < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")} />
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {closed.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">{L({ ku: "داخراوەکان", en: "Closed", ar: "المغلقة", zh: "已结束" })}</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <ul className="divide-y">
                    {closed.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{r.productName ?? "—"} × <bdi dir="ltr">{r.quantity}</bdi></span>
                          <span className="block text-xs text-muted-foreground">
                            {r.trackingNumber ? <><bdi dir="ltr">{r.trackingNumber}</bdi> · </> : null}<bdi dir="ltr">{r.orderCode}</bdi> · {L(REFUSAL_REASON_WORDS[r.reason])} ·{" "}
                            {r.status === "sold" ? <>{L({ ku: "فرۆشرا بە", en: "sold for", ar: "بِيع بـ", zh: "售价" })} <Money value={r.soldPriceUsd ?? 0} /></> : L({ ku: "فڕێ درا", en: "written off", ar: "شُطب", zh: "已核销" })} ·{" "}
                            {L({ ku: "تێچوو", en: "cost", ar: "التكلفة", zh: "成本" })} <Money value={r.costUsd} />
                            {r.closeNote ? ` — ${r.closeNote}` : ""}
                          </span>
                        </span>
                        <Money value={stockOutcomeUsd(r)} signed className={cn("shrink-0 font-medium", stockOutcomeUsd(r) < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")} />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
