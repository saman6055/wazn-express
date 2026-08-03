import { pickLang } from "@/lib/lang";
import { postText, filterPostsByLanguage } from "@/lib/blogLang";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronRight, Gift, Megaphone, Newspaper, PlayCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

// ---------------------------------------------------------------------------
// WaznNewsCarousel — the portal-home "Wazn News" hero. Up to 5 featured posts
// auto-rotate (5s each); tapping a slide opens that post, and the header links
// to the full /portal/news section. Read-only over trpc.blog.featured.
// ---------------------------------------------------------------------------

const SLIDE_MS = 5000;
const MAX_SLIDES = 5;

const CATEGORY: Record<string, { grad: string; icon: typeof Megaphone; label: { ku: string; en: string; ar: string; zh: string } }> = {
  announcement: { grad: "from-blue-600 to-indigo-600", icon: Megaphone, label: { ku: "ڕاگەیاندن", en: "Announcement", ar: "إعلان", zh: "公告" } },
  news: { grad: "from-emerald-600 to-teal-600", icon: Newspaper, label: { ku: "هەواڵ", en: "News", ar: "خبر", zh: "新闻" } },
  promotion: { grad: "from-amber-600 to-orange-600", icon: Gift, label: { ku: "داشکاندن", en: "Promotion", ar: "عرض", zh: "促销" } },
  update: { grad: "from-purple-600 to-violet-600", icon: RefreshCw, label: { ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" } },
  guide: { grad: "from-cyan-600 to-sky-600", icon: BookOpen, label: { ku: "ڕێنمایی", en: "Guide", ar: "دليل", zh: "指南" } },
};

/** A content string with a YouTube/TikTok/video link → show a play glyph. */
function hasVideo(post: any): boolean {
  const text = `${post.contentEn || ""} ${post.contentKu || ""} ${post.contentAr || ""}`;
  return /youtu\.?be|tiktok\.com|instagram\.com\/(reel|tv)/i.test(text);
}

export function WaznNewsCarousel({ language, isDark }: { language: string; isDark: boolean }) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);
  const isRTL = language === "ku" || language === "ar";

  const { data: posts, isLoading } = trpc.blog.featured.useQuery();
  // Only posts written in the reader's language, then cap to MAX_SLIDES.
  const slides = filterPostsByLanguage(posts as any[], language).slice(0, MAX_SLIDES);

  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);

  // Auto-advance every SLIDE_MS. Resets whenever the slide count changes.
  useEffect(() => {
    if (slides.length <= 1) return;
    timer.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [slides.length]);

  // Keep index in range if posts shrink.
  useEffect(() => {
    if (idx >= slides.length && slides.length > 0) setIdx(0);
  }, [slides.length, idx]);

  const title = (p: any) => postText(p, "title", language);
  const summary = (p: any) => postText(p, "summary", language) || postText(p, "content", language).slice(0, 140);

  if (isLoading) {
    return (
      <div className="px-4 mt-6 mb-6">
        <div className={cn("h-44 w-full rounded-2xl animate-pulse", isDark ? "bg-slate-800" : "bg-slate-200")} />
      </div>
    );
  }
  if (slides.length === 0) return null;

  return (
    <div className="px-4 mt-6 mb-6">
      {/* Header — brand + link to the full news section */}
      <div className="flex items-center justify-between mb-3">
        <Link href="/portal/news">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-sm">
              <Newspaper className="w-4 h-4" />
            </div>
            <h2 className={cn("text-lg font-black group-hover:opacity-80 transition", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {pick({ ku: "وەزن نیوز", en: "Wazn News", ar: "وزن نيوز", zh: "Wazn 新闻" })}
            </h2>
          </div>
        </Link>
        <Link href="/portal/news">
          <span className={cn("text-sm font-medium flex items-center gap-1 transition-colors", isDark ? "text-orange-400 hover:text-orange-300" : "text-orange-600 hover:text-orange-700")}>
            {pick({ ku: "هەموو", en: "View all", ar: "الكل", zh: "全部" })}
            <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
          </span>
        </Link>
      </div>

      {/* Slides viewport */}
      <div className="relative overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${isRTL ? "" : "-"}${idx * 100}%)` }}
        >
          {slides.map((post: any) => {
            const meta = CATEGORY[post.category] ?? CATEGORY.announcement;
            const Icon = meta.icon;
            const video = hasVideo(post);
            return (
              <Link key={post.id} href={`/portal/blog/${post.id}`} className="w-full shrink-0">
                <div className={cn("relative overflow-hidden p-5 min-h-[176px] text-white cursor-pointer bg-gradient-to-br", meta.grad)}>
                  {post.coverImageUrl && (
                    <div className="absolute inset-0">
                      <img src={post.coverImageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover opacity-25" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    </div>
                  )}
                  <div className="absolute -top-8 -end-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />

                  <div className="relative" dir={isRTL ? "rtl" : "ltr"}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-bold">
                        <Icon className="w-3 h-3" />
                        {pick(meta.label)}
                      </span>
                      {video && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/80 text-[11px] font-bold">
                          <PlayCircle className="w-3 h-3" />
                          {pick({ ku: "ڤیدیۆ", en: "Video", ar: "فيديو", zh: "视频" })}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-lg leading-tight line-clamp-2">{title(post)}</p>
                    <p className="text-sm text-white/85 leading-relaxed line-clamp-2 mt-1">{summary(post)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5" dir="ltr">
            {slides.map((_: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`slide ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
