import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { ImageIcon, Store as StoreIcon, Tag } from "lucide-react";

const pName = (p: any, language: string) =>
  pickLang(language, { ku: p?.nameKu || p?.nameEn, en: p?.nameEn, ar: p?.nameAr || p?.nameEn, zh: p?.nameEn }) || "";
const money = (v: any, currency: string) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;

export default function StoreHome() {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const { data: products, isLoading } = trpc.store.listProducts.useQuery();
  const label = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 dark:bg-slate-950/40">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 dark:border-slate-800/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <StoreIcon className="w-5 h-5 text-violet-600" />
            {label({ ku: "وەزن ستۆر", en: "Wazn Store", ar: "متجر وزن", zh: "Wazn 商店" })}
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-white relative overflow-hidden">
          <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full bg-white/10" />
          <h1 className="text-2xl font-bold relative">{label({ ku: "کاڵا هەڵبژێردراوەکان", en: "Featured products", ar: "منتجات مختارة", zh: "精选产品" })}</h1>
          <p className="text-white/80 text-sm mt-1 relative">{label({ ku: "هەڵبژێرە، داواکاری بکە، لە ماڵەوە وەریبگرە", en: "Choose, order, get it delivered", ar: "اختر، اطلب، واستلم", zh: "选择、下单、送货上门" })}</p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-200 animate-pulse" />)}
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-950/40 flex items-center justify-center mx-auto mb-4">
              <StoreIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium text-slate-600">{label({ ku: "هێشتا هیچ کاڵایەک نییە", en: "No products yet", ar: "لا توجد منتجات بعد", zh: "暂无产品" })}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((p: any) => (
              <Link key={p.id} href={`/store/${p.slug}`}>
                <div className="group rounded-2xl bg-white border border-slate-200 dark:border-slate-800/60 overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5">
                  <div className="aspect-square bg-slate-100 dark:bg-slate-950/40 relative overflow-hidden">
                    {p.coverImageUrl ? (
                      <img src={p.coverImageUrl} alt={pName(p, language)} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-slate-300" /></div>
                    )}
                    {p.status === "out_of_stock" && (
                      <span className="absolute top-2 start-2 rounded-lg bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">
                        {label({ ku: "نەماوە", en: "Sold out", ar: "نفد", zh: "售罄" })}
                      </span>
                    )}
                    {p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price) && (
                      <span className="absolute top-2 end-2 rounded-lg bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5">
                        {label({ ku: "داشکاندن", en: "Sale", ar: "خصم", zh: "促销" })}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    {p.category && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 font-medium mb-1"><Tag className="w-2.5 h-2.5" />{p.category}</span>
                    )}
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug min-h-[2.5rem]">{pName(p, language)}</p>
                    <div className="flex items-baseline gap-1.5 mt-1.5">
                      <span className="text-base font-bold text-violet-600">{money(p.price, p.currency)}</span>
                      {p.compareAtPrice && Number(p.compareAtPrice) > Number(p.price) && (
                        <span className="text-xs text-slate-400 line-through">{money(p.compareAtPrice, p.currency)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
