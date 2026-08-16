import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { useState, useMemo } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  HelpCircle, ArrowLeft, ArrowRight, Search, ChevronDown, X,
} from "lucide-react";
import {
  faqCategories, faqHeader, faqAskPrefix, FAQ_WHATSAPP_NUMBER, type L10n,
} from "@/constants/portalFaq";

/** WhatsApp brand glyph (lucide has no brand icons). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

export default function PortalFAQ() {
  const { language } = useLanguage();

  // Banner colour follows the mode the customer picked, like every other page.

  const { banner: portalBanner } = usePortalPalette();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const pick = (v: L10n) => pickLang(language, v);
  const [, navigate] = useLocation();

  const [query, setQuery] = useState("");
  // key = `${categoryId}:${index}` of the open item (single-open accordion).
  const [openKey, setOpenKey] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  // Filter categories/items by the search term (matches question or answer in
  // the current language). Empty query shows everything.
  const filtered = useMemo(() => {
    if (!q) return faqCategories;
    return faqCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (it) => pick(it.q).toLowerCase().includes(q) || pick(it.a).toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, language]);

  const hasResults = filtered.some((c) => c.items.length > 0);
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const waHref = (question: string) =>
    `https://wa.me/${FAQ_WHATSAPP_NUMBER}?text=${encodeURIComponent(`${pick(faqAskPrefix)}\n\n«${question}»`)}`;

  return (
    <PortalLayout>
      <div
        className={cn("min-h-screen", isDark ? "bg-slate-950" : "bg-gray-50 dark:bg-gray-950/40")}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="relative overflow-hidden text-white px-4 pt-6 pb-6" style={portalBanner}>
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -start-6 w-40 h-40 rounded-full bg-white/10 blur-2xl" />

          <button
            onClick={() => navigate("/portal/profile")}
            className="relative flex items-center gap-1.5 text-white/90 text-sm font-medium mb-4 active:scale-95 transition"
          >
            <BackArrow className="w-5 h-5" />
            {pick({ ku: "پرۆفایل", en: "Profile", ar: "الملف الشخصي", zh: "个人资料" })}
          </button>

          <div className="relative flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-1 ring-white/25">
              <HelpCircle className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">{pick(faqHeader.title)}</h1>
              <p className="text-sm text-white/80">{pick(faqHeader.subtitle)}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-5 h-5 text-white/70", isRTL ? "right-3" : "left-3")} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pick(faqHeader.searchPlaceholder)}
              className={cn(
                "w-full h-12 rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/25 text-white placeholder:text-white/60 text-sm outline-none focus:ring-white/50 transition",
                isRTL ? "pr-11 pl-10" : "pl-11 pr-10",
              )}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className={cn("absolute top-1/2 -translate-y-1/2 text-white/70", isRTL ? "left-3" : "right-3")}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-5 space-y-5 pb-28 max-w-lg mx-auto">
          {!hasResults ? (
            <div className={cn("text-center py-12 px-4 rounded-3xl", isDark ? "bg-slate-900" : "bg-white")}>
              <HelpCircle className={cn("w-12 h-12 mx-auto mb-3", isDark ? "text-slate-700 dark:text-slate-300" : "text-slate-300")} />
              <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>{pick(faqHeader.noResults)}</p>
            </div>
          ) : (
            filtered.map((cat) => (
              <section key={cat.id}>
                <div className="flex items-center gap-2.5 mb-2.5 px-1">
                  <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0", cat.gradient)}>
                    <cat.icon className="w-4.5 h-4.5" />
                  </div>
                  <h2 className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>{pick(cat.title)}</h2>
                </div>

                <div className={cn("rounded-2xl overflow-hidden divide-y", isDark ? "bg-slate-900 divide-slate-800" : "bg-white divide-gray-100 shadow-sm")}>
                  {cat.items.map((it, i) => {
                    const key = `${cat.id}:${i}`;
                    const open = openKey === key;
                    return (
                      <div key={key}>
                        <button
                          onClick={() => setOpenKey(open ? null : key)}
                          className={cn(
                            "w-full flex items-center justify-between gap-3 p-4 text-start transition",
                            isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50",
                          )}
                        >
                          <span className={cn("text-sm font-semibold flex-1", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                            {pick(it.q)}
                          </span>
                          <ChevronDown
                            className={cn(
                              "w-5 h-5 shrink-0 transition-transform duration-200",
                              isDark ? "text-slate-500" : "text-slate-400",
                              open && "rotate-180",
                            )}
                          />
                        </button>
                        {open && (
                          <div className="px-4 pb-4 -mt-1">
                            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600")}>
                              {pick(it.a)}
                            </p>
                            <a
                              href={waHref(pick(it.q))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 active:scale-95 transition"
                            >
                              <WhatsAppIcon className="w-4 h-4" />
                              {pick(faqHeader.askOnWhatsApp)}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          {/* Still stuck → WhatsApp */}
          <div className={cn(
            "rounded-3xl p-5 text-center",
            isDark ? "bg-gradient-to-br from-slate-900 to-slate-800" : "bg-gradient-to-br from-cyan-50 dark:from-cyan-950/40 to-blue-50 dark:to-blue-950/40 ring-1 ring-cyan-100",
          )}>
            <p className={cn("text-sm font-semibold mb-3", isDark ? "text-white" : "text-slate-700 dark:text-slate-300")}>
              {pick(faqHeader.stillStuck)}
            </p>
            <a
              href={`https://wa.me/${FAQ_WHATSAPP_NUMBER}?text=${encodeURIComponent(pick(faqAskPrefix))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition"
            >
              <WhatsAppIcon className="w-5 h-5" />
              {pick(faqHeader.askOnWhatsApp)}
            </a>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
