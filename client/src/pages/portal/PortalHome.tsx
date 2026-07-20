import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import ModernPortalHome from "./modern/ModernPortalHome";
import Skin3PortalHome from "./skin3/Skin3PortalHome";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  Package, Bell, ChevronRight, Truck, CheckCircle, Clock,
  AlertCircle, Plane, Ship, Megaphone, TrendingUp, Search,
  CreditCard, MessageCircle, FileText, Wallet, DollarSign,
  Sun, Moon, Sparkles, AlertTriangle, PackagePlus
} from "lucide-react";
import { pickLang } from "@/lib/lang";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useState, useEffect } from "react";
import { PriceListSection } from "@/components/portal/PriceListSection";

// Animated Counter Component
function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }
    
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return <>{count}</>;
}

// Get time-based greeting
function getGreeting(language: string): string {
  const hour = new Date().getHours();
  
  if (language === "ku") {
    if (hour < 12) return "بەیانیت باش";
    if (hour < 17) return "ڕۆژت باش";
    if (hour < 21) return "ئێوارەت باش";
    return "شەوت باش";
  }
  
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

// Get greeting icon
function GreetingIcon() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 18) {
    return <Sun className="w-5 h-5 text-amber-400" />;
  }
  return <Moon className="w-5 h-5 text-indigo-300" />;
}

