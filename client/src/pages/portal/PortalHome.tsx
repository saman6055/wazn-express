import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { lazy } from "react";
// Lazy: only the active skin's chunk is downloaded (global admin setting).
const ModernPortalHome = lazy(() => import("./modern/ModernPortalHome"));
const Skin3PortalHome = lazy(() => import("./skin3/Skin3PortalHome"));
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  Package, Bell, ChevronRight, Truck, CheckCircle, Clock,
  AlertCircle, Plane, Ship, Megaphone, TrendingUp, Search,
  CreditCard, MessageCircle, FileText, DollarSign,
  Sun, Moon, Sparkles, AlertTriangle, PackagePlus, Info, X,
  Scale, Ban, ShoppingBag, Wallet, User, BookOpen, GraduationCap, PhoneCall
} from "lucide-react";
import { pickLang } from "@/lib/lang";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useState, useEffect } from "react";
import { PriceListSection } from "@/components/portal/PriceListSection";
import { WaznNewsCarousel } from "@/components/portal/WaznNewsCarousel";
import { DeliveryRatingCard } from "@/components/portal/DeliveryRatingCard";
import { ReferralCard } from "@/components/portal/ReferralCard";
import { MyDeliveryBoxes } from "@/components/portal/MyDeliveryBoxes";
import { PortalHeaderControls, PortalClock, usePortalMode } from "@/components/portal/PortalHeaderControls";
import { headerGradient, isLightHeader, modeDef, tint, gradient } from "@/lib/portalModes";

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
function AnnouncementsSection({ isDark, language, t }: { isDark: boolean; language: string; t: (key: string, params?: Record<string, string | number>) => string }) {
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
            <p className="font-bold text-lg mb-2">{t("welcomeToWazn", { name: company?.name || "Wazn Express" })}</p>
            <p className="text-sm text-blue-100 leading-relaxed">
              {t("trackPackagesEasily") || "Track your packages easily through this portal. Get real-time updates on your shipments."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Featured posts → the Wazn News auto-rotating carousel (5 slides, 5s each).
  return <WaznNewsCarousel language={language} isDark={isDark} />;
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
  // Which quick-action's "what is this?" card is open (index), or null — the
  // info stays hidden until the tile's ⓘ is tapped, never auto-shown.
  const [openTileInfo, setOpenTileInfo] = useState<number | null>(null);
  // Colour mode drives the header wash and, in light mode, flips the header
  // text from white to slate so it stays readable on the pale gradient.
  const [portalMode] = usePortalMode();
  const lightHeader = isLightHeader(portalMode);
  // Brand colour for this mode. Semantic colours — red for debt, amber for a
  // warning — are left alone; they mean something and must not follow it.
  const pal = modeDef(portalMode).palette;
  // Every surface in this header was written for white-on-colour. In light
  // mode the text and the glass panels have to flip, or the header is a blank
  // pale rectangle.
  const headStrong = lightHeader ? "text-slate-900" : "text-white";
  const headSoft = lightHeader ? "text-slate-700" : "text-white/90";
  const headMuted = lightHeader ? "text-slate-600" : "text-white/70";
  const headGlass = lightHeader
    ? "bg-slate-900/[0.05] border-slate-900/10 hover:bg-slate-900/[0.09]"
    : "bg-white/10 border-white/20 hover:bg-white/15";
  /** The pale brand tint, for icons and small labels on the header. */
  const paleStyle = lightHeader ? undefined : { color: pal.pale };

  const { data: account, isLoading: accountLoading } = trpc.customerPortal.getMyAccount.useQuery();
  const { data: batches, isLoading: batchesLoading } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: notificationCount } = trpc.customerPortal.getNotificationCount.useQuery();
  const { data: financialSummary } = trpc.customerPortal.getMyFinancialSummary.useQuery();
  const { data: pendingOrders } = trpc.customerPortal.getMyPendingOrders.useQuery();
  const { data: declaredPackages } = trpc.customerPortal.getMyDeclaredPackages.useQuery();
  const { data: prohibitedPackages } = trpc.prohibited.getMine.useQuery();
  const prohibitedPending = (prohibitedPackages || []).filter((p: any) => p.status === "pending").length;

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

  // Bold ¥ glyph styled like a lucide icon (lucide has no CNY symbol).
  const YuanIcon = ({ className }: { className?: string }) => (
    <span className={cn("flex items-center justify-center text-xl font-black leading-none", className)}>¥</span>
  );

  // Quick Actions
  // One cohesive navy→blue palette for every tile so the grid reads as a set,
  // not a clashing rainbow. (#4988C4 → #1C4D8D from the portal palette.)
  // Order is deliberate — set by the owner. Every destination already exists;
  // these tiles are shortcuts, not new pages.
  const quickActions = [
    {
      icon: Scale,
      label: pickLang(language, { ku: "مەرج و ڕێسا", en: "Terms & rules", ar: "الشروط والأحكام", zh: "条款与规则" }),
      href: "/portal/terms",
      info: {
        title: pickLang(language, { ku: "مەرج و ڕێساکان", en: "Terms & rules", ar: "الشروط والأحكام", zh: "条款与规则" }),
        desc: pickLang(language, { ku: "مەرجەکانی گواستنەوە و بەرپرسیارێتی — پێش ناردن بیانخوێنەوە.", en: "Shipping terms and responsibilities — read them before sending.", ar: "شروط الشحن والمسؤوليات — اقرأها قبل الإرسال.", zh: "运输条款与责任 — 发货前请阅读。" }),
        example: pickLang(language, { ku: "نموونە: بەرپرسیارێتی لە کاتی زیانی کاڵا", en: "e.g. liability if an item is damaged", ar: "مثال: المسؤولية عند تلف البضاعة", zh: "例如：货物损坏时的责任" }),
      },
    },
    {
      icon: Ban,
      label: pickLang(language, { ku: "کاڵای قەدەغە", en: "Prohibited items", ar: "المواد الممنوعة", zh: "违禁物品" }),
      href: "/portal/prohibited-packages",
      info: {
        title: pickLang(language, { ku: "کاڵا قەدەغەکان", en: "Prohibited items", ar: "المواد الممنوعة", zh: "违禁物品" }),
        desc: pickLang(language, { ku: "ئەو کاڵایانەی ناگوازرێنەوە — پێش کڕین دڵنیابەرەوە.", en: "Items we can't ship — check before you buy.", ar: "المواد التي لا يمكن شحنها — تحقق قبل الشراء.", zh: "我们无法运输的物品 — 购买前请查看。" }),
        example: pickLang(language, { ku: "نموونە: باتری، شلە، ماددەی هەڵگیرسێنەر", en: "e.g. batteries, liquids, flammables", ar: "مثال: البطاريات، السوائل، المواد القابلة للاشتعال", zh: "例如：电池、液体、易燃品" }),
      },
    },
    {
      icon: ShoppingBag,
      label: t("portal.fullPack"),
      href: "/portal/full-package",
      info: {
        title: pickLang(language, { ku: "کاڵاکانم", en: "My items", ar: "بضائعي", zh: "我的商品" }),
        desc: pickLang(language, { ku: "ئەو کاڵایانەی بۆت کڕدراون یان داوات کردوون — دۆخیان ببینە.", en: "The items bought for you or requested — see their status.", ar: "البضائع المشتراة لك أو المطلوبة — شاهد حالتها.", zh: "为您购买或您请求的商品 — 查看状态。" }),
        example: pickLang(language, { ku: "نموونە: دۆخی ئۆردەرەکانت ببینە", en: "e.g. see the status of your orders", ar: "مثال: شاهد حالة طلباتك", zh: "例如：查看订单状态" }),
      },
    },
    {
      icon: Truck,
      label: t("portal.shipments"),
      href: "/portal/shipments",
      info: {
        title: pickLang(language, { ku: "گواستنەوە", en: "Transport", ar: "النقل", zh: "运输" }),
        desc: pickLang(language, { ku: "بارەکانت لە ڕێگادان — بزانە لە کوێن و کەی دەگەن.", en: "Your shipments on the way — where they are and when they arrive.", ar: "شحناتك في الطريق — أين هي ومتى تصل.", zh: "在途货物 — 位置与预计到达时间。" }),
        example: pickLang(language, { ku: "نموونە: بارەکە لە ڕێگای ئاسمانییە → بەرواری گەیشتن", en: "e.g. shipment is in the air → arrival date", ar: "مثال: الشحنة جوًا → تاريخ الوصول", zh: "例如：空运中 → 到达日期" }),
      },
    },
    {
      icon: Search,
      label: t("portal.track"),
      href: "/portal/search",
      info: {
        title: pickLang(language, { ku: "شوێنکەوتنی بار", en: "Track shipment", ar: "تتبع الشحنة", zh: "追踪货物" }),
        desc: pickLang(language, { ku: "دۆخی پاکێج یان بارەکەت بەدواداچوون بکە بە ژمارەی تراک.", en: "Follow your package/shipment status by its tracking number.", ar: "تابع حالة طردك/شحنتك برقم التتبع.", zh: "通过运单号跟踪您的包裹/货物状态。" }),
        example: pickLang(language, { ku: "نموونە: ژمارەی تراک بنووسە → دۆخ ببینە", en: "e.g. enter a tracking number → see its status", ar: "مثال: أدخل رقم التتبع → شاهد الحالة", zh: "例如：输入运单号 → 查看状态" }),
      },
    },
    {
      icon: AlertTriangle,
      label: language === "ku" ? "بێ خاوەن" : "Unclaimed",
      href: "/portal/no-mark",
      info: {
        title: pickLang(language, { ku: "پاکێجی بێ‌خاوەن", en: "Unclaimed packages", ar: "طرود بلا مالك", zh: "无主包裹" }),
        desc: pickLang(language, { ku: "پاکێجە گەیشتووەکان کە کۆدی تۆیان پێوە نییە — لێرە داوایان بکە.", en: "Arrived packages with no customer code — claim yours here.", ar: "طرود وصلت بدون كود العميل — طالب بها هنا.", zh: "已到达但没有客户代码的包裹——在此认领。" }),
        example: pickLang(language, { ku: "نموونە: پاکێجێک بێ کۆد گەیشتووە → داوای بکە", en: "e.g. a package arrived without a code → claim it", ar: "مثال: وصل طرد بلا كود → طالب به", zh: "例如：包裹无代码到达 → 认领" }),
      },
    },
    {
      icon: PackagePlus,
      label: pickLang(language, { ku: "تۆماری تراک", en: "Register tracking", ar: "تسجيل التتبع", zh: "登记运单" }),
      href: "/portal/declare",
      info: {
        title: pickLang(language, { ku: "تۆمارکردنی تراک", en: "Register tracking", ar: "تسجيل التتبع", zh: "登记运单" }),
        desc: pickLang(language, { ku: "ژمارەی تراکی کاڵاکەت لە چین پێش‌وەخت تۆمار بکە بۆ بەدواداچوونی خۆکار.", en: "Pre-register your item's China tracking number for automatic follow-up.", ar: "سجّل رقم تتبع بضاعتك من الصين مسبقًا للمتابعة التلقائية.", zh: "提前登记您在中国的运单号以便自动跟进。" }),
        example: pickLang(language, { ku: "نموونە: دوای کڕین، تراکەکە لێرە بنووسە", en: "e.g. after buying, enter the tracking here", ar: "مثال: بعد الشراء، أدخل التتبع هنا", zh: "例如：购买后在此输入运单号" }),
      },
    },
    {
      icon: Wallet,
      label: t("portal.financial"),
      href: "/portal/financial",
      info: {
        title: pickLang(language, { ku: "دارایی و پارەدان", en: "Finance & payment", ar: "المالية والدفع", zh: "财务与付款" }),
        desc: pickLang(language, { ku: "باڵانس و مامەڵەکانت ببینە و قەرزەکەت بدە.", en: "See your balance and transactions, and settle what you owe.", ar: "شاهد رصيدك ومعاملاتك وسدّد ما عليك.", zh: "查看余额和交易并结清欠款。" }),
        example: pickLang(language, { ku: "نموونە: قەرزەکەت ببینە → بە واتساپ پارە بدە", en: "e.g. see your balance → pay via WhatsApp", ar: "مثال: شاهد رصيدك → ادفع عبر واتساب", zh: "例如：查看余额 → 通过 WhatsApp 付款" }),
      },
    },
    {
      icon: FileText,
      label: t("portal.request"),
      href: "/portal/full-package",
      info: {
        title: pickLang(language, { ku: "داواکاری کڕین", en: "Purchase request", ar: "طلب شراء", zh: "采购请求" }),
        desc: pickLang(language, { ku: "داوای کڕینی کاڵا بکە (فوڵ-پاکێج/کۆمیشن) و ئێمە بۆت دەیکڕین.", en: "Ask us to buy an item for you (full-package / commission).", ar: "اطلب منا شراء منتج لك (باقة كاملة/عمولة).", zh: "让我们为您购买商品（全包/代购）。" }),
        example: pickLang(language, { ku: "نموونە: لینکی کاڵا بنێرە → بۆت دەکڕدرێت", en: "e.g. send a product link → we buy it for you", ar: "مثال: أرسل رابط المنتج → نشتريه لك", zh: "例如：发送商品链接 → 我们为您购买" }),
      },
    },
    {
      icon: YuanIcon,
      label: pickLang(language, { ku: "کڕینی یوان", en: "Buy Yuan", ar: "شراء اليوان", zh: "购买人民币" }),
      href: "/portal/yuan-exchange",
      info: {
        title: pickLang(language, { ku: "کڕینی یوان", en: "Buy Yuan", ar: "شراء اليوان", zh: "购买人民币" }),
        desc: pickLang(language, { ku: "یوان بکڕە بۆ کڕینەکانت لە چین بە نرخی ئەمڕۆ.", en: "Buy Yuan for your China purchases at today's rate.", ar: "اشترِ اليوان لمشترياتك من الصين بسعر اليوم.", zh: "以今日汇率购买人民币用于中国采购。" }),
        example: pickLang(language, { ku: "نموونە: $100 → یوان بەپێی نرخی ئەمڕۆ", en: "e.g. $100 → Yuan at today's rate", ar: "مثال: 100$ → يوان بسعر اليوم", zh: "例如：$100 → 按今日汇率兑换人民币" }),
      },
    },
    {
      icon: BookOpen,
      label: pickLang(language, { ku: "ڕێبەری پۆرتاڵ", en: "Portal guide", ar: "دليل البوابة", zh: "门户指南" }),
      href: "/portal/guide",
      info: {
        title: pickLang(language, { ku: "ڕێبەری پۆرتاڵ", en: "Portal guide", ar: "دليل البوابة", zh: "门户指南" }),
        desc: pickLang(language, { ku: "چۆنیەتی بەکارهێنانی پۆرتاڵ — هەنگاو بە هەنگاو.", en: "How to use the portal — step by step.", ar: "كيفية استخدام البوابة — خطوة بخطوة.", zh: "如何使用门户 — 分步说明。" }),
        example: pickLang(language, { ku: "نموونە: چۆن تراک تۆمار بکەم؟", en: "e.g. how do I register a tracking number?", ar: "مثال: كيف أسجّل رقم التتبع؟", zh: "例如：如何登记运单号？" }),
      },
    },
    {
      icon: GraduationCap,
      label: pickLang(language, { ku: "فێرکاری", en: "Tutorials", ar: "الشروحات", zh: "教程" }),
      href: "/portal/tutorials",
      info: {
        title: pickLang(language, { ku: "فێرکاری بە ڤیدیۆ", en: "Video tutorials", ar: "شروحات بالفيديو", zh: "视频教程" }),
        desc: pickLang(language, { ku: "ڤیدیۆی کورت کە پیشانت دەدەن چۆن لە تاوباو و پیندودو داوای کاڵا بکەیت و پۆرتاڵ بەکاربهێنیت.", en: "Short videos showing how to order from Taobao and Pinduoduo and use the portal.", ar: "فيديوهات قصيرة تشرح الطلب من تاوباو وبيندودو واستخدام البوابة.", zh: "简短视频，演示如何在淘宝和拼多多下单并使用门户。" }),
        example: pickLang(language, { ku: "نموونە: «چۆن لە تاوباو کاڵا داوا بکەیت» ببینە", en: "e.g. watch \"how to order from Taobao\"", ar: "مثال: شاهد «كيف تطلب من تاوباو»", zh: "例如：观看「如何在淘宝下单」" }),
      },
    },
    {
      icon: PhoneCall,
      label: pickLang(language, { ku: "پەیوەندی", en: "Contact", ar: "تواصل", zh: "联系我们" }),
      href: "/portal/contact",
      info: {
        title: pickLang(language, { ku: "پەیوەندی", en: "Contact us", ar: "تواصل معنا", zh: "联系我们" }),
        desc: pickLang(language, { ku: "ژمارە و ناونیشان و هەموو سەکۆکانی کۆمەڵایەتیمان لە یەک شوێن.", en: "Our numbers, address, and every social channel in one place.", ar: "أرقامنا وعنواننا وكل قنوات التواصل في مكان واحد.", zh: "我们的电话、地址和所有社交渠道，尽在一处。" }),
        example: pickLang(language, { ku: "نموونە: نەخشەی شوێنمان بکەرەوە", en: "e.g. open our location on the map", ar: "مثال: افتح موقعنا على الخريطة", zh: "例如：在地图上打开我们的位置" }),
      },
    },
    {
      icon: User,
      label: t("portal.me"),
      href: "/portal/profile",
      info: {
        title: pickLang(language, { ku: "پرۆفایلی من", en: "My profile", ar: "ملفي الشخصي", zh: "我的资料" }),
        desc: pickLang(language, { ku: "زانیاری خۆت، کۆدی کڕیار و ناونیشانەکانت ببینە و بگۆڕە.", en: "See and edit your details, customer code and addresses.", ar: "شاهد وعدّل بياناتك وكود العميل وعناوينك.", zh: "查看和修改您的资料、客户代码和地址。" }),
        example: pickLang(language, { ku: "نموونە: ژمارەی مۆبایل یان ناونیشان بگۆڕە", en: "e.g. change your mobile number or address", ar: "مثال: غيّر رقم جوالك أو عنوانك", zh: "例如：修改手机号或地址" }),
      },
    },
  ];

  return (
    <CustomerPortalLayout>
      {/* Premium Header with Gradient */}
      <div className="relative overflow-hidden">
        {/* The wash follows the colour mode the customer picked, so the choice
            is felt across the whole header rather than in small accents. */}
        <div
          className="absolute inset-0 transition-[background-image] duration-500"
          style={{ backgroundImage: headerGradient(portalMode) }}
        />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        {/* Aurora glow orbs. They were tuned to sit on a deep blue; on the pale
            light wash the same opacity reads as blue smudges, so they fade back
            to a hint of depth. */}
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full" style={{ background: `radial-gradient(circle, rgba(73,136,196,${lightHeader ? 0.18 : 0.55}) 0%, transparent 68%)` }} />
        <div className="absolute top-16 -left-20 w-60 h-60 rounded-full" style={{ background: `radial-gradient(circle, rgba(28,77,141,${lightHeader ? 0.14 : 0.5}) 0%, transparent 70%)` }} />
        <div className="absolute -bottom-10 right-0 w-56 h-56 rounded-full" style={{ background: `radial-gradient(circle, rgba(189,232,245,${lightHeader ? 0.5 : 0.3}) 0%, transparent 70%)` }} />
        
        <div className={cn("relative px-5 pt-14 pb-12", lightHeader ? "text-slate-900" : "text-white")}>
          {/* Colour modes, language, and the date — above the greeting so the
              controls read as chrome rather than as part of the account. */}
          <PortalHeaderControls onLight={lightHeader} className="mb-5" />

          {/* Top Row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              {/* Time-based greeting */}
              <div className="flex items-center gap-2 mb-2">
                <GreetingIcon />
                <p className={cn("text-sm font-medium", headMuted)}>
                  {getGreeting(language)}
                </p>
              </div>
              {accountLoading ? (
                <Skeleton className="h-8 w-40 bg-white/20" />
              ) : (
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <span className={lightHeader ? "text-slate-900" : "bg-clip-text text-transparent"} style={lightHeader ? undefined : { backgroundImage: gradient("to left", "#ffffff", pal.pale, pal.light) }}>
                    {account?.fullName || account?.customerCode}
                  </span>
                  <Sparkles className="w-5 h-5" style={paleStyle} />
                </h1>
              )}
            </div>
            
            {/* Notification Bell — rings (shake animation) while unread.
                Note: guard with a boolean comparison, not `count && ...` —
                React renders a literal "0" for the latter when count is 0. */}
            <Link href="/portal/notifications">
              <button className={cn(
                "relative p-3 backdrop-blur-sm rounded-2xl transition-all duration-300 group",
                (notificationCount ?? 0) > 0
                  ? "bg-red-500/25 hover:bg-red-500/35 ring-2 ring-red-400/60"
                  : headGlass
              )}>
                <Bell className={cn(
                  "w-5 h-5 group-hover:scale-110 transition-transform", headStrong,
                  (notificationCount ?? 0) > 0 && "animate-bell-ring"
                )} />
                {(notificationCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center text-white px-1 animate-pulse">
                    {notificationCount! > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>
            </Link>
          </div>

          {/* Customer Code Badge + clock, on one line so the header keeps its
              height instead of growing a third row. */}
          <div className="flex items-end justify-between gap-3">
            {account?.customerCode ? (
              <div className={cn(
                "inline-flex items-center gap-2 border px-4 py-2 rounded-full backdrop-blur-sm",
                lightHeader
                  ? "bg-slate-900/[0.06] border-slate-900/10"
                  : ""
              )} style={lightHeader ? undefined : { backgroundImage: gradient("to right", tint(pal.pale, 0.15), tint(pal.light, 0.2)), borderColor: tint(pal.pale, 0.3) }}>
                <Package className={cn("w-4 h-4", lightHeader && "text-slate-700")} style={paleStyle} />
                <span className={cn("text-sm font-semibold", lightHeader && "text-slate-800")} style={paleStyle}>
                  {account.customerCode}
                </span>
              </div>
            ) : <span />}

            <PortalClock onLight={lightHeader} />
          </div>

          {/* Quick Actions — bento glass tiles */}
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href}>
                <button className={cn("relative w-full h-full flex flex-col items-start gap-2.5 rounded-2xl p-3 border backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]", headGlass)}>
                  {/* ⓘ — reveals "what is this?" without navigating; hidden until tapped. */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="info"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenTileInfo(openTileInfo === index ? null : index); }}
                    className={cn("absolute top-2 end-2 transition-colors", lightHeader ? "text-slate-500 hover:text-slate-900" : "opacity-70 hover:opacity-100")} style={paleStyle}
                  >
                    <Info className="w-3.5 h-3.5" />
                  </span>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${pal.light}, ${pal.brand})`,
                      boxShadow: `0 8px 16px -6px ${tint(pal.brand, 0.5)}`,
                    }}
                  >
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className={cn("text-xs font-medium text-start leading-tight", headSoft)}>
                    {action.label}
                  </span>
                </button>
              </Link>
            ))}
          </div>

          {/* "What is this?" card — shown only after a tile's ⓘ is tapped. */}
          {openTileInfo !== null && (
            <div className={cn("mt-3 relative flex gap-3 rounded-2xl p-3.5 border backdrop-blur-sm", headGlass)}>
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                <Info className="w-5 h-5" style={{ color: pal.brand }} />
              </div>
              <div className="flex-1 min-w-0 pe-5">
                <h4 className={cn("text-sm font-bold", headStrong)}>{quickActions[openTileInfo].info.title}</h4>
                <p className={cn("text-xs mt-0.5 leading-relaxed", headSoft)}>{quickActions[openTileInfo].info.desc}</p>
                <span className={cn("inline-block mt-2 rounded-lg px-2.5 py-1 text-[11px] font-medium", lightHeader && "bg-slate-900/[0.07] text-slate-700")} style={lightHeader ? undefined : { backgroundColor: tint(pal.pale, 0.2), color: pal.pale }}>
                  {quickActions[openTileInfo].info.example}
                </span>
              </div>
              <button onClick={() => setOpenTileInfo(null)} aria-label="close"
                className={cn("absolute top-2 end-2 p-1 rounded-full transition-colors", lightHeader ? "text-slate-500 hover:bg-slate-900/10" : "text-white/60 hover:bg-white/10")}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Balance Card - Floating */}
      <div className="px-4 -mt-5 relative z-10">
        <Link href="/portal/financial">
          <div
            className={cn(
              "rounded-2xl p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer",
              // Debt keeps its amber warning colour in every mode.
              hasDebt && "bg-gradient-to-br from-[#d97706] to-[#b45309] shadow-[#b45309]/40",
            )}
            style={hasDebt ? undefined : {
              backgroundImage: `linear-gradient(135deg, ${pal.brand}, ${pal.light})`,
              boxShadow: `0 10px 20px -8px ${tint(pal.brand, 0.5)}`,
            }}
          >
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
              {/* Dollar sign flashes red when in debt, green when clear/credit. */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white shadow-md">
                <DollarSign className={cn(
                  "w-7 h-7 animate-pulse",
                  hasDebt ? "text-red-600" : "text-emerald-600",
                )} />
              </div>
            </div>
            {hasDebt && (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white/60 rounded-full w-3/4 animate-pulse" />
                  </div>
                  <span className="text-xs text-white/80 font-medium">
                    {t("portal.payNow")} →
                  </span>
                </div>
                {/* Direct WhatsApp line for paying: ask for account numbers /
                    confirm a transfer. Stops propagation so tapping it doesn't
                    follow the card's link to the financial page. */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const msg = pickLang(language, {
                      ku: `سڵاو، دەمەوێت باڵانسەکەم بدەم ($${Math.abs(balance).toFixed(2)}). تکایە شێوازەکانی پارەدانم بۆ بنێرن.`,
                      en: `Hello, I'd like to pay my balance ($${Math.abs(balance).toFixed(2)}). Please send me the payment options.`,
                      ar: `مرحبًا، أودّ دفع رصيدي ($${Math.abs(balance).toFixed(2)}). الرجاء إرسال طرق الدفع.`,
                      zh: `您好，我想支付我的余额（$${Math.abs(balance).toFixed(2)}）。请发送付款方式。`,
                    });
                    window.open(`https://wa.me/9647709183535?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.98] transition py-2 text-sm font-bold text-white"
                >
                  <MessageCircle className="w-4 h-4" />
                  {pickLang(language, { ku: "پەیوەندی بۆ پارەدان (واتساپ)", en: "Contact us to pay (WhatsApp)", ar: "تواصل معنا للدفع (واتساب)", zh: "联系我们付款（WhatsApp）" })}
                </button>
              </>
            )}
          </div>
        </Link>
      </div>

      {/* Prohibited packages — flashes while any item awaits the customer's decision */}
      {prohibitedPackages && prohibitedPackages.length > 0 && (
        <div className="px-4 mt-4">
          <Link href="/portal/prohibited-packages">
            <div className={cn(
              "rounded-2xl border p-4 cursor-pointer flex items-center gap-3 transition-all hover:scale-[1.01]",
              prohibitedPending > 0
                ? "wazn-prohibited-flash border-red-400"
                : isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
            )}>
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>
                  {pickLang(language, { ku: "کەل و پەلی قەدەغە", en: "Prohibited packages", ar: "طرود ممنوعة", zh: "违禁包裹" })}
                </p>
                <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                  {prohibitedPending > 0
                    ? pickLang(language, { ku: `${prohibitedPending} پاکێج پێویستی بە بڕیارتە`, en: `${prohibitedPending} need your decision`, ar: `${prohibitedPending} بحاجة لقرارك`, zh: `${prohibitedPending} 项需要您处理` })
                    : pickLang(language, { ku: "بینینی وردەکاری", en: "View details", ar: "عرض التفاصيل", zh: "查看详情" })}
                </p>
              </div>
              <ChevronRight className={cn("w-5 h-5 shrink-0", isDark ? "text-slate-500" : "text-slate-400", isRTL && "rotate-180")} />
            </div>
          </Link>
        </div>
      )}

      {/* Price List Section — admin-curated shipping rates & services */}
      <PriceListSection />

      {/* Stats Cards */}
      <div className="px-4 mt-6">
        {/* Section heading — accent bar */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-fuchsia-500" />
          <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
            {pickLang(language, { ku: "بارەکانم", en: "My shipments", ar: "شحناتي", zh: "我的货件" })}
          </h2>
        </div>
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

      {/* My declared packages — tracking numbers + photos the customer entered
          themselves, with live status. Prominent so they can watch their
          incoming purchases at a glance. */}
      {declaredPackages && declaredPackages.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className={cn("text-lg font-bold flex items-center gap-2", isDark ? "text-white" : "text-slate-800")}>
              <Package className="w-5 h-5 text-blue-500" />
              {pickLang(language, { ku: "بارە خۆدەرخستووەکانم", en: "My declared packages", ar: "طرودي المُعلنة", zh: "我申报的包裹" })}
            </h2>
            <Link href="/portal/declare">
              <button className="text-sm text-blue-500 font-medium flex items-center gap-1 hover:text-blue-600 transition-colors">
                {t("portal.viewAll") || "هەموو ببینە"}
                <ChevronRight className={cn("w-4 h-4", isRTL && "rotate-180")} />
              </button>
            </Link>
          </div>

          <div className="space-y-2.5">
            {declaredPackages.slice(0, 5).map((d: any) => {
              const img = Array.isArray(d.productImages) ? d.productImages[0] : undefined;
              const status = d.status as "pending" | "matched" | "received" | "cancelled";
              const statusMeta: Record<string, { label: { ku: string; en: string; ar: string; zh: string }; cls: string }> = {
                pending:  { label: { ku: "چاوەڕوانی گەیشتن", en: "Awaiting arrival", ar: "بانتظار الوصول", zh: "等待到达" }, cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
                matched:  { label: { ku: "دۆزرایەوە",        en: "Found",           ar: "تم العثور",     zh: "已匹配" }, cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
                received: { label: { ku: "گەیشت",           en: "Received",        ar: "تم الاستلام",   zh: "已收到" }, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
                cancelled:{ label: { ku: "هەڵوەشاوە",        en: "Cancelled",       ar: "ملغى",          zh: "已取消" }, cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
              };
              const sm = statusMeta[status] ?? statusMeta.pending;
              return (
                <Link key={d.id} href="/portal/declare">
                  <div className={cn(
                    "flex items-center gap-3 rounded-2xl p-3 shadow-sm cursor-pointer transition-all hover:scale-[1.01]",
                    isDark ? "bg-slate-800 hover:bg-slate-700/70" : "bg-white hover:bg-slate-50"
                  )}>
                    {/* Thumbnail */}
                    <div className={cn(
                      "w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center",
                      isDark ? "bg-slate-700" : "bg-slate-100"
                    )}>
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Package className={cn("w-6 h-6", isDark ? "text-slate-500" : "text-slate-400")} />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-mono text-sm font-bold truncate", isDark ? "text-white" : "text-slate-800")}>
                        {d.trackingNumber}
                      </p>
                      {d.productName && (
                        <p className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>{d.productName}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        {d.platform && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md", isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600")}>
                            {d.platform}
                          </span>
                        )}
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", sm.cls)}>
                          {pickLang(language, sm.label)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 flex-shrink-0", isDark ? "text-slate-600" : "text-slate-300", isRTL && "rotate-180")} />
                  </div>
                </Link>
              );
            })}
          </div>
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

      {/* The customer's own boxes. Sits above the referral card because a
          box waiting to be confirmed is the most actionable thing on the page.
          Renders nothing when there are none. */}
      <MyDeliveryBoxes className="mt-4" />

      {/* Invite a friend — customer's code doubles as a referral code */}
      <ReferralCard isDark={isDark} language={language} />

      {/* Announcements Section */}
      <AnnouncementsSection isDark={isDark} language={language} t={t} />

      {/* Rate your delivery — a gentle inline card at the very bottom, never a
          blocking popup. Shows for the latest delivered, unrated package. */}
      <DeliveryRatingCard isDark={isDark} language={language} />
    </CustomerPortalLayout>
  );
}
