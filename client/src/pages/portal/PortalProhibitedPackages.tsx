import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { getProhibitedItemLabel } from "@/constants/prohibitedItems";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Ban, Undo2, Send, Trash2, ImageIcon, AlertTriangle, Loader2, CheckCircle2, MessageCircle, Hash,
} from "lucide-react";

type Choice = "return" | "reship" | "destroy";
const RESOLUTIONS: { key: Choice; icon: any; label: { ku: string; en: string; ar: string; zh: string }; grad: string }[] = [
  { key: "return", icon: Undo2, label: { ku: "گەڕاندنەوە", en: "Return", ar: "إرجاع", zh: "退回" }, grad: "from-blue-500 to-indigo-600" },
  { key: "reship", icon: Send, label: { ku: "ناردن بۆ ئەدرێسی تر", en: "Reship to another address", ar: "إرسال لعنوان آخر", zh: "转寄到其他地址" }, grad: "from-violet-500 to-purple-600" },
  { key: "destroy", icon: Trash2, label: { ku: "لەناوبردن", en: "Destroy", ar: "إتلاف", zh: "销毁" }, grad: "from-rose-500 to-red-600" },
];

export default function PortalProhibitedPackages() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const label = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  const { data: items, isLoading, refetch } = trpc.prohibited.getMine.useQuery();
  const markViewed = trpc.prohibited.markViewed.useMutation();
  const chooseResolution = trpc.prohibited.chooseResolution.useMutation({
    onSuccess: () => { toast.success(label({ ku: "هەڵبژاردەکەت نێردرا", en: "Your choice was sent", ar: "تم إرسال اختيارك", zh: "已发送您的选择" })); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [reshipFor, setReshipFor] = useState<number | null>(null);
  const [reshipAddress, setReshipAddress] = useState("");

  // Deep-link support: /portal/prohibited-packages?focus=<id> scrolls to and
  // briefly highlights that item (used when tapping its fee in the financials).
  const searchString = useSearch();
  const focusId = new URLSearchParams(searchString).get("focus");
  const [highlightId, setHighlightId] = useState<number | null>(focusId ? Number(focusId) : null);
  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (highlightId == null || !items?.length) return;
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, items]);

  // Mark unseen items as viewed once, so Portal Center reflects "customer saw it".
  const markedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!items) return;
    for (const it of items as any[]) {
      if (!it.viewedByCustomerAt && !markedRef.current.has(it.id)) {
        markedRef.current.add(it.id);
        markViewed.mutate({ id: it.id });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const waFollowUp = (it: any) => {
    const chosen = RESOLUTIONS.find((r) => r.key === it.resolutionChoice);
    const lines = [
      pickLang(language, { ku: "سڵاو، دەربارەی پاکێجی قەدەغەکراو", en: "Hello, about my prohibited package", ar: "مرحباً، بخصوص طردي الممنوع", zh: "您好，关于我的违禁包裹" }),
      `${pickLang(language, { ku: "تراک", en: "Tracking", ar: "التتبع", zh: "运单号" })}: ${it.trackingNumber}`,
      chosen ? `${pickLang(language, { ku: "هەڵبژاردەم", en: "My choice", ar: "اختياري", zh: "我的选择" })}: ${label(chosen.label)}` : "",
      it.reshipAddress ? `${pickLang(language, { ku: "ئەدرێسی نوێ", en: "New address", ar: "العنوان الجديد", zh: "新地址" })}: ${it.reshipAddress}` : "",
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines)}`, "_blank", "noopener,noreferrer");
  };

  const choose = (it: any, choice: Choice) => {
    if (choice === "reship") {
      if (reshipFor !== it.id) { setReshipFor(it.id); setReshipAddress(""); return; }
      if (!reshipAddress.trim()) { toast.error(label({ ku: "ئەدرێسی نوێ بنووسە", en: "Enter the new address", ar: "أدخل العنوان الجديد", zh: "请输入新地址" })); return; }
      chooseResolution.mutate({ id: it.id, choice, reshipAddress: reshipAddress.trim() });
      setReshipFor(null);
      return;
    }
    chooseResolution.mutate({ id: it.id, choice });
  };

  return (
    <PortalLayout>
      <div dir={isRTL ? "rtl" : "ltr"} className="px-4 pt-5 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <h1 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")}>
              {label({ ku: "کەل و پەلی قەدەغە", en: "Prohibited packages", ar: "الطرود الممنوعة", zh: "违禁包裹" })}
            </h1>
            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
              {label({ ku: "پاکێجەکانی کە ناتوانرێن بگوازرێنەوە", en: "Packages that can't be shipped", ar: "طرود لا يمكن شحنها", zh: "无法运输的包裹" })}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className={cn("h-40 rounded-2xl animate-pulse", isDark ? "bg-slate-800" : "bg-slate-200")} />)}</div>
        ) : !items || items.length === 0 ? (
          <div className="text-center py-20">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4", isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40")}>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-600")}>
              {label({ ku: "هیچ پاکێجێکی قەدەغە نییە", en: "No prohibited packages", ar: "لا توجد طرود ممنوعة", zh: "没有违禁包裹" })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(items as any[]).map((it) => {
              const reason = getProhibitedItemLabel(it.reasonId);
              const chosen = RESOLUTIONS.find((r) => r.key === it.resolutionChoice);
              const pending = it.status === "pending";
              const photos: string[] = Array.isArray(it.photos) ? it.photos : [];
              return (
                <div key={it.id} ref={highlightId === it.id ? focusRef : undefined} className={cn(
                  "rounded-2xl border overflow-hidden transition-all",
                  highlightId === it.id && "ring-2 ring-offset-2 ring-amber-400 dark:ring-offset-slate-900",
                  pending ? "wazn-prohibited-flash border-red-400" : (isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200 dark:border-slate-800/60"),
                )}>
                  <div className={cn("p-4", pending && (isDark ? "bg-slate-800" : "bg-white"))}>
                    {/* Top: tracking + status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-sm font-mono", isDark ? "text-slate-300" : "text-slate-700 dark:text-slate-300")}>
                        <Hash className="w-3.5 h-3.5 opacity-60" />{it.trackingNumber}
                      </span>
                      <span className={cn(
                        "text-[11px] font-bold px-2.5 py-1 rounded-full",
                        it.status === "resolved" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" : it.status === "chosen" ? "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300",
                      )}>
                        {label(it.status === "resolved" ? { ku: "چارەسەرکرا", en: "Resolved", ar: "تم الحل", zh: "已解决" } : it.status === "chosen" ? { ku: "هەڵبژێردرا", en: "Chosen", ar: "تم الاختيار", zh: "已选择" } : { ku: "پێویستی بە بڕیارە", en: "Action needed", ar: "بحاجة لقرار", zh: "需要处理" })}
                      </span>
                    </div>

                    {/* Photos */}
                    {photos.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                        {photos.map((src, i) => (
                          <img key={i} src={src} alt="" loading="lazy" className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-black/5" />
                        ))}
                      </div>
                    )}

                    {/* Reason */}
                    <div className={cn("rounded-xl p-3 flex items-start gap-2.5", isDark ? "bg-red-950/30" : "bg-red-50 dark:bg-red-950/40")}>
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className={cn("text-xs font-medium", isDark ? "text-red-300" : "text-red-700 dark:text-red-300")}>{label({ ku: "هۆکاری قەدەغە", en: "Reason", ar: "السبب", zh: "原因" })}</p>
                        <p className={cn("text-sm mt-0.5", isDark ? "text-slate-200" : "text-slate-700 dark:text-slate-300")}>
                          {reason ? label(reason) : label({ ku: "کاڵای قەدەغەکراو", en: "Prohibited item", ar: "بضاعة ممنوعة", zh: "违禁物品" })}
                        </p>
                        {it.reasonNote && <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>{it.reasonNote}</p>}
                      </div>
                    </div>

                    {/* Fee (if charged) */}
                    {/* A decimal column arrives as the string "0.00", which is
                        truthy — so a customer charged nothing was shown an
                        amber fee row reading zero. */}
                    {Number(it.feeUsd) > 0 && (
                      <div className={cn("mt-3 text-sm flex items-center justify-between rounded-xl px-3 py-2", isDark ? "bg-amber-950/30 text-amber-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300")}>
                        <span>{label({ ku: "کولفە (قەرز لەسەر باڵانس)", en: "Fee (added to balance)", ar: "الرسوم (على الرصيد)", zh: "费用（已计入余额）" })}</span>
                        <span className="font-bold">${Number(it.feeUsd).toFixed(2)}</span>
                      </div>
                    )}

                    {/* Resolution */}
                    {pending ? (
                      <div className="mt-4">
                        <p className={cn("text-sm font-medium mb-2", isDark ? "text-slate-300" : "text-slate-700 dark:text-slate-300")}>
                          {label({ ku: "چی لەم کاڵایە بکرێت؟ (هەر ڕێگایەک کولفەی خۆی هەیە)", en: "What should we do with it? (each option has a fee)", ar: "ماذا نفعل بها؟ (لكل خيار رسوم)", zh: "该如何处理？（每个选项都有费用）" })}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {RESOLUTIONS.map((r) => (
                            <button key={r.key} onClick={() => choose(it, r.key)} disabled={chooseResolution.isPending}
                              className={cn("flex flex-col items-center gap-1.5 rounded-xl p-3 text-white bg-gradient-to-br transition active:scale-95", r.grad, reshipFor === it.id && r.key === "reship" && "ring-2 ring-offset-2 ring-violet-400")}>
                              <r.icon className="w-5 h-5" />
                              <span className="text-[11px] font-medium text-center leading-tight">{label(r.label)}</span>
                            </button>
                          ))}
                        </div>
                        {reshipFor === it.id && (
                          <div className="mt-3">
                            <textarea value={reshipAddress} onChange={(e) => setReshipAddress(e.target.value)} rows={2}
                              placeholder={label({ ku: "ئەدرێسی نوێ بنووسە...", en: "Enter the new address...", ar: "أدخل العنوان الجديد...", zh: "输入新地址..." })}
                              className={cn("w-full rounded-xl border px-3 py-2 text-sm outline-none", isDark ? "bg-slate-900 border-slate-700 text-white" : "border-slate-200 dark:border-slate-800/60")} />
                            <button onClick={() => choose(it, "reship")} disabled={chooseResolution.isPending}
                              className="mt-2 w-full rounded-xl bg-violet-600 text-white py-2.5 text-sm font-medium hover:bg-violet-700 flex items-center justify-center gap-2">
                              {chooseResolution.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              {label({ ku: "دڵنیاکردنەوەی ناردن", en: "Confirm reship", ar: "تأكيد الإرسال", zh: "确认转寄" })}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", isDark ? "text-slate-200" : "text-slate-700 dark:text-slate-300")}>
                          {chosen && <chosen.icon className="w-4 h-4" />}
                          {chosen ? label(chosen.label) : ""}
                        </span>
                        <button onClick={() => waFollowUp(it)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] text-white px-3.5 py-2 text-sm font-medium">
                          <MessageCircle className="w-4 h-4" />{label({ ku: "بەدواداچوون", en: "Follow up", ar: "متابعة", zh: "跟进" })}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
