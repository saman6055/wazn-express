import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, Calendar, Eye, Star, Share2, Clock,
  Megaphone, Newspaper, Gift, RefreshCw, BookOpen
} from "lucide-react";
import { Link, useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PortalBlogDetail() {
const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const { data: post, isLoading } = trpc.blog.getById.useQuery(
    { id: parseInt(id || "0") },
    { enabled: !!id }
  );
  
  // Get title based on language
  const getTitle = (post: any) => {
    if (language === "ku" && post.titleKu) return post.titleKu;
    if (language === "ar" && post.titleAr) return post.titleAr;
    return post.titleEn;
  };
  
  // Get content based on language
  const getContent = (post: any) => {
    if (language === "ku" && post.contentKu) return post.contentKu;
    if (language === "ar" && post.contentAr) return post.contentAr;
    return post.contentEn;
  };
  
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
      case "announcement": return language === "ku" ? "ڕاگەیاندن" : "Announcement";
      case "news": return language === "ku" ? "هەواڵ" : "News";
      case "promotion": return language === "ku" ? "داشکاندن" : "Promotion";
      case "update": return language === "ku" ? "نوێکردنەوە" : "Update";
      case "guide": return language === "ku" ? "ڕێنمایی" : "Guide";
      default: return category;
    }
  };
  
  // Format date
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    if (language === "ku") {
      return d.toLocaleDateString("ku", { year: "numeric", month: "long", day: "numeric" });
    }
    return d.toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" });
  };
  
  // Calculate read time
  const getReadTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content?.split(/\s+/).length || 0;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes < 1 ? 1 : minutes;
  };
  
  // Share function
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post ? getTitle(post) : "",
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success(language === "ku" ? "لینک کۆپی کرا" : "Link copied!");
    }
  };

  if (isLoading) {
    return (
      <CustomerPortalLayout>
        <div className="px-4 py-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-2xl mb-4" />
          <Skeleton className="h-8 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-6" />
          <Skeleton className="h-32 w-full" />
        </div>
      </CustomerPortalLayout>
    );
  }

  if (!post) {
    return (
      <CustomerPortalLayout>
        <div className={cn(
          "text-center py-16 px-4",
          isDark ? "text-white" : "text-slate-800"
        )}>
          <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h2 className="text-xl font-bold mb-2">
            {language === "ku" ? "بابەت نەدۆزرایەوە" : "Post not found"}
          </h2>
          <Link href="/portal/blog">
            <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-medium">
              {language === "ku" ? "گەڕانەوە" : "Go Back"}
            </button>
          </Link>
        </div>
      </CustomerPortalLayout>
    );
  }

  return (
    <CustomerPortalLayout>
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-10 px-4 py-4 border-b backdrop-blur-lg",
        isDark ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-gray-100"
      )}>
        <div className="flex items-center justify-between">
          <Link href="/portal/blog">
            <button className={cn(
              "p-2 rounded-xl transition-colors",
              isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"
            )}>
              <ArrowLeft className={cn("w-5 h-5", isDark ? "text-white" : "text-slate-800")} />
            </button>
          </Link>
          
          <button 
            onClick={handleShare}
            className={cn(
              "p-2 rounded-xl transition-colors",
              isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"
            )}
          >
            <Share2 className={cn("w-5 h-5", isDark ? "text-white" : "text-slate-800")} />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="pb-24">
        {/* Cover Image */}
        {post.coverImageUrl && (
          <div className="relative h-56 overflow-hidden">
            <img 
              src={post.coverImageUrl} 
              alt={getTitle(post)}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            
            {/* Category Badge */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <span className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium text-white flex items-center gap-1.5 backdrop-blur-sm",
                `bg-gradient-to-r ${getCategoryGradient(post.category)}`
              )}>
                {getCategoryIcon(post.category)}
                {getCategoryLabel(post.category)}
              </span>
              {post.isFeatured && (
                <span className="p-2 bg-amber-500 rounded-full">
                  <Star className="w-4 h-4 text-white fill-white" />
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Article Content */}
        <div className="px-4 py-6">
          {/* Title */}
          <h1 className={cn(
            "text-2xl font-bold mb-4 leading-tight",
            isDark ? "text-white" : "text-slate-800"
          )} dir={isRTL ? "rtl" : "ltr"}>
            {getTitle(post)}
          </h1>
          
          {/* Meta Info */}
          <div className={cn(
            "flex flex-wrap items-center gap-4 mb-6 pb-6 border-b",
            isDark ? "border-slate-700" : "border-gray-200"
          )}>
            <div className={cn(
              "flex items-center gap-1.5 text-sm",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              <Calendar className="w-4 h-4" />
              {formatDate(post.publishedAt || post.createdAt)}
            </div>
            
            <div className={cn(
              "flex items-center gap-1.5 text-sm",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              <Eye className="w-4 h-4" />
              {post.viewCount} {language === "ku" ? "بینین" : "views"}
            </div>
            
            <div className={cn(
              "flex items-center gap-1.5 text-sm",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              <Clock className="w-4 h-4" />
              {getReadTime(getContent(post))} {language === "ku" ? "خولەک" : "min read"}
            </div>
          </div>
          
          {/* Category Badge (if no cover image) */}
          {!post.coverImageUrl && (
            <div className="mb-6">
              <span className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white",
                `bg-gradient-to-r ${getCategoryGradient(post.category)}`
              )}>
                {getCategoryIcon(post.category)}
                {getCategoryLabel(post.category)}
              </span>
            </div>
          )}
          
          {/* Article Body */}
          <article 
            className={cn(
              "prose prose-lg max-w-none",
              isDark ? "prose-invert" : "",
              isRTL ? "text-right" : "text-left"
            )}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {/* Render content with proper line breaks */}
            {getContent(post).split('\n').map((paragraph: string, index: number) => (
              paragraph.trim() && (
                <p key={index} className={cn(
                  "mb-4 leading-relaxed",
                  isDark ? "text-slate-300" : "text-slate-700"
                )}>
                  {paragraph}
                </p>
              )
            ))}
          </article>
          
          {/* Share Section */}
          <div className={cn(
            "mt-8 pt-6 border-t",
            isDark ? "border-slate-700" : "border-gray-200"
          )}>
            <button
              onClick={handleShare}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors",
                isDark 
                  ? "bg-slate-800 text-white hover:bg-slate-700" 
                  : "bg-gray-100 text-slate-800 hover:bg-gray-200"
              )}
            >
              <Share2 className="w-5 h-5" />
              {language === "ku" ? "هاوبەشکردن" : "Share this article"}
            </button>
          </div>
          
          {/* Back to Blog */}
          <Link href="/portal/blog">
            <button className={cn(
              "w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors",
              "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90"
            )}>
              <ArrowLeft className="w-5 h-5" />
              {language === "ku" ? "گەڕانەوە بۆ هەواڵەکان" : "Back to all posts"}
            </button>
          </Link>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}
