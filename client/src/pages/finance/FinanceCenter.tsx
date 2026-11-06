import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Banknote, Clock, Info, Landmark, MessageCircle, Package, PiggyBank, Receipt, Ship, TrendingUp, TriangleAlert, Users, Wallet,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { DebtWhatsAppButton } from "@/components/finance/DebtWhatsAppButton";

/**
 * The finance centre (owner, 2026-11-05, point 36/39): one screen, the few
 * figures that matter, each with a plain line saying what it is, and its
 * detail opening beside it instead of on another page. Every number is read
 * from the same reports as before (ledger.financeDashboard, which carries
 * working capital for the main admin): nothing here is computed twice.
 */
type Words = { ku: string; en: string; ar: string; zh: string };
type Drawer = "debt" | "received" | "profit" | "cash" | "road" | "waiting" | "shelf" | "giveaways" | null;

const usd = (n: number, signed = false) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const s = `$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return v < 0 ? `−${s}` : signed && v > 0 ? `+${s}` : s;
};

function Num({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  return <bdi dir="ltr" className={cn("font-mono tabular-nums", className)}>{usd(value, signed)}</bdi>;
}

const TONES = {
  rose: "border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100",
  emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  sky: "border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100",
  violet: "border-violet-200 bg-violet-50/70 text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-100",
  amber: "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
  slate: "border-slate-200 bg-slate-50/70 text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100",
} as const;

function Tile({ tone, icon, label, info, value, sub, onOpen, testId }: {
  tone: keyof typeof TONES; icon: ReactNode; label: string; info: string; value: ReactNode; sub?: ReactNode; onOpen: () => void; testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      className={cn("group flex min-h-[118px] flex-col justify-between rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400", TONES[tone])}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium opacity-90">{icon}{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span role="img" aria-label={info} onClick={(e) => e.stopPropagation()} className="rounded-full p-1 opacity-70 hover:opacity-100">
              <Info className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-xs leading-relaxed">{info}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs opacity-80">{sub}</div>}
    </button>
  );
}

function Line({ label, children, href, tone }: { label: ReactNode; children: ReactNode; href?: string; tone?: "good" | "bad" | "quiet" }) {
  const body = (
    <div className={cn("flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0",
      tone === "bad" && "text-rose-700 dark:text-rose-300", tone === "good" && "text-emerald-700 dark:text-emerald-300", tone === "quiet" && "text-muted-foreground")}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  );
  return href ? <Link href={href} className="block hover:bg-muted/50">{body}</Link> : body;
}

export default function FinanceCenter() {
  const { language } = useTranslation();
  const L = (w: Words) => pickLang(language, w);
  const isMainAdmin = useAuth().user?.role === "super_admin";
  const [period, setPeriod] = useState<"month" | "lastMonth" | "year">("month");
  const [open, setOpen] = useState<Drawer>(null);
  const { data, isLoading } = trpc.ledger.financeDashboard.useQuery({ period });
  // Boxes asleep on the shelf (point 41.2): not sent, not paid.
  const { data: shelf } = trpc.deliveryBox.warehouseShelf.useQuery();
  const shelfBoxes = shelf ?? [];
  const shelfUsd = shelfBoxes.reduce((t, b) => t + b.valueUsd, 0);
  const shelfOld = shelfBoxes.filter((b) => b.days > 14);

  const cap = data?.capital ?? null;
  const received = (data?.received ?? { usd: 0, count: 0, byMethod: [] }) as { usd: number; count: number; byMethod?: Array<{ method: string; usd: number; count: number }> };
  const waiting = data
    ? [
        { n: data.waiting.boxPaidOwed, href: "/finance/box-double-charges", w: { ku: "کڕیار بۆ بۆکسێکی واسڵکراو وەک قەرزار دەردەکەون", en: "customers shown owing for a box they paid", ar: "عملاء مدينون بصندوق سدّدوه", zh: "已付箱子仍显示欠款" } },
        { n: data.waiting.boxesUnpaid, href: "/customer-delivery-scanner?unpaid=1", w: { ku: "بۆکس دراوەتە دەست و پارەی نەهاتووە", en: "boxes handed over and not paid", ar: "صناديق سُلّمت ولم تُدفع", zh: "已交付未付款箱子" } },
        { n: data.waiting.batchesWithoutCost, href: "/batches", w: { ku: "باچی گەیشتوو نرخی تێچوویان نییە", en: "arrived batches with no cost", ar: "شحنات بلا تكلفة", zh: "无成本批次" } },
        { n: data.waiting.unbilledArrived, href: "/settings/data-management", w: { ku: "کاڵای گەیشتوو لەسەر کڕیار نەنووسراوە", en: "arrived goods not on the account", ar: "بضائع لم تُقيَّد", zh: "未记账到货" } },
        { n: data.waiting.oldDebtors, href: "/finance/debtors", w: { ku: "کڕیار قەرزیان لە 30 ڕۆژ کۆنترە", en: "customers owing over 30 days", ar: "ديون أقدم من 30 يوماً", zh: "欠款超 30 天" } },
        { n: data.waiting.whatsappUnsent, href: "/customer-delivery-scanner?whatsapp=unsent", w: { ku: "وەسڵ بە واتسئەپ نەنێردراوە", en: "receipts not sent on WhatsApp", ar: "إيصالات لم تُرسل", zh: "未发送收据" } },
        { n: (data.waiting as { financeCopyMissing?: number }).financeCopyMissing ?? 0, href: "/finance/working-capital", w: { ku: "کۆپیی ئەمڕۆی حیسابات دانەگیراوە", en: "today's copy of the accounts not taken", ar: "لم تُحفظ نسخة اليوم من الحسابات", zh: "今日账目副本未下载" } },
      ].filter((w) => w.n > 0)
    : [];
  const methodName = (m: string) => (m === "CASH" ? L({ ku: "کاش", en: "Cash", ar: "نقد", zh: "现金" }) : m === "CARD" ? "Qi Card" : m === "FIB" ? "FIB" : `${L({ ku: "تر", en: "Other", ar: "أخرى", zh: "其他" })} (${m})`);

  const titles: Record<Exclude<Drawer, null>, Words> = {
    debt: { ku: "قەرزی کڕیاران", en: "Customers owe", ar: "ديون العملاء", zh: "客户欠款" },
    received: { ku: "پارەی هاتوو", en: "Money received", ar: "المبالغ المستلمة", zh: "已收款" },
    profit: { ku: "قازانجی خاوێن", en: "Clean profit", ar: "صافي الربح", zh: "净利润" },
    cash: { ku: "پارەی دەست", en: "Cash in hand", ar: "النقد", zh: "现金" },
    road: { ku: "کاڵای ڕێگا", en: "Goods on the road", ar: "بضائع في الطريق", zh: "在途货物" },
    waiting: { ku: "چاوەڕێی تۆن", en: "Waiting for you", ar: "بانتظارك", zh: "待处理" },
    shelf: { ku: "بۆکسی کەڵەکەبوو لە کۆگا", en: "Boxes asleep in the warehouse", ar: "صناديق متراكمة في المخزن", zh: "仓库积压箱子" },
    giveaways: { ku: "داشکان و لێخۆشبوون", en: "Discounts and write-offs", ar: "الخصومات والإعفاءات", zh: "折扣与减免" },
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5 p-3 sm:p-6" data-testid="finance-center">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{L({ ku: "ناوەندی دارایی", en: "Finance centre", ar: "المركز المالي", zh: "财务中心" })}</h1>
            <p className="text-sm text-muted-foreground">{L({ ku: "هەر کارتێک بکەرەوە بۆ وردەکاری — لەسەر هەمان شاشە.", en: "Open any card for its detail — on this screen.", ar: "افتح أي بطاقة لتفاصيلها — على هذه الشاشة.", zh: "点击任一卡片查看详情 — 在本页。" })}</p>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {([["month", { ku: "ئەم مانگە", en: "This month", ar: "هذا الشهر", zh: "本月" }], ["lastMonth", { ku: "مانگی پێشوو", en: "Last month", ar: "الشهر الماضي", zh: "上月" }], ["year", { ku: "ئەمساڵ", en: "This year", ar: "هذا العام", zh: "今年" }]] as Array<[typeof period, Words]>).map(([k, w]) => (
              <button key={k} type="button" onClick={() => setPeriod(k)} className={cn("rounded-lg px-3 py-1.5 text-sm", period === k ? "bg-background font-semibold shadow-sm" : "text-muted-foreground")}>{L(w)}</button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile testId="fc-debt" tone="rose" icon={<Users className="h-4 w-4" />} label={L(titles.debt)}
              info={L({ ku: "ئەو پارەیەی کڕیاران لەسەریانە ئێستا. حیسابی ناوخۆی کۆمپانیا تێیدا نییە.", en: "What customers owe right now. The company's own account is not in it.", ar: "ما على العملاء الآن، دون حساب الشركة الداخلي.", zh: "客户当前欠款，不含公司内部账户。" })}
              value={<Num value={data.debt.usd} />} sub={L({ ku: `${data.debt.debtors} کڕیار · ${data.debt.old.count} زیاتر لە 30 ڕۆژ`, en: `${data.debt.debtors} customers · ${data.debt.old.count} over 30 days`, ar: `${data.debt.debtors} عميل · ${data.debt.old.count} أكثر من 30 يوماً`, zh: `${data.debt.debtors} 位 · ${data.debt.old.count} 超 30 天` })}
              onOpen={() => setOpen("debt")} />
            <Tile testId="fc-received" tone="emerald" icon={<Wallet className="h-4 w-4" />} label={L(titles.received)}
              info={L({ ku: "پارەی وەرگیراو لەم ماوەیەدا، کەم ئەوەی هەڵوەشێنراوەتەوە. قەرەبوو و داشکان تێیدا نین.", en: "Money taken in this period, less what was undone. Compensation and discounts are not in it.", ar: "المقبوض في الفترة ناقص الملغى، دون التعويضات والخصومات.", zh: "本期实收减撤销，不含补偿与折扣。" })}
              value={<Num value={received.usd} />} sub={L({ ku: `${received.count} وەسڵ`, en: `${received.count} receipts`, ar: `${received.count} إيصال`, zh: `${received.count} 张` })}
              onOpen={() => setOpen("received")} />
            <Tile testId="fc-profit" tone={data.profit.netUsd < 0 ? "rose" : "violet"} icon={<TrendingUp className="h-4 w-4" />} label={L(titles.profit)}
              info={L({ ku: "قازانجی کار (عمولە + باچەکان دوای تێچووی گواستنەوە + فول پاکێج + زیادە و خزمەتگوزاری) کەم مەسارف. پارەی کاڵا قازانج نییە.", en: "Work profit (commission + batches after carrier cost + full package + extras and services) less expenses. Money for goods is not profit.", ar: "ربح العمل ناقص المصاريف. ثمن البضاعة ليس ربحاً.", zh: "经营利润减费用。货款不是利润。" })}
              value={<Num value={data.profit.netUsd} signed />} sub={L({ ku: `کار ${usd(data.profit.workUsd)} · مەسارف ${usd(data.profit.expensesUsd)}`, en: `work ${usd(data.profit.workUsd)} · expenses ${usd(data.profit.expensesUsd)}`, ar: `العمل ${usd(data.profit.workUsd)} · المصاريف ${usd(data.profit.expensesUsd)}`, zh: `经营 ${usd(data.profit.workUsd)} · 费用 ${usd(data.profit.expensesUsd)}` })}
              onOpen={() => setOpen("profit")} />
            {isMainAdmin && cap && (
              <>
                <Tile testId="fc-cash" tone={cap.netCashUsd < 0 ? "rose" : "sky"} icon={<Banknote className="h-4 w-4" />} label={L(titles.cash)}
                  info={L({ ku: "لە تۆمارەکانەوە دەژمێردرێت، هیچ شتێک نانووسرێت: ئەوەی دەبێت لە کارەکەدا بێت، کەم قەرزی کڕیاران و کاڵای ڕێگا. قەرزی کۆمپانیای گواستنەوەی لێ دەرکراوە.", en: "Derived from the records, never typed: what should be in the work, less customer debt and goods on the road; carriers owed are already out.", ar: "محسوب من السجلات: ما يجب أن يكون في العمل ناقص الديون والبضائع.", zh: "由记录推算，从不手填。" })}
                  value={<Num value={cap.netCashUsd} />} sub={cap.cashDays !== null ? L({ ku: `بەشی ${cap.cashDays} ڕۆژ مەسارف دەکات`, en: `covers ${cap.cashDays} days of costs`, ar: `يكفي ${cap.cashDays} يوماً`, zh: `可覆盖 ${cap.cashDays} 天` }) : undefined}
                  onOpen={() => setOpen("cash")} />
                <Tile testId="fc-road" tone="amber" icon={<Ship className="h-4 w-4" />} label={L(titles.road)}
                  info={L({ ku: "کاڵای کڕدراو کە هێشتا لەسەر کڕیار نەنووسراوە، بە نرخی کڕین.", en: "Goods bought and not yet on the customer, at what they cost.", ar: "بضائع مشتراة لم تُقيَّد بعد، بسعر الشراء.", zh: "已购未记账货物，按成本。" })}
                  value={<Num value={cap.goodsOnRoadUsd} />} onOpen={() => setOpen("road")} />
              </>
            )}
            <Tile testId="fc-shelf" tone={shelfOld.length > 0 ? "amber" : "slate"} icon={<Package className="h-4 w-4" />} label={L(titles.shelf)}
              info={L({ ku: "ئەو بۆکسانەی لە کۆگای هەولێرن، کاڵایان تێدایە، نەنێردراون و پارەیان نەدراوە: پارەی کۆمپانیا کە لە ڕەفەکاندا خەوتووە.", en: "Boxes in the Erbil warehouse with goods, not sent and not paid: company money asleep on the shelves.", ar: "صناديق في مخزن أربيل بها بضائع، لم تُرسل ولم تُدفع.", zh: "埃尔比勒仓库中未发出未付款的箱子。" })}
              value={<Num value={shelfUsd} />} sub={L({ ku: `${shelfBoxes.length} بۆکس · ${shelfOld.length} زیاتر لە 14 ڕۆژ`, en: `${shelfBoxes.length} boxes · ${shelfOld.length} over 14 days`, ar: `${shelfBoxes.length} صندوق · ${shelfOld.length} أكثر من 14 يوماً`, zh: `${shelfBoxes.length} 箱 · ${shelfOld.length} 超 14 天` })}
              onOpen={() => setOpen("shelf")} />
            <Tile testId="fc-giveaways" tone="amber" icon={<Receipt className="h-4 w-4" />} label={L(titles.giveaways)}
              info={L({ ku: "هەموو ئەو پارەیەی لێی خۆش بووین: داشکانی سەر وەسڵی بۆکس، قەرەبوو (CBM، کاڵای تێکچوو)، و کەمکردنەوەی دەستی. ڕاستکردنەوەی هەڵە تێیدا نییە. کێ، بۆ کێ، بۆچی.", en: "Everything let go: box receipt discounts, compensation (CBM, damaged goods) and hand credits. Corrections of mistakes are not in it. Who, for whom, why.", ar: "كل ما تم التنازل عنه: خصومات، تعويضات، تخفيضات يدوية.", zh: "所有让利：箱子折扣、补偿和手动减免。" })}
              value={<Num value={(data.discounts?.usd ?? 0) + (data.writeOffs?.usd ?? 0)} />}
              sub={L({ ku: `${(data.discounts?.count ?? 0) + (data.writeOffs?.count ?? 0)} جار`, en: `${(data.discounts?.count ?? 0) + (data.writeOffs?.count ?? 0)} times`, ar: `${(data.discounts?.count ?? 0) + (data.writeOffs?.count ?? 0)} مرة`, zh: `${(data.discounts?.count ?? 0) + (data.writeOffs?.count ?? 0)} 次` })}
              onOpen={() => setOpen("giveaways")} />
            <Tile testId="fc-waiting" tone={waiting.length > 0 ? "amber" : "slate"} icon={<Clock className="h-4 w-4" />} label={L(titles.waiting)}
              info={L({ ku: "ئەو شتانەی پێویستیان بە تۆیە بۆ ئەوەی ژمارەکان ڕاست بمێننەوە.", en: "What needs you so the figures stay true.", ar: "ما يحتاجك لتبقى الأرقام صحيحة.", zh: "需要您处理以保持数字准确的事项。" })}
              value={<span className="font-mono">{waiting.reduce((t, w) => t + w.n, 0)}</span>} sub={waiting.length === 0 ? L({ ku: "هیچ شتێک نییە", en: "Nothing waiting", ar: "لا شيء", zh: "无" }) : undefined}
              onOpen={() => setOpen("waiting")} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["/finance/working-capital", { ku: "سەرمایەی کار", en: "Working capital", ar: "رأس المال العامل", zh: "营运资金" }, PiggyBank],
            ["/finance/debt-reminders", { ku: "یادخستنەوەی قەرزداران", en: "Debt reminders", ar: "تذكير المدينين", zh: "催款提醒" }, MessageCircle],
            ["/company/expenses", { ku: "مەسارف", en: "Expenses", ar: "المصاريف", zh: "费用" }, Receipt],
            ["/finance/balance-sheet", { ku: "بالانس شیت", en: "Balance sheet", ar: "الميزانية", zh: "资产负债表" }, Landmark],
          ].map(([href, w, Icon]) => {
            const I = Icon as typeof PiggyBank;
            return <Link key={href as string} href={href as string} className="flex items-center gap-1 rounded-full border px-3 py-1.5 hover:bg-muted"><I className="h-3.5 w-3.5" />{L(w as Words)}</Link>;
          })}
        </div>
      </div>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md" data-testid="finance-center-drawer">
          {open && data && (
            <>
              <SheetHeader>
                <SheetTitle>{L(titles[open])}</SheetTitle>
                <SheetDescription className="sr-only">{L(titles[open])}</SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                {open === "debt" && (
                  <>
                    <Line label={L({ ku: "کۆی قەرز", en: "Total owed", ar: "المجموع", zh: "合计" })}><Num value={data.debt.usd} className="font-semibold" /></Line>
                    <Line tone="bad" label={L({ ku: `زیاتر لە 30 ڕۆژ — ${data.debt.old.count} کڕیار`, en: `Over 30 days — ${data.debt.old.count}`, ar: `أكثر من 30 يوماً — ${data.debt.old.count}`, zh: `超 30 天 — ${data.debt.old.count}` })} href="/finance/debtors"><Num value={data.debt.old.usd} /></Line>
                    <div className="mt-4 mb-1 text-xs text-muted-foreground">{L({ ku: "گەورەترین قەرزداران", en: "Largest debtors", ar: "أكبر المدينين", zh: "最大欠款人" })}</div>
                    {data.debt.top.map((t) => (
                      <div key={t.customerId} className="flex items-center justify-between gap-2 border-b py-2 text-sm">
                        <Link href={`/finance/customer/${t.customerId}`} className="min-w-0 truncate hover:underline">{t.name ?? t.code}</Link>
                        <span className="flex items-center gap-2">
                          <Num value={t.usd} />
                          <DebtWhatsAppButton customer={{ id: t.customerId, fullName: t.name, customerCode: t.code }} owedUsd={t.usd} size="icon" />
                        </span>
                      </div>
                    ))}
                    <Link href="/finance/debt-reminders" className="mt-3 block text-sm text-sky-700 underline dark:text-sky-300">{L({ ku: "هەموو قەرزداران و یادخستنەوە", en: "All debtors and reminders", ar: "كل المدينين والتذكير", zh: "全部欠款人与提醒" })}</Link>
                  </>
                )}
                {open === "received" && (
                  <>
                    <Line label={L({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}><Num value={received.usd} className="font-semibold" /></Line>
                    {(received.byMethod ?? []).map((m) => (
                      <Line key={m.method} label={<span>{methodName(m.method)} <span className="text-xs text-muted-foreground">· {m.count}</span></span>}><Num value={m.usd} /></Line>
                    ))}
                    <p className="mt-3 text-xs text-muted-foreground">{L({ ku: "ژمارەی FIB و Qi بەراورد بکە لەگەڵ ئەپەکان. جیاوازی واتە پارەیەک تۆمار نەکراوە یان نەگەیشتووە.", en: "Check FIB and Qi against the apps. A difference means a payment unrecorded or never arrived.", ar: "قارن FIB و Qi بالتطبيقين.", zh: "与 FIB、Qi 应用核对。" })}</p>
                    <Link href="/payments" className="mt-2 block text-sm text-sky-700 underline dark:text-sky-300">{L({ ku: "هەموو وەسڵەکان", en: "All receipts", ar: "كل الإيصالات", zh: "全部收据" })}</Link>
                  </>
                )}
                {open === "profit" && (
                  <>
                    <Line tone="good" label={L({ ku: `قازانجی باچەکان — ${data.profit.parcels} پاکەت`, en: `Batches — ${data.profit.parcels} parcels`, ar: `الشحنات — ${data.profit.parcels}`, zh: `批次 — ${data.profit.parcels}` })} href="/batches"><Num value={data.profit.freightUsd} signed /></Line>
                    <Line tone="good" label={L({ ku: `عمولە و فول پاکێج — ${data.profit.orders} داواکاری`, en: `Commission and full package — ${data.profit.orders}`, ar: `العمولة والطرد الكامل — ${data.profit.orders}`, zh: `佣金与整包 — ${data.profit.orders}` })} href="/reports/profit"><Num value={data.profit.ordersUsd} signed /></Line>
                    {data.profit.stockUsd !== 0 && <Line tone={data.profit.stockUsd < 0 ? "bad" : "good"} label={L({ ku: "کاڵای ڕەتکراوە", en: "Refused goods", ar: "بضائع مرفوضة", zh: "拒收货物" })} href="/company-stock"><Num value={data.profit.stockUsd} signed /></Line>}
                    {(data.profit.extrasUsd ?? 0) !== 0 && <Line tone="good" label={L({ ku: "زیادەی بۆکس و خزمەتگوزاری", en: "Box extras and services", ar: "الإضافات والخدمات", zh: "附加与服务" })} href="/finance/extra-costs"><Num value={data.profit.extrasUsd ?? 0} signed /></Line>}
                    <Line tone="bad" label={L({ ku: `مەسارف — ${data.profit.expenseCount} دێڕ`, en: `Expenses — ${data.profit.expenseCount}`, ar: `المصاريف — ${data.profit.expenseCount}`, zh: `费用 — ${data.profit.expenseCount}` })} href="/company/expenses"><Num value={-data.profit.expensesUsd} /></Line>
                    <div className="flex items-center justify-between border-t-2 py-2 font-semibold"><span>{L(titles.profit)}</span><Num value={data.profit.netUsd} signed /></div>
                    {data.lossBatches.length > 0 && (
                      <div className="mt-3 rounded-lg border border-rose-200 p-2 dark:border-rose-900/60">
                        <div className="mb-1 text-xs text-rose-700 dark:text-rose-300">{L({ ku: "باچی زەرەرمەند", en: "Batches at a loss", ar: "شحنات خاسرة", zh: "亏损批次" })}</div>
                        {data.lossBatches.map((b) => <Line key={b.batchId} tone="bad" label={b.code} href={`/batches/${b.batchId}/financial`}><Num value={-b.lossUsd} /></Line>)}
                      </div>
                    )}
                  </>
                )}
                {open === "cash" && cap && (
                  <>
                    <Line label={L({ ku: "دەبێت لە کارەکەدا بێت", en: "Should be in the work", ar: "يجب أن يكون في العمل", zh: "应在业务中" })}><Num value={cap.shouldHoldUsd} className="font-semibold" /></Line>
                    <Line tone="quiet" label={L({ ku: "− لای کڕیارانە (قەرز)", en: "− with customers (debt)", ar: "− عند العملاء", zh: "− 客户欠款" })} href="/finance/debtors"><Num value={-cap.debtUsd} /></Line>
                    <Line tone="quiet" label={L({ ku: "− کاڵای ڕێگا (بە نرخی کڕین)", en: "− goods on the road (at cost)", ar: "− بضائع الطريق", zh: "− 在途货物" })} href="/finance/goods-on-road"><Num value={-cap.goodsOnRoadUsd} /></Line>
                    <div className="flex items-center justify-between border-t-2 py-2 font-semibold"><span>{L(titles.cash)}</span><Num value={cap.netCashUsd} /></div>
                    <Link href="/finance/working-capital" className="mt-2 block text-sm text-sky-700 underline dark:text-sky-300">{L({ ku: "سەرمایەی کار و پشکنینی FIB / Qi", en: "Working capital and the FIB / Qi check", ar: "رأس المال العامل وفحص FIB / Qi", zh: "营运资金与 FIB / Qi 核对" })}</Link>
                  </>
                )}
                {open === "road" && cap && (
                  <>
                    <Line label={L({ ku: "بە نرخی کڕین", en: "At cost", ar: "بسعر الشراء", zh: "按成本" })}><Num value={cap.goodsOnRoadUsd} className="font-semibold" /></Line>
                    <p className="mt-2 text-xs text-muted-foreground">{L({ ku: "کاتێک دەگەن و دەچنە بۆکس، لەسەر کڕیار دەنووسرێن و لێرە دەردەچن.", en: "When they arrive and go into a box they are written on the customer and leave this figure.", ar: "عند وصولها ودخولها صندوقاً تُقيَّد على العميل.", zh: "到货入箱后记入客户并离开此数。" })}</p>
                    <Link href="/finance/goods-on-road" className="mt-2 block text-sm text-sky-700 underline dark:text-sky-300">{L({ ku: "لیستی کاڵای ڕێگا", en: "Goods on the road list", ar: "قائمة بضائع الطريق", zh: "在途货物列表" })}</Link>
                  </>
                )}
                {open === "shelf" && (
                  <>
                    <Line label={L({ ku: "کۆی بەهای بۆکسەکان", en: "Value of the boxes", ar: "قيمة الصناديق", zh: "箱子总值" })}><Num value={shelfUsd} className="font-semibold" /></Line>
                    {([[0, 7], [8, 14], [15, 30], [31, 100000]] as Array<[number, number]>).map(([a, b]) => {
                      const part = shelfBoxes.filter((x) => x.days >= a && x.days <= b);
                      if (part.length === 0) return null;
                      return <Line key={a} tone={a >= 15 ? "bad" : "quiet"} label={b > 1000 ? L({ ku: `زیاتر لە 30 ڕۆژ — ${part.length}`, en: `Over 30 days — ${part.length}`, ar: `أكثر من 30 يوماً — ${part.length}`, zh: `超 30 天 — ${part.length}` }) : L({ ku: `${a}–${b} ڕۆژ — ${part.length}`, en: `${a}–${b} days — ${part.length}`, ar: `${a}–${b} يوماً — ${part.length}`, zh: `${a}–${b} 天 — ${part.length}` })}><Num value={part.reduce((t, x) => t + x.valueUsd, 0)} /></Line>;
                    })}
                    <div className="mt-4 mb-1 text-xs text-muted-foreground">{L({ ku: "کۆنترین لە سەرەوە", en: "Oldest first", ar: "الأقدم أولاً", zh: "最旧在前" })}</div>
                    {shelfBoxes.slice(0, 40).map((b) => (
                      <div key={b.boxId} className="flex items-center justify-between gap-2 border-b py-2 text-sm">
                        <span className="min-w-0">
                          <Link href={`/customer-delivery-scanner?box=${b.boxId}`} className="font-mono text-sky-700 hover:underline dark:text-sky-300">{b.boxCode}</Link>
                          <div className="truncate text-xs text-muted-foreground">{b.customerName ?? b.customerCode} · {L({ ku: `${b.days} ڕۆژ`, en: `${b.days} days`, ar: `${b.days} يوم`, zh: `${b.days} 天` })}</div>
                        </span>
                        <span className="flex items-center gap-2">
                          <Num value={b.valueUsd} />
                          <DebtWhatsAppButton customer={{ id: b.customerId, fullName: b.customerName, customerCode: b.customerCode }} owedUsd={b.valueUsd} size="icon" />
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {open === "giveaways" && (
                  <>
                    <Line label={L({ ku: `داشکانی سەر وەسڵی بۆکس — ${data.discounts?.count ?? 0}`, en: `Box receipt discounts — ${data.discounts?.count ?? 0}`, ar: `خصومات الإيصالات — ${data.discounts?.count ?? 0}`, zh: `箱子收据折扣 — ${data.discounts?.count ?? 0}` })} href="/finance/company-dashboard?focus=discounts"><Num value={data.discounts?.usd ?? 0} /></Line>
                    <Line label={L({ ku: "قەرەبوو / لێخۆشبوون (پارە نییە)", en: "Compensation / waivers (not money)", ar: "تعويض / إعفاء", zh: "补偿/减免" })}><Num value={data.writeOffs?.compensationUsd ?? 0} /></Line>
                    <Line label={L({ ku: "کەمکردنەوەی دەستی", en: "Hand credits", ar: "تخفيضات يدوية", zh: "手动减免" })}><Num value={data.writeOffs?.manualUsd ?? 0} /></Line>
                    <div className="flex items-center justify-between border-t-2 py-2 font-semibold"><span>{L({ ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" })}</span><Num value={(data.discounts?.usd ?? 0) + (data.writeOffs?.usd ?? 0)} /></div>
                    {(data.writeOffs?.byPerson ?? []).length > 0 && (
                      <>
                        <div className="mt-3 mb-1 text-xs text-muted-foreground">{L({ ku: "کێ کردوویەتی (قەرەبوو و دەستی)", en: "Who did it (compensation and hand credits)", ar: "من قام بها", zh: "操作人" })}</div>
                        {(data.writeOffs?.byPerson ?? []).map((p) => <Line key={p.name} tone="quiet" label={p.name}><Num value={p.usd} /></Line>)}
                      </>
                    )}
                    <div className="mt-3 mb-1 text-xs text-muted-foreground">{L({ ku: "هەر یەکێک", en: "Each one", ar: "كل واحدة", zh: "明细" })}</div>
                    {(data.writeOffs?.list ?? []).map((r) => (
                      <div key={r.id} className="border-b py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/finance/customer/${r.customerId}`} className="truncate text-sm hover:underline">{r.customerName ?? r.customerCode}</Link>
                          <Num value={r.usd} className="font-semibold" />
                        </div>
                        <div className="text-muted-foreground">
                          <bdi dir="ltr">{new Date(r.at).toLocaleDateString("en-GB")}</bdi> · {r.kind === "compensation" ? L({ ku: "قەرەبوو", en: "Compensation", ar: "تعويض", zh: "补偿" }) : L({ ku: "دەستی", en: "Hand credit", ar: "يدوي", zh: "手动" })} · {r.by ?? "—"}
                        </div>
                        <div className="truncate">{String(r.reason ?? "").replace(/^\[[^\]]*\]\s*/, "")}</div>
                      </div>
                    ))}
                  </>
                )}
                {open === "waiting" && (
                  waiting.length === 0
                    ? <p className="text-sm text-muted-foreground">{L({ ku: "هیچ شتێک چاوەڕێی تۆ نییە.", en: "Nothing is waiting for you.", ar: "لا شيء بانتظارك.", zh: "暂无待办。" })}</p>
                    : waiting.map((w) => (
                        <Line key={w.href} label={<span className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />{L(w.w)}</span>} href={w.href}>
                          <span className="font-mono font-semibold">{w.n}</span>
                        </Line>
                      ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
