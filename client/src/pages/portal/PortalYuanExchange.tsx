import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { onEnter } from "@/lib/onEnter";
import { trpc } from "@/lib/trpc";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { TutorialHint } from "@/components/TutorialHint";
import {
  ArrowDownUp,
  Banknote,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatPortalDate } from "@/lib/portalClock";

/** WhatsApp brand glyph (lucide has no brand icons). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

const QUICK_USD = [100, 500, 1000, 5000];

type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

const STATUS_STYLE: Record<OrderStatus, { badge: string; dot: string }> = {
  pending: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", dot: "bg-amber-500" },
  processing: { badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300", dot: "bg-sky-500" },
  completed: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", dot: "bg-emerald-500" },
  cancelled: { badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", dot: "bg-red-500" },
};

export default function PortalYuanExchange() {
  const { language } = useLanguage();

  // Banner colour follows the mode the customer picked, like every other page.

  const { banner: portalBanner } = usePortalPalette();
  const isRTL = language === "ku" || language === "ar";
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  const [usd, setUsd] = useState("");
  const [cny, setCny] = useState("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();
  const infoQuery = trpc.customerPortal.getYuanExchangeInfo.useQuery();
  const ordersQuery = trpc.customerPortal.getMyYuanOrders.useQuery();
  const createOrder = trpc.customerPortal.createYuanOrder.useMutation({
    onSuccess: () => {
      toast.success(pick({
        ku: "داواکارییەکەت تۆمارکرا! بەم زووانە پەیوەندیت پێوە دەکەین",
        en: "Your order was submitted! We'll contact you soon",
        ar: "تم تسجيل طلبك! سنتواصل معك قريباً",
        zh: "您的订单已提交！我们会尽快与您联系",
      }));
      setNote("");
      utils.customerPortal.getMyYuanOrders.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const info = infoQuery.data;
  const rate = info?.rate ?? 0;

  const syncFromUsd = (v: string) => {
    setUsd(v);
    const n = parseFloat(v);
    setCny(Number.isFinite(n) && rate > 0 ? (n * rate).toFixed(2) : "");
  };
  const syncFromCny = (v: string) => {
    setCny(v);
    const n = parseFloat(v);
    setUsd(Number.isFinite(n) && rate > 0 ? (n / rate).toFixed(2) : "");
  };

  const usdNum = parseFloat(usd) || 0;
  const cnyNum = parseFloat(cny) || 0;

  const limitError = useMemo(() => {
    if (!info || usdNum <= 0) return null;
    if (info.minUsd != null && usdNum < info.minUsd) {
      return pick({
        ku: `کەمترین بڕ ${info.minUsd}$ ـە`,
        en: `Minimum amount is $${info.minUsd}`,
        ar: `الحد الأدنى هو ${info.minUsd}$`,
        zh: `最低金额为 ${info.minUsd} 美元`,
      });
    }
    if (info.maxUsd != null && usdNum > info.maxUsd) {
      return pick({
        ku: `زۆرترین بڕ ${info.maxUsd}$ ـە`,
        en: `Maximum amount is $${info.maxUsd}`,
        ar: `الحد الأقصى هو ${info.maxUsd}$`,
        zh: `最高金额为 ${info.maxUsd} 美元`,
      });
    }
    return null;
  }, [info, usdNum, language]);

  const canSubmit = usdNum > 0 && rate > 0 && !limitError && !createOrder.isPending;

  // One path for the button and for the Enter key, so a guard added to one
  // cannot go missing from the other.
  const submitYuanOrder = () => {
    if (!canSubmit) return;
    createOrder.mutate({ usdAmount: usdNum, note: note.trim() || undefined });
  };

  const waMessage = pick({
    ku: `سڵاو، دەمەوێت یوانی چینی بکڕم:\n💵 ${usdNum.toLocaleString("en-US")} دۆلار → ¥${cnyNum.toLocaleString("en-US")} یوان\n(نرخ: ١$ = ${rate}¥)`,
    en: `Hello, I want to buy Chinese Yuan:\n💵 $${usdNum.toLocaleString("en-US")} → ¥${cnyNum.toLocaleString("en-US")}\n(Rate: 1$ = ${rate}¥)`,
    ar: `مرحباً، أريد شراء اليوان الصيني:\n💵 ${usdNum.toLocaleString("en-US")}$ → ¥${cnyNum.toLocaleString("en-US")}\n(السعر: 1$ = ${rate}¥)`,
    zh: `您好，我想购买人民币：\n💵 ${usdNum.toLocaleString("en-US")} 美元 → ¥${cnyNum.toLocaleString("en-US")}\n（汇率：1$ = ${rate}¥）`,
  });
  const waHref = `https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const statusLabel = (s: OrderStatus) =>
    pick(
      {
        pending: { ku: "چاوەڕوانە", en: "Pending", ar: "قيد الانتظار", zh: "待处理" },
        processing: { ku: "جێبەجێدەکرێت", en: "Processing", ar: "قيد التنفيذ", zh: "处理中" },
        completed: { ku: "تەواوبوو", en: "Completed", ar: "مكتمل", zh: "已完成" },
        cancelled: { ku: "هەڵوەشێنرایەوە", en: "Cancelled", ar: "ملغى", zh: "已取消" },
      }[s],
    );

  return (
    <PortalLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="relative overflow-hidden text-white px-4 pt-8 pb-12" style={portalBanner}>
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -start-6 w-40 h-40 rounded-full bg-yellow-300/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-1 ring-white/25 text-2xl font-black">
              ¥
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">
                {pick({ ku: "کڕینی یوانی چینی", en: "Buy Chinese Yuan", ar: "شراء اليوان الصيني", zh: "购买人民币" })}
              </h1>
              <TutorialHint section="کڕینی یوان" className="mt-1.5 mb-1" />
              <p className="text-sm text-white/80">
                {pick({
                  ku: "بۆ پارەدان بە سەپلایەرە چینییەکانت",
                  en: "For paying your Chinese suppliers",
                  ar: "لدفع مستحقات مورّديك الصينيين",
                  zh: "用于向您的中国供应商付款",
                })}
              </p>
            </div>
          </div>

          {/* Live rate */}
          <div className="relative mt-5 rounded-2xl bg-white/12 backdrop-blur px-4 py-3 ring-1 ring-white/20 flex items-center justify-between">
            <span className="text-sm font-medium text-white/85">
              {pick({ ku: "نرخی ئەمڕۆ", en: "Today's rate", ar: "سعر اليوم", zh: "今日汇率" })}
            </span>
            {infoQuery.isLoading ? (
              <Skeleton className="h-6 w-24 rounded-md bg-white/25" />
            ) : (
              <span className="text-xl font-black tabular-nums" dir="ltr">
                1$ = {rate}¥
              </span>
            )}
          </div>
        </div>

        <div className="px-4 py-6 space-y-4 pb-28 max-w-2xl mx-auto -mt-4">
          {info && !info.enabled ? (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 text-sm text-amber-800 dark:text-amber-300 font-medium">
              {pick({
                ku: "ئەم خزمەتگوزارییە لەئێستادا بەردەست نییە. تکایە دواتر سەردان بکەرەوە",
                en: "This service is currently unavailable. Please check back later",
                ar: "هذه الخدمة غير متوفرة حالياً. يرجى المحاولة لاحقاً",
                zh: "该服务目前不可用，请稍后再试",
              })}
            </div>
          ) : (
            <>
              {/* Calculator */}
              <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-gray-100 dark:ring-white/5 overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center ring-1 ring-white/20 shrink-0">
                    <ArrowDownUp className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-base font-bold text-white flex-1">
                    {pick({ ku: "حاسیبەی یوان", en: "Yuan calculator", ar: "حاسبة اليوان", zh: "人民币计算器" })}
                  </h2>
                </div>

                <div className="p-4 space-y-4">
                  {/* Quick amounts */}
                  <div className="flex flex-wrap gap-2">
                    {QUICK_USD.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => syncFromUsd(String(q))}
                        className="rounded-full border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-1.5 text-sm font-bold text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95"
                      >
                        {q.toLocaleString("en-US")}$
                      </button>
                    ))}
                  </div>

                  {/* USD */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      {pick({ ku: "بڕی دۆلار دەدەیت", en: "You pay (USD)", ar: "تدفع (دولار)", zh: "您支付（美元）" })}
                    </label>
                    <div className="relative" dir="ltr">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 font-bold text-emerald-500 dark:text-emerald-400">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        stepper={false}
                        onKeyDown={onEnter(submitYuanOrder)}
                        enterKeyHint="send"
                        value={usd}
                        onChange={(e) => syncFromUsd(e.target.value)}
                        placeholder="100"
                        className="h-12 ps-8 text-lg font-bold font-mono"
                      />
                    </div>
                  </div>

                  {/* CNY */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-red-500 dark:text-red-400" />
                      {pick({ ku: "بڕی یوان وەردەگریت", en: "You receive (CNY)", ar: "تستلم (يوان)", zh: "您收到（人民币）" })}
                    </label>
                    <div className="relative" dir="ltr">
                      <span className="absolute start-3 top-1/2 -translate-y-1/2 font-bold text-red-500 dark:text-red-400">¥</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        stepper={false}
                        onKeyDown={onEnter(submitYuanOrder)}
                        enterKeyHint="send"
                        value={cny}
                        onChange={(e) => syncFromCny(e.target.value)}
                        placeholder="640"
                        className="h-12 ps-8 text-lg font-bold font-mono"
                      />
                    </div>
                  </div>

                  {limitError && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">{limitError}</p>
                  )}

                  {info && (info.noteKu || info.noteEn || info.noteAr || info.noteZh) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {/* Fall back to any filled language so a half-filled note still shows */}
                      {pick({ ku: info.noteKu, en: info.noteEn, ar: info.noteAr, zh: info.noteZh }) ||
                        info.noteKu || info.noteEn || info.noteAr || info.noteZh}
                    </p>
                  )}
                </div>
              </section>

              {/* Order */}
              <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-gray-100 dark:ring-white/5 p-4 space-y-3">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {pick({ ku: "تۆماری داواکاری", en: "Place an order", ar: "تسجيل طلب", zh: "提交订单" })}
                </h3>
                <Textarea
                  onKeyDown={onEnter(submitYuanOrder)}
                  enterKeyHint="send"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={pick({
                    ku: "تێبینی (ئیختیاری) — بۆ نموونە: ناوی سەپلایەر یان ژمارەی Alipay",
                    en: "Note (optional) — e.g. supplier name or Alipay number",
                    ar: "ملاحظة (اختياري) — مثلاً اسم المورّد أو رقم Alipay",
                    zh: "备注（可选）——例如供应商名称或支付宝账号",
                  })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Button
                    disabled={!canSubmit}
                    onClick={submitYuanOrder}
                    className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-base"
                  >
                    {createOrder.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {pick({ ku: "ناردنی داواکاری", en: "Submit order", ar: "إرسال الطلب", zh: "提交订单" })}
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-xl border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-base hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <a href={waHref} target="_blank" rel="noopener noreferrer">
                      <WhatsAppIcon className="w-4 h-4" />
                      {pick({ ku: "داواکاری بە واتسئاپ", en: "Order via WhatsApp", ar: "اطلب عبر واتساب", zh: "通过 WhatsApp 订购" })}
                    </a>
                  </Button>
                </div>
                {usdNum > 0 && cnyNum > 0 && (
                  <p className="text-center text-sm font-bold text-gray-600 dark:text-gray-300 tabular-nums" dir="ltr">
                    ${usdNum.toLocaleString("en-US")} → ¥{cnyNum.toLocaleString("en-US")}
                  </p>
                )}
              </section>

              {/* My orders */}
              <section className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-gray-100 dark:ring-white/5 overflow-hidden">
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/60 dark:border-white/5">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    {pick({ ku: "داواکارییەکانم", en: "My orders", ar: "طلباتي", zh: "我的订单" })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => ordersQuery.refetch()}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                    aria-label={pickLang(language, { ku: "نوێکردنەوە", en: "refresh", ar: "تحديث", zh: "刷新" })}
                  >
                    <RefreshCw className={`w-4 h-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
                  </button>
                </div>

                {ordersQuery.isLoading ? (
                  // A skeleton rather than a spinner: the rest of the portal
                  // holds the shape of what is coming, so the page does not
                  // jump when it arrives.
                  <div className="p-4 space-y-3">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="rounded-xl border border-border/50 p-3 space-y-2">
                        <div className="flex justify-between">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-[70%]" />
                      </div>
                    ))}
                  </div>
                ) : ordersQuery.isError ? (
                  <PortalErrorState onRetry={() => void ordersQuery.refetch()} isRetrying={ordersQuery.isFetching} />
                ) : !ordersQuery.data?.length ? (
                  <p className="p-6 text-center text-sm text-gray-400">
                    {pick({ ku: "هێشتا هیچ داواکارییەکت نییە", en: "No orders yet", ar: "لا توجد طلبات بعد", zh: "暂无订单" })}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-white/5">
                    {ordersQuery.data.map((o) => {
                      const style = STATUS_STYLE[o.status as OrderStatus] ?? STATUS_STYLE.pending;
                      const StatusIcon =
                        o.status === "completed" ? CheckCircle2 : o.status === "cancelled" ? XCircle : Clock;
                      return (
                        <div key={o.id} className="p-4 flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 dark:text-gray-100 tabular-nums" dir="ltr">
                              ${Number(o.usdAmount).toLocaleString("en-US")} → ¥{Number(o.cnyAmount).toLocaleString("en-US")}
                            </p>
                            <p className="text-xs text-gray-400 tabular-nums" dir="ltr">
                              1$ = {Number(o.rate)}¥ · {formatPortalDate(o.createdAt, language)}
                            </p>
                            {o.adminNote && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{o.adminNote}</p>
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${style.badge}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusLabel((o.status as OrderStatus) ?? "pending")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
