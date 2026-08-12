import { useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft, Minus, Plus, ShoppingBag, CheckCircle2, Loader2,
  ImageIcon, Tag, Store as StoreIcon,
} from "lucide-react";

// Localized helpers — store supports ku / en / ar (zh falls back to en).
const pName = (p: any, language: string) =>
  pickLang(language, { ku: p?.nameKu || p?.nameEn, en: p?.nameEn, ar: p?.nameAr || p?.nameEn, zh: p?.nameEn }) || "";
const pDesc = (p: any, language: string) =>
  pickLang(language, { ku: p?.descriptionKu || p?.descriptionEn, en: p?.descriptionEn, ar: p?.descriptionAr || p?.descriptionEn, zh: p?.descriptionEn }) || "";

const money = (v: any, currency: string) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;

export default function StoreProduct() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";

  const { data: product, isLoading } = trpc.store.getBySlug.useQuery({ slug: slug || "" }, { enabled: !!slug });

  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", customerCity: "", customerAddress: "", note: "" });
  const [placed, setPlaced] = useState<{ orderCode: string } | null>(null);

  const createOrder = trpc.store.createOrder.useMutation({
    onSuccess: (res) => {
      // Save succeeded in our DB — now hand the same details to staff on WhatsApp.
      const lines = [
        pickLang(language, { ku: "سڵاو، داواکاری نوێ لە وەزن ستۆر", en: "Hello, a new Wazn Store order", ar: "مرحباً، طلب جديد من متجر وزن", zh: "您好，Wazn 商店新订单" }),
        `${pickLang(language, { ku: "کۆدی ئۆردەر", en: "Order code", ar: "رمز الطلب", zh: "订单号" })}: ${res.orderCode}`,
        `${pickLang(language, { ku: "پرۆدیکت", en: "Product", ar: "المنتج", zh: "产品" })}: ${pName(product, language)}`,
        `${pickLang(language, { ku: "عەدەد", en: "Qty", ar: "الكمية", zh: "数量" })}: ${qty}`,
        `${pickLang(language, { ku: "کۆی نرخ", en: "Total", ar: "الإجمالي", zh: "总计" })}: ${money(res.totalPrice, res.currency)}`,
        "———",
        `${pickLang(language, { ku: "ناو", en: "Name", ar: "الاسم", zh: "姓名" })}: ${form.customerName}`,
        `${pickLang(language, { ku: "مۆبایل", en: "Phone", ar: "الهاتف", zh: "电话" })}: ${form.customerPhone}`,
        form.customerCity ? `${pickLang(language, { ku: "شار", en: "City", ar: "المدينة", zh: "城市" })}: ${form.customerCity}` : "",
        form.customerAddress ? `${pickLang(language, { ku: "ناونیشان", en: "Address", ar: "العنوان", zh: "地址" })}: ${form.customerAddress}` : "",
        form.note ? `${pickLang(language, { ku: "تێبینی", en: "Note", ar: "ملاحظة", zh: "备注" })}: ${form.note}` : "",
      ].filter(Boolean).join("\n");
      window.open(`https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines)}`, "_blank", "noopener,noreferrer");
      setPlaced({ orderCode: res.orderCode });
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      toast.error(pickLang(language, { ku: "ناو و ژمارەی مۆبایل پێویستن", en: "Name and phone are required", ar: "الاسم والهاتف مطلوبان", zh: "姓名和电话为必填项" }));
      return;
    }
    createOrder.mutate({ productId: product!.id, quantity: qty, ...form });
  };

  const label = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 dark:bg-slate-950/40">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 dark:border-slate-800/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/store">
            <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
              <StoreIcon className="w-5 h-5 text-violet-600 dark:text-violet-300" />
              {label({ ku: "وەزن ستۆر", en: "Wazn Store", ar: "متجر وزن", zh: "Wazn 商店" })}
            </span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-32 pt-4">
        <Link href="/store">
          <button className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 mb-4">
            <ArrowLeft className={cn("w-4 h-4", isRTL && "rotate-180")} />
            {label({ ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" })}
          </button>
        </Link>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="aspect-square w-full rounded-3xl bg-slate-200 dark:bg-slate-800/50" />
            <div className="h-8 w-2/3 rounded-lg bg-slate-200 dark:bg-slate-800/50" />
            <div className="h-6 w-1/3 rounded-lg bg-slate-200 dark:bg-slate-800/50" />
          </div>
        ) : !product ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-950/40 flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium text-slate-600 dark:text-slate-300">{label({ ku: "پرۆدیکت نەدۆزرایەوە", en: "Product not found", ar: "المنتج غير موجود", zh: "未找到产品" })}</p>
          </div>
        ) : placed ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-11 h-11 text-emerald-600 dark:text-emerald-300" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{label({ ku: "داواکارییەکەت نێردرا!", en: "Order sent!", ar: "تم إرسال طلبك!", zh: "订单已发送！" })}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{label({ ku: "لە ڕێگای WhatsApp پەیوەندیت پێوە دەکەین بۆ پشتڕاستکردنەوە.", en: "We'll contact you on WhatsApp to confirm.", ar: "سنتواصل معك عبر واتساب للتأكيد.", zh: "我们将通过 WhatsApp 与您确认。" })}</p>
            <p className="mt-4 inline-block rounded-full bg-slate-100 dark:bg-slate-950/40 px-4 py-1.5 text-sm font-mono text-slate-600 dark:text-slate-300">{placed.orderCode}</p>
            <div className="mt-8">
              <Link href="/store">
                <button className="rounded-xl bg-violet-600 text-white px-6 py-3 font-medium hover:bg-violet-700 transition">
                  {label({ ku: "بەردەوامبوون بە کڕین", en: "Continue shopping", ar: "متابعة التسوق", zh: "继续购物" })}
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Gallery */}
            {(() => {
              const imgs = [product.coverImageUrl, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean) as string[];
              const current = imgs[activeImg] || imgs[0];
              return (
                <div>
                  <div className="aspect-square w-full rounded-3xl overflow-hidden bg-white dark:bg-card border border-slate-200 dark:border-slate-800/60 flex items-center justify-center">
                    {current ? (
                      <img src={current} alt={pName(product, language)} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-16 h-16 text-slate-200" />
                    )}
                  </div>
                  {imgs.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                      {imgs.map((src, i) => (
                        <button key={i} onClick={() => setActiveImg(i)} className={cn(
                          "w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0",
                          i === activeImg ? "border-violet-500" : "border-transparent",
                        )}>
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Info */}
            <div className="mt-5">
              {product.category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-medium px-2.5 py-1 mb-3">
                  <Tag className="w-3 h-3" />{product.category}
                </span>
              )}
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 leading-snug">{pName(product, language)}</h1>
              <div className="flex items-baseline gap-2 mt-3">
                <span className="text-3xl font-bold text-violet-600 dark:text-violet-300">{money(product.price, product.currency)}</span>
                {product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price) && (
                  <span className="text-lg text-slate-400 line-through">{money(product.compareAtPrice, product.currency)}</span>
                )}
              </div>
              {product.status === "out_of_stock" && (
                <p className="mt-3 inline-block rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 text-sm font-medium px-3 py-1.5">
                  {label({ ku: "ئێستا نەماوە", en: "Out of stock", ar: "غير متوفر حالياً", zh: "暂时缺货" })}
                </p>
              )}
              {pDesc(product, language) && (
                <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{pDesc(product, language)}</p>
              )}
            </div>

            {/* Order form */}
            {product.status !== "out_of_stock" && (
              <div className="mt-8 rounded-3xl bg-white dark:bg-card border border-slate-200 dark:border-slate-800/60 p-5">
                <h2 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-violet-600 dark:text-violet-300" />
                  {label({ ku: "داواکاری", en: "Place order", ar: "إتمام الطلب", zh: "下单" })}
                </h2>

                {/* Quantity */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{label({ ku: "عەدەد", en: "Quantity", ar: "الكمية", zh: "数量" })}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                    <span className="w-8 text-center font-bold text-slate-800 dark:text-slate-200">{qty}</span>
                    <button onClick={() => setQty((q) => Math.min(999, q + 1))} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-950/40 hover:bg-slate-200 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder={label({ ku: "ناوی تەواو *", en: "Full name *", ar: "الاسم الكامل *", zh: "全名 *" })} className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800/60 px-3.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
                  <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} inputMode="tel" placeholder={label({ ku: "ژمارەی مۆبایل *", en: "Phone number *", ar: "رقم الهاتف *", zh: "电话号码 *" })} className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800/60 px-3.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
                  <input value={form.customerCity} onChange={(e) => setForm({ ...form, customerCity: e.target.value })} placeholder={label({ ku: "شار", en: "City", ar: "المدينة", zh: "城市" })} className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-800/60 px-3.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
                  <textarea value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} rows={2} placeholder={label({ ku: "ناونیشانی گەیاندن", en: "Delivery address", ar: "عنوان التوصيل", zh: "配送地址" })} className="w-full rounded-xl border border-slate-200 dark:border-slate-800/60 px-3.5 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none" />
                  <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder={label({ ku: "تێبینی (ئارەزوومەندانە)", en: "Note (optional)", ar: "ملاحظة (اختياري)", zh: "备注（可选）" })} className="w-full rounded-xl border border-slate-200 dark:border-slate-800/60 px-3.5 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none" />
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-sm text-slate-500 dark:text-slate-400">{label({ ku: "کۆی گشتی", en: "Total", ar: "الإجمالي", zh: "总计" })}</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{money(Number(product.price) * qty, product.currency)}</span>
                </div>

                <button onClick={submit} disabled={createOrder.isPending} className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 font-bold shadow-lg shadow-emerald-500/25 transition active:scale-[0.99] disabled:opacity-60">
                  {createOrder.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                  {label({ ku: "داواکاری بکە لە WhatsApp", en: "Order via WhatsApp", ar: "اطلب عبر واتساب", zh: "通过 WhatsApp 下单" })}
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  {label({ ku: "پارەدان لە کاتی گەیاندن • پشتڕاستکردنەوە لە ڕێگای WhatsApp", en: "Pay on delivery • Confirmed via WhatsApp", ar: "الدفع عند الاستلام • تأكيد عبر واتساب", zh: "货到付款 • WhatsApp 确认" })}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
