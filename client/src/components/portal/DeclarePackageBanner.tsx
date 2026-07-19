import { Link } from "wouter";
import { PackagePlus, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

/**
 * Prominent home-screen call-to-action inviting the customer to pre-register
 * (declare) the tracking number of anything they've just bought, so it is
 * auto-owned to them the moment it reaches our warehouse. Rendered by
 * CustomerPortalLayout only on the portal home route, so it shows above every
 * home skin. Doubles as guidance ("whatever you bought, register its track").
 */
export function DeclarePackageBanner() {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="px-3 pt-3">
      <Link href="/portal/declare">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-4 shadow-lg shadow-emerald-500/25 transition-transform active:scale-[0.99]">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -end-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -start-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <PackagePlus className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-tight text-white">
                {pickLang(language, {
                  ku: "هەرچیت کڕیوە؟ تراکەکەی تۆمار بکە",
                  en: "Bought something? Register its tracking",
                  ar: "اشتريت شيئاً؟ سجّل رقم التتبع",
                  zh: "买了东西？登记运单号",
                })}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-white/85">
                {pickLang(language, {
                  ku: "تراکەکەی داخڵ بکە تاکو کاتێ گەیشت یەکسەر بەناوی تۆ تۆمار بکرێت — پاکەتت بێ‌خاوەن نامێنێتەوە",
                  en: "Enter the tracking so it's auto-assigned to you on arrival — no more unclaimed packages",
                  ar: "أدخل رقم التتبع ليُسجَّل باسمك عند الوصول — لا طرود بلا صاحب",
                  zh: "输入运单号，到货即自动归到您名下 — 不再有无主包裹",
                })}
              </p>
            </div>
            <Arrow className="h-5 w-5 shrink-0 text-white/90 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </div>
  );
}