// Announcements Section Component
function AnnouncementsSection({ isDark, language, t }: { isDark: boolean; language: string; t: (key: string) => string }) {
  const company = useCompanyInfo();
  const { data: blogPosts, isLoading } = trpc.blog.featured.useQuery();
  
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
    return post.summaryEn || post.contentEn?.substring(0, 100) + "...";
  };
  
  // Get category gradient
  const getCategoryGradient = (category: string) => {
    switch (category) {
      case "announcement": return "from-blue-600 via-blue-500 to-indigo-600";
      case "news": return "from-emerald-600 via-emerald-500 to-teal-600";
      case "promotion": return "from-amber-600 via-amber-500 to-orange-600";
      case "update": return "from-purple-600 via-purple-500 to-violet-600";
      case "guide": return "from-cyan-600 via-cyan-500 to-sky-600";
      default: return "from-blue-600 via-blue-500 to-indigo-600";
    }
  };
  
  const getCategoryShadow = (category: string) => {
    switch (category) {
      case "announcement": return "shadow-blue-500/30";
      case "news": return "shadow-emerald-500/30";
      case "promotion": return "shadow-amber-500/30";
      case "update": return "shadow-purple-500/30";
      case "guide": return "shadow-cyan-500/30";
      default: return "shadow-blue-500/30";
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
  
  // Check if post is new (within last 7 days)
  const isNew = (date: Date | string) => {
    const postDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };
  
  if (isLoading) {
    return (
      <div className="px-4 mt-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-700")} />
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
            {t("portal.announcements") || "ڕاگەیاندنەکان"}
          </h2>
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  
  // If no blog posts, show default welcome message
  if (!blogPosts || blogPosts.length === 0) {
    return (
      <div className="px-4 mt-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-700")} />
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
            {t("portal.announcements") || "ڕاگەیاندنەکان"}
          </h2>
        </div>
        
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/30">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                {t("new") || "New"}
              </span>
            </div>
            <p className="font-bold text-lg mb-2">{t("welcomeToWazn") || `Welcome to ${company.name}!`}</p>
            <p className="text-sm text-blue-100 leading-relaxed">
              {t("trackPackagesEasily") || "Track your packages easily through this portal. Get real-time updates on your shipments."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="px-4 mt-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-700")} />
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
            {t("portal.announcements") || "ڕاگەیاندنەکان"}
          </h2>
        </div>
        <Link href="/portal/blog">
          <span className={cn(
            "text-sm font-medium flex items-center gap-1 transition-colors",
            isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"
          )}>
            {language === "ku" ? "هەموو" : "View All"}
            <ChevronRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
      
      {/* Blog Posts Carousel */}
      <div className="space-y-3">
        {blogPosts.slice(0, 3).map((post) => (
          <Link key={post.id} href={`/portal/blog/${post.id}`}>
            <div className={cn(
              "relative overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer",
              `bg-gradient-to-br ${getCategoryGradient(post.category)}`,
              getCategoryShadow(post.category)
            )}>
              {/* Cover Image Background */}
              {post.coverImageUrl && (
                <div className="absolute inset-0">
                  <img 
                    src={post.coverImageUrl} 
                    alt="" 
                    className="w-full h-full object-cover opacity-20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                </div>
              )}
              
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {isNew(post.publishedAt || post.createdAt) && (
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                      {t("new") || "New"}
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-medium backdrop-blur-sm">
                    {getCategoryLabel(post.category)}
                  </span>
                </div>
                <p className="font-bold text-lg mb-2 line-clamp-2" dir={language === "ku" || language === "ar" ? "rtl" : "ltr"}>
                  {getTitle(post)}
                </p>
                <p className="text-sm text-white/80 leading-relaxed line-clamp-2" dir={language === "ku" || language === "ar" ? "rtl" : "ltr"}>
                  {getSummary(post)}
                </p>
                
                {/* Read More */}
                <div className="flex items-center gap-1 mt-3 text-sm font-medium text-white/90">
                  <span>{t("portal.readMore")}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function PortalHome() {
  const { portalTheme } = usePortalTheme();
  
  if (portalTheme === "skin3") return <Skin3PortalHome />;
  if (portalTheme === "modern") return <ModernPortalHome />;
  
  // Classic theme (current design)
  return <ClassicPortalHome />;
}

function ClassicPortalHome() {
const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const { data: account, isLoading: accountLoading } = trpc.customerPortal.getMyAccount.useQuery();
  const { data: batches, isLoading: batchesLoading } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: notificationCount } = trpc.customerPortal.getNotificationCount.useQuery();
  const { data: financialSummary } = trpc.customerPortal.getMyFinancialSummary.useQuery();
  const { data: pendingOrders } = trpc.customerPortal.getMyPendingOrders.useQuery();

  // Get recent batches (last 3)
  const recentBatches = batches?.slice(0, 3) || [];
  
  // Calculate stats
  const totalBatches = batches?.length || 0;
  const inTransitCount = batches?.filter(b => b.status === "in_transit").length || 0;
  const deliveredCount = batches?.filter(b => b.status === "delivered" || b.status === "closed").length || 0;
  const pendingCount = batches?.filter(b => b.status === "preparing" || b.status === "customs").length || 0;
  
  // Balance info
  const balance = financialSummary?.balanceUsd || 0;
  const hasDebt = balance > 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return <CheckCircle className="w-4 h-4" />;
      case "in_transit":
        return <Truck className="w-4 h-4" />;
      case "customs":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
      case "closed":
        return isDark ? "bg-emerald-900/50 text-emerald-400" : "bg-emerald-100 text-emerald-700";
      case "in_transit":
        return isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 text-blue-700";
      case "customs":
        return isDark ? "bg-amber-900/50 text-amber-400" : "bg-amber-100 text-amber-700";
      default:
        return isDark ? "bg-slate-700 text-slate-300" : "bg-gray-100 text-gray-600";
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      preparing: t("preparing") || "Preparing",
      in_transit: t("inTransit") || "In Transit",
      arrived: t("arrived") || "Arrived",
      customs: t("customs") || "Customs",
      delivered: t("delivered") || "Delivered",
      closed: t("closed") || "Closed",
    };
    return statusMap[status] || status;
  };

  const getShippingIcon = (type: string) => {
    if (type?.includes("sea")) return <Ship className="w-5 h-5" />;
    return <Plane className="w-5 h-5" />;
  };

  // Quick Actions
  const quickActions = [
    {
      icon: Search,
      label: t("portal.track"),
      href: "/portal/search",
      color: "from-blue-500 to-blue-600",
      shadowColor: "shadow-blue-500/30"
    },
    {
      icon: AlertTriangle,
      label: language === "ku" ? "بێ خاوەن" : "Unclaimed",
      href: "/portal/no-mark",
      color: "from-orange-500 to-orange-600",
      shadowColor: "shadow-orange-500/30"
    },
    {
      icon: PackagePlus,
      label: pickLang(language, { ku: "تۆماری تراک", en: "Register tracking", ar: "تسجيل التتبع", zh: "登记运单" }),
      href: "/portal/declare",
      color: "from-teal-500 to-teal-600",
      shadowColor: "shadow-teal-500/30"
    },
    {
      icon: CreditCard,
      label: t("portal.pay"),
      href: "/portal/financial",
      color: "from-emerald-500 to-emerald-600",
      shadowColor: "shadow-emerald-500/30"
    },
    {
      icon: FileText,
      label: t("portal.request"),
      href: "/portal/full-package",
      color: "from-amber-500 to-amber-600",
      shadowColor: "shadow-amber-500/30"
    }
  ];

  return (
    <CustomerPortalLayout>
      {/* Premium Header with Gradient */}
      <div className="relative overflow-hidden">
        <div className={cn(
          "absolute inset-0",
          isDark 
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" 
            : "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        )} />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative px-5 pt-14 pb-12">
          {/* Top Row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              {/* Time-based greeting */}
              <div className="flex items-center gap-2 mb-2">
                <GreetingIcon />
                <p className="text-slate-400 text-sm font-medium">
                  {getGreeting(language)}
                </p>
              </div>
              {accountLoading ? (
                <Skeleton className="h-8 w-40 bg-slate-700" />
              ) : (
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  {account?.fullName || account?.customerCode}
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </h1>
              )}
            </div>
            
            {/* Notification Bell */}
            <Link href="/portal/notifications">
              <button className="relative p-3 bg-white/10 backdrop-blur-sm rounded-2xl hover:bg-white/20 transition-all duration-300 group">
                <Bell className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                {notificationCount && notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center text-white px-1 animate-pulse">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>
            </Link>
          </div>

          {/* Customer Code Badge */}
          {account?.customerCode && (
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 px-4 py-2 rounded-full backdrop-blur-sm">
              <Package className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">{account.customerCode}</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-6">
            <div className="grid grid-cols-5 gap-2">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <button className="flex flex-col items-center gap-2 group w-full">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl",
                      action.color,
                      action.shadowColor
                    )}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
                      {action.label}
                    </span>
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Balance Card - Floating */}
      <div className="px-4 -mt-5 relative z-10">
        <Link href="/portal/financial">
          <div className={cn(
            "rounded-2xl p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer",
            hasDebt 
              ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30" 
              : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">
                  {hasDebt 
                    ? t("portal.outstandingBalance")
                    : t("portal.balance")
                  }
                </p>
                <p className="text-3xl font-bold text-white">
                  ${Math.abs(balance).toFixed(2)}
                </p>
              </div>
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center",
                hasDebt ? "bg-white/20" : "bg-white/20"
              )}>
                {hasDebt ? (
                  <DollarSign className="w-7 h-7 text-white" />
                ) : (
                  <Wallet className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
            {hasDebt && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white/60 rounded-full w-3/4 animate-pulse" />
                </div>
                <span className="text-xs text-white/80 font-medium">
                  {t("portal.payNow")} →
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* Price List Section — admin-curated shipping rates & services */}
      <PriceListSection />

      {/* Stats Cards */}
      <div className="px-4 mt-4">
        <div className={cn(
          "rounded-2xl shadow-lg p-5 transition-colors duration-300",
          isDark ? "bg-slate-800 shadow-slate-900/50" : "bg-white shadow-slate-200/50"
        )}>
          <div className="grid grid-cols-4 gap-2">
            {/* Total Batches */}
            <Link href="/portal/shipments">
              <div className={cn(
                "text-center p-3 rounded-xl transition-all duration-300 cursor-pointer hover:scale-105",
                isDark 
                  ? "bg-slate-700/50 hover:bg-slate-700" 
                  : "bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg",
                  isDark ? "bg-slate-600 shadow-slate-900" : "bg-slate-800 shadow-slate-300"
                )}>
                  <Package className="w-5 h-5 text-white" />
                </div>
                {batchesLoading ? (
                  <Skeleton className={cn("h-7 w-8 mx-auto mb-1", isDark && "bg-slate-600")} />
                ) : (
                  <p className={cn("text-xl font-bold", isDark ? "text-white" : "text-slate-800")}>
                    <AnimatedCounter value={totalBatches} />
                  </p>
                )}
                <p className={cn("text-[10px] font-medium", isDark ? "text-slate-400" : "text-slate-500")}>
                  {t("portal.total")}
                </p>
              </div>
            </Link>

            {/* In Transit */}
            <Link href="/portal/shipments?status=in_transit">
              <div className={cn(
                "text-center p-3 rounded-xl transition-all duration-300 cursor-pointer hover:scale-105",
                isDark 
                  ? "bg-blue-900/30 hover:bg-blue-900/50" 
                  : "bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg",
                  isDark ? "bg-blue-600 shadow-blue-900" : "bg-blue-500 shadow-blue-200"
                )}>
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                {batchesLoading ? (
                  <Skeleton className={cn("h-7 w-8 mx-auto mb-1", isDark && "bg-slate-600")} />
                ) : (
                  <p className={cn("text-xl font-bold", isDark ? "text-blue-400" : "text-blue-600")}>
                    <AnimatedCounter value={inTransitCount} />
                  </p>
                )}
                <p className={cn("text-[10px] font-medium", isDark ? "text-blue-400/70" : "text-blue-600/70")}>
                  {t("portal.inTransit")}
                </p>
              </div>
            </Link>

            {/* Pending */}
            <Link href="/portal/shipments?status=pending">
              <div className={cn(
                "text-center p-3 rounded-xl transition-all duration-300 cursor-pointer hover:scale-105",
                isDark 
                  ? "bg-amber-900/30 hover:bg-amber-900/50" 
                  : "bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg",
                  isDark ? "bg-amber-600 shadow-amber-900" : "bg-amber-500 shadow-amber-200"
                )}>
                  <Clock className="w-5 h-5 text-white" />
                </div>
                {batchesLoading ? (
                  <Skeleton className={cn("h-7 w-8 mx-auto mb-1", isDark && "bg-slate-600")} />
                ) : (
                  <p className={cn("text-xl font-bold", isDark ? "text-amber-400" : "text-amber-600")}>
                    <AnimatedCounter value={pendingCount} />
                  </p>
                )}
                <p className={cn("text-[10px] font-medium", isDark ? "text-amber-400/70" : "text-amber-600/70")}>
                  {t("portal.pending")}
                </p>
              </div>
            </Link>

            {/* Delivered */}
            <Link href="/portal/shipments?status=delivered">
              <div className={cn(
                "text-center p-3 rounded-xl transition-all duration-300 cursor-pointer hover:scale-105",
                isDark 
                  ? "bg-emerald-900/30 hover:bg-emerald-900/50" 
                  : "bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg",
                  isDark ? "bg-emerald-600 shadow-emerald-900" : "bg-emerald-500 shadow-emerald-200"
                )}>
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                {batchesLoading ? (
                  <Skeleton className={cn("h-7 w-8 mx-auto mb-1", isDark && "bg-slate-600")} />
                ) : (
                  <p className={cn("text-xl font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>
                    <AnimatedCounter value={deliveredCount} />
                  </p>
                )}
                <p className={cn("text-[10px] font-medium", isDark ? "text-emerald-400/70" : "text-emerald-600/70")}>
                  {t("portal.delivered")}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Orders — orders not yet delivered, no invoice yet */}
      {pendingOrders && pendingOrders.count > 0 && (
        <div className="px-4 mt-6">
          <Link href="/portal/full-package">
            <div className={cn(
              "relative overflow-hidden rounded-2xl p-5 shadow-lg cursor-pointer hover:scale-[1.01] transition-all",
              isDark
                ? "bg-gradient-to-br from-amber-900/60 to-orange-900/60 border border-amber-700/50"
                : "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200"
            )}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "p-2 rounded-xl",
                      isDark ? "bg-amber-600/30" : "bg-amber-500/20"
                    )}>
                      <Clock className={cn("w-5 h-5", isDark ? "text-amber-300" : "text-amber-700")} />
                    </div>
                    <div>
                      <h3 className={cn("font-bold text-base", isDark ? "text-amber-100" : "text-amber-900")}>
                        {t("portal.pendingOrdersTitle")}
                      </h3>
                      <p className={cn("text-xs", isDark ? "text-amber-300/80" : "text-amber-700")}>
                        {t("portal.pendingOrdersSubtitle")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="text-center">
                      <p className={cn("text-[11px] font-medium leading-tight min-h-[28px] flex items-center justify-center", isDark ? "text-amber-300/80" : "text-amber-700")}>
                        📦 {pickLang(language, { ku: "پاکێجی تەواو", en: "Full package", ar: "حزمة كاملة", zh: "完整套餐" })}
                      </p>
                      <p className={cn("text-xl font-bold", isDark ? "text-amber-100" : "text-amber-900")}>
                        <AnimatedCounter value={pendingOrders.byType.full_package} />
                      </p>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[11px] font-medium leading-tight min-h-[28px] flex items-center justify-center", isDark ? "text-amber-300/80" : "text-amber-700")}>
                        🛍️ {pickLang(language, { ku: "کڕین بە تێچوو", en: "Markup purchase", ar: "شراء بهامش", zh: "加价采购" })}
                      </p>
                      <p className={cn("text-xl font-bold", isDark ? "text-amber-100" : "text-amber-900")}>
                        <AnimatedCounter value={pendingOrders.byType.commission} />
                      </p>
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[11px] font-medium leading-tight min-h-[28px] flex items-center justify-center", isDark ? "text-amber-300/80" : "text-amber-700")}>
                        📝 {pickLang(language, { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" })}
                      </p>
                      <p className={cn("text-xl font-bold", isDark ? "text-amber-100" : "text-amber-900")}>
                        <AnimatedCounter value={pendingOrders.byType.purchase_request} />
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-end">
                  <p className={cn("text-xs font-medium mb-1", isDark ? "text-amber-300/80" : "text-amber-700")}>
                    {t("portal.estimatedTotal")}
                  </p>
                  <p className={cn("text-2xl font-bold font-mono", isDark ? "text-amber-100" : "text-amber-900")}>
                    ${pendingOrders.totalPriceUsd.toFixed(2)}
                  </p>
                  <div className={cn(
                    "mt-2 px-2 py-0.5 rounded-full text-xs font-semibold inline-block",
                    isDark ? "bg-amber-600/30 text-amber-200" : "bg-amber-200 text-amber-900"
                  )}>
                    {pendingOrders.count} {t("portal.orders")}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Recent Shipments */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
            {t("portal.recentShipments") || "گواستنەوە نوێیەکان"}
          </h2>
          <Link href="/portal/shipments">
            <button className="text-sm text-blue-500 font-medium flex items-center gap-1 hover:text-blue-600 transition-colors">
              {t("portal.viewAll") || "هەموو ببینە"}
              <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </button>
          </Link>
        </div>

        {batchesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className={cn("h-24 w-full rounded-2xl", isDark && "bg-slate-800")} />
            ))}
          </div>
        ) : recentBatches.length === 0 ? (
          <div className={cn(
            "rounded-2xl p-10 text-center shadow-sm transition-colors duration-300",
            isDark ? "bg-slate-800" : "bg-white"
          )}>
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
              isDark ? "bg-slate-700" : "bg-slate-100"
            )}>
              <Package className={cn("w-8 h-8", isDark ? "text-slate-500" : "text-slate-400")} />
            </div>
            <p className={cn("font-medium", isDark ? "text-slate-300" : "text-slate-500")}>
              {t("portal.noShipments") || "هیچ گواستنەوەیەک نییە"}
            </p>
            <p className={cn("text-sm mt-1", isDark ? "text-slate-500" : "text-slate-400")}>
              {t("portal.shipmentsWillAppear") || "گواستنەوەکانت لێرە دەردەکەون"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentBatches.map((batch) => (
              <Link key={batch.id} href={`/portal/shipments/${batch.id}`}>
                <div className={cn(
                  "rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border",
                  isDark 
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-750" 
                    : "bg-white border-slate-100"
                )}>
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      batch.shippingType?.includes("sea") 
                        ? (isDark ? "bg-cyan-900/50 text-cyan-400" : "bg-cyan-100 text-cyan-600")
                        : (isDark ? "bg-blue-900/50 text-blue-400" : "bg-blue-100 text-blue-600")
                    )}>
                      {getShippingIcon(batch.shippingType || "")}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn("font-bold", isDark ? "text-white" : "text-slate-800")}>
                          {batch.batchCode}
                        </p>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1",
                          getStatusColor(batch.status)
                        )}>
                          {getStatusIcon(batch.status)}
                          {getStatusText(batch.status)}
                        </span>
                      </div>
                      <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                        {batch.customerPackageCount} {t("packages") || "packages"}
                      </p>
                    </div>
                    
                    {/* Arrow */}
                    <ChevronRight className={cn(
                      "w-5 h-5 shrink-0",
                      isDark ? "text-slate-500" : "text-slate-400",
                      isRTL && "rotate-180"
                    )} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Announcements Section */}
      <AnnouncementsSection isDark={isDark} language={language} t={t} />
    </CustomerPortalLayout>
  );
}
