import { useState, useMemo } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformBadge } from "@/components/PlatformSelect";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { LANGUAGE_NAME } from "@/constants/tutorialLanguages";
import { tutorialTitle, tutorialSummary } from "@/lib/tutorialText";
import { GraduationCap, Play, X, ThumbsUp, ThumbsDown, MessageCircle, Star, Languages } from "lucide-react";
import { PortalErrorState } from "@/components/portal/PortalErrorState";

/**
 * Tutorials — short how-to videos, grouped into admin-defined sections.
 *
 * The video plays inside the portal rather than sending the customer to
 * YouTube: they stay in the app, and an embedded play still counts toward the
 * company's own YouTube views. Under each video sits a WhatsApp button (the
 * question arrives where staff already answer, with the video named for them)
 * and a helpful / not-helpful vote, which needs no moderation.
 */
export default function PortalTutorials() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const label = (o: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, o);

  // A page elsewhere can link straight to its own section, e.g.
  // /portal/tutorials?s=Taobao — the customer lands on the relevant videos
  // instead of the full list.
  const [category, setCategory] = useState<string>(
    () => new URLSearchParams(window.location.search).get("s") ?? "",
  );
  const [playing, setPlaying] = useState<any | null>(null);
  const [voted, setVoted] = useState<Record<number, "helpful" | "notHelpful">>({});

  // Videos are filtered by the language they are spoken in, not by the
  // language of their title — a Kurdish narration helps nobody reading in
  // Arabic. Once the customer asks for other languages we stop sending it.
  const [allLanguages, setAllLanguages] = useState(false);
  const { data: tutorials, isLoading, isError, isFetching, refetch } = trpc.tutorials.list.useQuery(
    allLanguages ? {} : { language },
  );
  const recordEvent = trpc.tutorials.recordEvent.useMutation();

  const categories = useMemo(() => {
    const set = new Set((tutorials ?? []).map((t: any) => t.category).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [tutorials]);

  const shown = useMemo(
    () => (tutorials ?? []).filter((t: any) => !category || t.category === category),
    [tutorials, category],
  );

  const title = (t: any) => tutorialTitle(t, language);
  const summary = (t: any) => tutorialSummary(t, language);

  const duration = (secs?: number | null) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const open = (t: any) => {
    setPlaying(t);
    // Fire-and-forget: a failed count must never stop the video opening.
    recordEvent.mutate({ id: t.id, event: "view" });
  };

  const vote = (t: any, event: "helpful" | "notHelpful") => {
    if (voted[t.id]) return;
    setVoted((v) => ({ ...v, [t.id]: event }));
    recordEvent.mutate({ id: t.id, event });
  };

  const askOnWhatsApp = (t: any) => {
    const msg = label({
      ku: `سڵاو، پرسیارم هەیە دەربارەی ئەم فێرکارییە: «${title(t)}»`,
      en: `Hello, I have a question about this tutorial: "${title(t)}"`,
      ar: `مرحباً، لديّ سؤال حول هذا الشرح: «${title(t)}»`,
      zh: `您好，我想咨询这个教程：「${title(t)}」`,
    });
    window.open(`https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <PortalLayout>
      <div dir={isRTL ? "rtl" : "ltr"} className="px-3 py-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">
              {label({ ku: "فێرکاری", en: "Tutorials", ar: "الشروحات", zh: "教程" })}
            </h1>
            <p className="text-xs text-muted-foreground">
              {label({
                ku: "بە ڤیدیۆ فێربە چۆن داوای کاڵا بکەیت و پۆرتاڵ بەکاربهێنیت",
                en: "Short videos on ordering and using the portal",
                ar: "فيديوهات قصيرة عن الطلب واستخدام البوابة",
                zh: "关于下单和使用门户的简短视频",
              })}
            </p>
          </div>
        </div>

        {/* Sections */}
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {[{ key: "", name: label({ ku: "هەموو", en: "All", ar: "الكل", zh: "全部" }) },
              ...categories.map((c) => ({ key: c, name: c }))].map((c) => (
              <button
                key={c.key || "all"}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 border",
                  category === c.key
                    ? "bg-sky-600 text-white border-sky-600"
                    : isDark ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 dark:border-slate-800/60 text-slate-700 dark:text-slate-300",
                )}
              >
                {c.key && <PlatformBadge name={c.key} size={16} />}
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
          </div>
        ) : isError ? (
          <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : shown.length === 0 ? (
          <div className={cn("rounded-2xl border p-8 text-center", isDark ? "border-slate-700 bg-slate-800/40" : "border-slate-200 dark:border-slate-800/60 bg-white")}>
            <GraduationCap className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {allLanguages
                ? label({ ku: "هێشتا هیچ فێرکارییەک نییە", en: "No tutorials yet", ar: "لا توجد شروحات بعد", zh: "暂无教程" })
                : label({
                    ku: "هێشتا فێرکاری بە کوردی نییە",
                    en: "No tutorials in English yet",
                    ar: "لا توجد شروحات بالعربية بعد",
                    zh: "暂无中文教程",
                  })}
            </p>
            {/* Never a dead end: the videos exist, just not in this language. */}
            {!allLanguages && (
              <button
                onClick={() => setAllLanguages(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition active:scale-95 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
              >
                <Languages className="h-3.5 w-3.5" />
                {label({
                  ku: "فێرکاریەکان بە زمانی تر پیشان بدە",
                  en: "Show tutorials in other languages",
                  ar: "عرض الشروحات بلغات أخرى",
                  zh: "显示其他语言的教程",
                })}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shown.map((t: any) => (
              <div
                key={t.id}
                className={cn("rounded-2xl border overflow-hidden", isDark ? "border-slate-700 bg-slate-800/50" : "border-slate-200 dark:border-slate-800/60 bg-white")}
              >
                <button onClick={() => open(t)} className="relative block w-full aspect-video bg-slate-900 group">
                  {t.thumbnailUrl && (
                    <img src={t.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition" loading="lazy" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                      <Play className="h-6 w-6 text-white ms-0.5" />
                    </span>
                  </span>
                  {duration(t.durationSeconds) && (
                    <span className="absolute bottom-1.5 start-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {duration(t.durationSeconds)}
                    </span>
                  )}
                  <span className="absolute top-1.5 end-1.5"><PlatformBadge name={t.category} size={20} /></span>
                  {t.isFeatured && (
                    <span className="absolute top-1.5 start-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      <Star className="h-3 w-3" />
                      {label({ ku: "سەرەکی", en: "Start here", ar: "ابدأ هنا", zh: "从这里开始" })}
                    </span>
                  )}
                </button>

                <div className="p-3">
                  <p className="text-sm font-semibold leading-snug">{title(t)}</p>
                  {summary(t) && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{summary(t)}</p>}
                  {/* Only while browsing across languages — otherwise every
                      card would carry a badge saying what the customer
                      already knows. */}
                  {allLanguages && (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Languages className="h-3 w-3" />
                      {LANGUAGE_NAME[t.language as keyof typeof LANGUAGE_NAME] ?? t.language}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player — in-app so the customer stays put and the view still counts
          on the company's YouTube channel. */}
      {playing && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            dir={isRTL ? "rtl" : "ltr"}
            className={cn("w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden", isDark ? "bg-slate-900" : "bg-white")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 p-3 border-b border-black/10 dark:border-white/10">
              <p className="text-sm font-semibold truncate">{title(playing)}</p>
              <button onClick={() => setPlaying(null)} className="shrink-0 rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="aspect-video bg-black">
              {playing.videoId && (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${playing.videoId}?rel=0&modestbranding=1`}
                  title={title(playing)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            <div className="p-3 space-y-3">
              {summary(playing) && <p className="text-xs text-muted-foreground leading-relaxed">{summary(playing)}</p>}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => askOnWhatsApp(playing)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition"
                >
                  <MessageCircle className="h-4 w-4" />
                  {label({ ku: "پرسیارم هەیە", en: "I have a question", ar: "لديّ سؤال", zh: "我有疑问" })}
                </button>

                <div className="ms-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    {label({ ku: "سوودی هەبوو؟", en: "Helpful?", ar: "هل كان مفيداً؟", zh: "有帮助吗？" })}
                  </span>
                  <button
                    onClick={() => vote(playing, "helpful")}
                    disabled={!!voted[playing.id]}
                    className={cn(
                      "rounded-lg p-1.5 transition disabled:opacity-60",
                      voted[playing.id] === "helpful"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "hover:bg-black/5 dark:hover:bg-white/10",
                    )}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => vote(playing, "notHelpful")}
                    disabled={!!voted[playing.id]}
                    className={cn(
                      "rounded-lg p-1.5 transition disabled:opacity-60",
                      voted[playing.id] === "notHelpful"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "hover:bg-black/5 dark:hover:bg-white/10",
                    )}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
