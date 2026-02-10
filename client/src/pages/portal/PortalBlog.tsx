import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  Megaphone, ChevronRight, Calendar, Eye, Star,
  Newspaper, Gift, RefreshCw, BookOpen, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function PortalBlog() {
const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const { data: blogPosts, isLoading } = trpc.blog.published.useQuery();
  
  // Get title based on language
  const getTitle = (post: any) => {
    if (language === "ku" && post.titleKu) return post.titleKu;
    if (language === "ar" && post.titleAr) return post.titleAr;
    return post.titleEn;
  };
  
  // Get summary based on language
  const getSummary = (post: any) => {
    if (language === "ku" && post.summaryKu) return post.summaryKu;
    if (language === "ar" && post.summaryAr) return post.summaryAr;
    return post.summaryEn || post.contentEn?.substring(0, 150) + "...";
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
    return d.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
  };
  
  // Check if post is new (within last 7 days)
  const isNew = (date: Date | string) => {
    const postDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  return (
    <CustomerPortalLayout>
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-10 px-4 py-4 border-b backdrop-blur-lg",
        isDark ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-gray-100"
      )}>
        <div className="flex items-center gap-3">
          <Link href="/portal">
            <button className={cn(
              "p-2 rounded-xl transition-colors",
              isDark ? "hover:bg-slate-800" : "hover:bg-gray-100"
            )}>
              <ArrowLeft className={cn("w-5 h-5", isDark ? "text-white" : "text-slate-800")} />
            </button>
          </Link>
          <div>
            <h1 className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-800")}>
              {language === "ku" ? "هەواڵ و ڕاگەیاندنەکان" : "News & Announcements"}
            </h1>
            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
              {language === "ku" ? "نوێترین هەواڵەکان" : "Latest updates"}
            </p>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-6 pb-24">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : !blogPosts || blogPosts.length === 0 ? (
          <div className={cn(
            "text-center py-16 rounded-2xl",
            isDark ? "bg-slate-800/50" : "bg-gray-50"
          )}>
            <Megaphone className={cn(
              "w-16 h-16 mx-auto mb-4",
              isDark ? "text-slate-600" : "text-gray-300"
            )} />
            <h3 className={cn("text-lg font-semibold mb-2", isDark ? "text-white" : "text-slate-800")}>
              {language === "ku" ? "هیچ هەواڵێک نییە" : "No announcements yet"}
            </h3>
            <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
              {language === "ku" ? "هەواڵەکان لێرە دەردەکەون" : "Announcements will appear here"}
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
                      <img 
                        src={post.coverImageUrl} 
                        alt={getTitle(post)}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      
                      {/* Category Badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1.5 backdrop-blur-sm",
                          `bg-gradient-to-r ${getCategoryGradient(post.category)}`
                        )}>
                          {getCategoryIcon(post.category)}
                          {getCategoryLabel(post.category)}
                        </span>
                        {isNew(post.publishedAt || post.createdAt) && (
                          <span className="px-2 py-1 bg-red-500 rounded-full text-xs font-medium text-white">
                            {language === "ku" ? "نوێ" : "New"}
                          </span>
                        )}
                      </div>
                      
                      {/* Featured Badge */}
                      {post.isFeatured && (
                        <div className="absolute top-3 right-3">
                          <span className="p-2 bg-amber-500 rounded-full">
                            <Star className="w-4 h-4 text-white fill-white" />
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={cn(
                      "h-24 flex items-center justify-center",
                      `bg-gradient-to-br ${getCategoryGradient(post.category)}`
                    )}>
                      <div className="flex items-center gap-2 text-white">
                        {getCategoryIcon(post.category)}
                        <span className="font-medium">{getCategoryLabel(post.category)}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="p-4">
                    <h3 className={cn(
                      "font-bold text-lg mb-2 line-clamp-2",
                      isDark ? "text-white" : "text-slate-800"
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
                        <span>{language === "ku" ? "بخوێنەوە" : "Read"}</span>
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
    </CustomerPortalLayout>
  );
}
