import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { WhatsAppHelpButton } from "@/components/portal/WhatsAppHelpButton";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { ArrowLeft, BookOpen, ChevronLeft, Lightbulb, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  guideHeader,
  guideSections,
  type GuideSection,
} from "@/constants/portalGuide";
import type { L10n } from "@/constants/portalTerms";

export default function PortalGuide() {
  const { language } = useLanguage();

  // Banner colour follows the mode the customer picked, like every other page.

  const { banner: portalBanner } = usePortalPalette();
  const isRTL = language === "ku" || language === "ar";
  const pick = (v: L10n) => pickLang(language, v);

  const [query, setQuery] = useState("");
  // Deep-link target: /portal/guide#yuan opens with that section expanded.
  const [openId, setOpenId] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.location.hash.replace("#", "") || null : null,
  );

  // Scroll the deep-linked section into view once on mount.
  useEffect(() => {
    if (openId) {
      const el = document.getElementById(`guide-${openId}`);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo<GuideSection[]>(() => {
    if (!q) return guideSections;
    return guideSections.filter((s) => {
      const hay = [
        pick(s.title),
        pick(s.what),
        pick(s.example),
        ...s.points.map((p) => pick(p)),
        s.id,
        s.path,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, language]);

  const toggle = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
    if (typeof window !== "undefined") {
      history.replaceState(null, "", id === openId ? window.location.pathname : `#${id}`);
    }
  };

  const jumpTo = (id: string) => {
    setOpenId(id);
    history.replaceState(null, "", `#${id}`);
    const el = document.getElementById(`guide-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <CustomerPortalLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="relative overflow-hidden text-white px-4 pt-8 pb-10" style={portalBanner}>
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-12 -start-6 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center ring-1 ring-white/25">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold leading-tight">{pick(guideHeader.title)}</h1>
              <p className="text-sm text-white/80">{pick(guideHeader.subtitle)}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-5">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={pick(guideHeader.searchPlaceholder)}
              className="h-11 ps-9 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 border-0"
              stepper={false}
            />
          </div>
        </div>

        <div className="px-4 py-6 space-y-4 pb-28 max-w-2xl mx-auto">
          {/* Clickable index — only when not searching */}
          {!q && (
            <div className="rounded-2xl bg-white dark:bg-gray-900 ring-1 ring-gray-100 dark:ring-white/5 p-3">
              <p className="px-1 pb-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                {pick(guideHeader.indexTitle)}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {guideSections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => jumpTo(s.id)}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-start transition hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white", s.gradient)}>
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                      {pick(s.title)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section cards */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-900 p-8 text-center ring-1 ring-gray-100 dark:ring-white/5">
              <Search className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">{pick(guideHeader.notFound)}</p>
            </div>
          ) : (
            filtered.map((s) => {
              const open = openId === s.id || !!q; // searching expands matches
              return (
                <section
                  key={s.id}
                  id={`guide-${s.id}`}
                  className="scroll-mt-20 overflow-hidden rounded-3xl bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-100 dark:ring-white/5"
                >
                  {/* Header row — tap to expand */}
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn("flex w-full items-center gap-3 bg-gradient-to-r px-4 py-3.5 text-start", s.gradient)}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/20">
                      <s.icon className="h-5 w-5 text-white" />
                    </span>
                    <span className="flex-1 text-base font-bold text-white">{pick(s.title)}</span>
                    <ChevronLeft
                      className={cn(
                        "h-5 w-5 shrink-0 text-white/80 transition-transform",
                        isRTL ? "rotate-0" : "rotate-180",
                        open && "-rotate-90",
                      )}
                    />
                  </button>

                  {open && (
                    <div className="space-y-4 p-4">
                      {/* What is this */}
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                          {pick(guideHeader.whatTitle)}
                        </p>
                        <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-100">
                          {pick(s.what)}
                        </p>
                      </div>

                      {/* Points */}
                      <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                          {pick(guideHeader.pointsTitle)}
                        </p>
                        <ul className="space-y-1.5">
                          {s.points.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                              <span className="leading-relaxed">{pick(p)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Example */}
                      <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <Lightbulb className="h-3.5 w-3.5" />
                          {pick(guideHeader.exampleTitle)}
                        </p>
                        <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
                          {pick(s.example)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Link href={s.path}>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r px-4 py-2 text-sm font-bold text-white shadow-sm transition active:scale-95",
                              s.gradient,
                            )}
                          >
                            <ArrowLeft className={cn("h-4 w-4", !isRTL && "rotate-180")} />
                            {pick(guideHeader.goTo)}
                          </button>
                        </Link>
                        <WhatsAppHelpButton
                          language={language}
                          section={pick(guideHeader.title)}
                          topic={pick(s.title)}
                        />
                      </div>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
