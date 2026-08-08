import { PortalLayout } from "@/components/portal/PortalLayout";
import { usePortalPalette } from "@/components/portal/PortalHeaderControls";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Megaphone, ChevronRight, Calendar, Eye, Star,
  Newspaper, Gift, RefreshCw, BookOpen, ArrowLeft, PlayCircle, Pin
} from "lucide-react";
import { pickLang } from "@/lib/lang";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { Link } from "wouter";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { postText, filterPostsByLanguage } from "@/lib/blogLang";
import { SocialChannels, firstYouTubeId } from "@/components/portal/SocialChannels";
import { formatPortalDate } from "@/lib/portalClock";

export default function PortalBlog() {
const { t, language } = useLanguage();

// Banner colour follows the mode the customer picked, like every other page.

const { banner: portalBanner } = usePortalPalette();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const { data: allPosts, isLoading, isError, isFetching, refetch } = trpc.blog.published.useQuery();
  const [categoryFilter, setCategoryFilter] = useState<"all" | "news" | "promotion" | "announcement" | "update" | "guide">("all");
  // Only posts written in the reader's language, then filter by category — a
  // Kurdish-only post never appears in the Arabic/English feed and vice-versa.
  // Two lists, deliberately. The chips are drawn from everything available;
  // gating them on the filtered list meant that choosing a category with no
  // posts unmounted the chips themselves, leaving "no announcements yet" and
  // no way back to "All".
  const availablePosts = filterPostsByLanguage(allPosts as any[], language);
  const blogPosts = availablePosts
    .filter((p: any) => categoryFilter === "all" || p.category === categoryFilter);

  // Title/summary in the reader's language only (no cross-language fallback).
  const getTitle = (post: any) => postText(post, "title", language);
  const getSummary = (post: any) =>
    postText(post, "summary", language) || (postText(post, "content", language).substring(0, 150) + "...");
  
  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "announcement": return <Megaphone className="w-4 h-4" />;
      case "news": return <Newspaper className="w-4 h-4" />;
      case "promotion": return <Gift className="w-4 h-4" />;
      case "update": return <RefreshCw className="w-4 h-4" />;
      case "guide": return <BookOpen className="w-4 h-4" />;
      default: return <Megaphone className="w-4 h-4" />;
    }
  };
  
  // Get category gradient
  const getCategoryGradient = (category: string) => {
    switch (category) {
      case "announcement": return "from-blue-600 to-indigo-600";
      case "news": return "from-emerald-600 to-teal-600";
      case "promotion": return "from-amber-600 to-orange-600";
      case "update": return "from-purple-600 to-violet-600";
      case "guide": return "from-cyan-600 to-sky-600";
      default: return "from-blue-600 to-indigo-600";
    }
  };
  
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "announcement": return pickLang(language, { ku: "ڕاگەیاندن", en: "Announcement", ar: "إعلان", zh: "公告" });
      case "news": return pickLang(language, { ku: "هەواڵ", en: "News", ar: "أخبار", zh: "新闻" });
      case "promotion": return pickLang(language, { ku: "داشکاندن", en: "Promotion", ar: "عرض", zh: "促销" });
      case "update": return pickLang(language, { ku: "نوێکردنەوە", en: "Update", ar: "تحديث", zh: "更新" });
      case "guide": return pickLang(language, { ku: "ڕێنمایی", en: "Guide", ar: "دليل", zh: "指南" });
      default: return category;
    }
  };
  
  // Format date
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    if (language === "ku") {
      return formatPortalDate(d, language);
    }
    return formatPortalDate(d, language);
  };
  
  // Check if post is new (within last 7 days)
  const isNew = (date: Date | string) => {
    const postDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  return (
    <PortalLayout>
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-10 px-4 py-4 border-b backdrop-blur-lg",
        isDark ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-gray-100 dark:border-gray-800/60"
      )}>
        <div className="flex items-center gap-3">
          <Link href="/portal">
            <button className={cn(
              "p-2 rounded-xl transition-colors",
              isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"
            )}>
              <ArrowLeft className={cn("w-5 h-5", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")} />
            </button>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 rounded-xl text-white shadow-sm shrink-0" style={portalBanner}>
              <Newspaper className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className={cn("text-xl font-black", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {pickLang(language, { ku: "وەزن نیوز", en: "Wazn News", ar: "وزن نيوز", zh: "Wazn 资讯" })}
              </h1>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                {pickLang(language, { ku: "هەواڵ، ڕیکلام و ڤیدیۆ", en: "News, promos & videos", ar: "أخبار وإعلانات وفيديو", zh: "新闻、优惠与视频" })}
              </p>
            </div>
          </div>
          {/* Follow-us channels */}
          <SocialChannels className="shrink-0 [&>a]:h-9 [&>a]:w-9" />
        </div>
      </div>

      {/* Category filter chips */}
      {!isLoading && availablePosts.length > 0 && (
        <div className="px-4 pt-3 -mb-2 flex gap-1.5 overflow-x-auto">
          {(["all", "news", "promotion", "announcement", "update", "guide"] as const).map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                  active
                    ? "bg-orange-600 text-white shadow-sm"
                    : isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40 text-slate-600 hover:bg-slate-200",
                )}
              >
                {cat === "all"
                  ? (pickLang(language, { ku: "هەموو", en: "All", ar: "الكل", zh: "全部" }))
                  : getCategoryLabel(cat)}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-6 pb-24">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <PortalErrorState onRetry={() => void refetch()} isRetrying={isFetching} />
        ) : !blogPosts || blogPosts.length === 0 ? (
          <div className={cn(
            "text-center py-16 rounded-2xl",
            isDark ? "bg-slate-800/50" : "bg-gray-50 dark:bg-gray-950/40"
          )}>
            <Megaphone className={cn(
              "w-16 h-16 mx-auto mb-4",
              isDark ? "text-slate-600" : "text-gray-300"
            )} />
            <h3 className={cn("text-lg font-semibold mb-2", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
              {pickLang(language, { ku: "هیچ هەواڵێک نییە", en: "No announcements yet", ar: "لا توجد إعلانات بعد", zh: "暂无公告" })}
            </h3>
            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
              {pickLang(language, { ku: "هەواڵەکان لێرە دەردەکەون", en: "Announcements will appear here", ar: "ستظهر الإعلانات هنا", zh: "公告将显示在这里" })}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blogPosts.map((post) => (
              <Link key={post.id} href={`/portal/blog/${post.id}`}>
                <div className={cn(
                  "rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer",
                  isDark ? "bg-slate-800" : "bg-white"
                )}>
                  {/* Cover Image */}
                  {post.coverImageUrl ? (
                    <div className="relative h-40 overflow-hidden">
                      <img loading="lazy" decoding="async"
                        src={post.coverImageUrl}
                        alt={getTitle(post)}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {/* Video play overlay when the post embeds a YouTube link */}
                      {firstYouTubeId(`${post.contentEn || ""} ${post.contentKu || ""} ${post.contentAr || ""}`) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg">
                            <PlayCircle className="h-7 w-7" />
                          </span>
                        </div>
                      )}
                      
                      {/* Category Badge */}
                      <div className="absolute top-3 start-3 flex items-center gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1.5 backdrop-blur-sm",
                          `bg-gradient-to-r ${getCategoryGradient(post.category)}`
                        )}>
                          {getCategoryIcon(post.category)}
                          {getCategoryLabel(post.category)}
                        </span>
                        {post.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 rounded-full text-xs font-bold text-white">
                            <Pin className="w-3 h-3" />
                            {pickLang(language, { ku: "چەسپاو", en: "Pinned", ar: "مثبّت", zh: "置顶" })}
                          </span>
                        )}
                        {isNew(post.publishedAt || post.createdAt) && (
                          <span className="px-2 py-1 bg-red-500 rounded-full text-xs font-medium text-white">
                            {pickLang(language, { ku: "نوێ", en: "New", ar: "جديد", zh: "最新" })}
                          </span>
                        )}
                      </div>
                      
                      {/* Featured Badge */}
                      {post.isFeatured && (
                        <div className="absolute top-3 end-3">
                          <span className="p-2 bg-amber-500 rounded-full">
                            <Star className="w-4 h-4 text-white fill-white" />
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "relative h-24 flex items-center justify-center",
                      `bg-gradient-to-br ${getCategoryGradient(post.category)}`
                    )}>
                      <div className="flex items-center gap-2 text-white">
                        {getCategoryIcon(post.category)}
                        <span className="font-medium">{getCategoryLabel(post.category)}</span>
                      </div>
                      <div className="absolute top-2.5 start-2.5 flex items-center gap-1.5">
                        {post.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 rounded-full text-[11px] font-bold text-white">
                            <Pin className="w-3 h-3" />
                            {pickLang(language, { ku: "چەسپاو", en: "Pinned", ar: "مثبّت", zh: "置顶" })}
                          </span>
                        )}
                        {isNew(post.publishedAt || post.createdAt) && (
                          <span className="px-2 py-0.5 bg-red-500 rounded-full text-[11px] font-bold text-white">
                            {pickLang(language, { ku: "نوێ", en: "New", ar: "جديد", zh: "最新" })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="p-4">
                    <h3 className={cn(
                      "font-bold text-lg mb-2 line-clamp-2",
                      isDark ? "text-white" : "text-slate-800 dark:text-slate-200"
                    )} dir={isRTL ? "rtl" : "ltr"}>
                      {getTitle(post)}
                    </h3>
                    
                    <p className={cn(
                      "text-sm mb-4 line-clamp-2",
                      isDark ? "text-slate-400" : "text-slate-600"
                    )} dir={isRTL ? "rtl" : "ltr"}>
                      {getSummary(post)}
                    </p>
                    
                    {/* Meta */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs",
                          isDark ? "text-slate-500" : "text-slate-400"
                        )}>
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(post.publishedAt || post.createdAt)}
                        </div>
                        <div className={cn(
                          "flex items-center gap-1.5 text-xs",
                          isDark ? "text-slate-500" : "text-slate-400"
                        )}>
                          <Eye className="w-3.5 h-3.5" />
                          {post.viewCount}
                        </div>
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-medium",
                        isDark ? "text-blue-400" : "text-blue-600"
                      )}>
                        <span>{pickLang(language, { ku: "بخوێنەوە", en: "Read", ar: "اقرأ", zh: "阅读" })}</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
