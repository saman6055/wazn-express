import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import ModernPortalProfile from "./modern/ModernPortalProfile";
import Skin3PortalProfile from "./skin3/Skin3PortalProfile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  User, MessageSquare, Bell, MapPin, FileText, HelpCircle, 
  AlertTriangle, ChevronRight, LogOut, Settings, Shield, Phone, Mail,
  Package, CreditCard, Star, Moon, Sun, Headphones, MessageCircle,
  Globe, Languages, Info, Heart, Share2, ExternalLink, BookOpen
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useAuth } from "@/_core/hooks/useAuth";

function ClassicPortalProfile() {
const { t, language, setLanguage } = useLanguage();
  const company = useCompanyInfo();
  const isRTL = language === "ku" || language === "ar";
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  
  const { data: account, isLoading } = trpc.customerPortal.getMyAccount.useQuery();
  const { data: notificationCount } = trpc.customerPortal.getNotificationCount.useQuery();
  const { data: summary } = trpc.customerPortal.getMyFinancialSummary.useQuery();

  const menuItems = [
    {
      icon: MessageSquare,
      label: language === "ku" ? "ناوەندی پەیام" : "Message Center",
      path: "/portal/messages",
      badge: 2,
      iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    },
    {
      icon: Bell,
      label: language === "ku" ? "ئاگادارکردنەوەکان" : "Notifications",
      path: "/portal/notifications",
      badge: notificationCount || 0,
      iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
    },
    {
      icon: MapPin,
      label: language === "ku" ? "ناونیشانەکان" : "Addresses",
      path: "/portal/addresses",
      iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    },
    {
      icon: CreditCard,
      label: language === "ku" ? "کڕینی یوانی چینی" : language === "ar" ? "شراء اليوان الصيني" : language === "zh" ? "购买人民币" : "Buy Chinese Yuan",
      path: "/portal/yuan-exchange",
      iconBg: "bg-gradient-to-br from-red-400 to-orange-500",
    },
  ];

  const supportItems = [
    {
      icon: BookOpen,
      label: language === "ku" ? "ڕێبەری پۆرتاڵ" : language === "ar" ? "دليل البوابة" : language === "zh" ? "门户指南" : "Portal guide",
      description: language === "ku" ? "هەموو بەشەکان بە نموونەوە" : language === "ar" ? "كل الأقسام بأمثلة" : language === "zh" ? "所有版块及示例" : "Every section, with examples",
      path: "/portal/guide",
      iconBg: "bg-gradient-to-br from-indigo-400 to-fuchsia-500",
    },
    {
      icon: Headphones,
      label: language === "ku" ? "پشتگیری" : "Support",
      description: language === "ku" ? "پەیوەندیمان پێوە بکە" : "Contact us anytime",
      iconBg: "bg-gradient-to-br from-indigo-400 to-purple-500",
      action: () => window.open("https://wa.me/9647501234567", "_blank"),
    },
    {
      icon: HelpCircle,
      label: language === "ku" ? "پرسیارە باوەکان" : "FAQ",
      description: language === "ku" ? "وەڵامی پرسیارەکانت" : "Find answers",
      path: "/portal/faq",
      iconBg: "bg-gradient-to-br from-cyan-400 to-blue-500",
    },
    {
      icon: FileText,
      label: language === "ku" ? "مەرج و ڕێساکان" : "Terms & Conditions",
      description: language === "ku" ? "یاساکانی بەکارهێنان" : "Usage policies",
      path: "/portal/terms",
      iconBg: "bg-gradient-to-br from-purple-400 to-violet-500",
    },
    {
      icon: AlertTriangle,
      label: language === "ku" ? "کاڵا قەدەغەکراوەکان" : language === "ar" ? "البضائع الممنوعة" : language === "zh" ? "禁运物品" : "Prohibited items",
      description: language === "ku" ? "پێش ناردن بیزانە" : language === "ar" ? "اعرفها قبل الشحن" : language === "zh" ? "寄送前须知" : "Know before you ship",
      path: "/portal/prohibited-items",
      iconBg: "bg-gradient-to-br from-red-400 to-rose-500",
    },
    {
      icon: Info,
      label: language === "ku" ? "دەربارەی ئێمە" : "About Us",
      description: language === "ku" ? "زانیاری کۆمپانیا" : "Company info",
      path: "/portal/about",
      iconBg: "bg-gradient-to-br from-pink-400 to-rose-500",
    },
  ];

  const settingsItems = [
    {
      icon: theme === "dark" ? Sun : Moon,
      label: theme === "dark" 
        ? (language === "ku" ? "مۆدی ڕووناک" : "Light Mode") 
        : (language === "ku" ? "مۆدی تاریک" : "Dark Mode"),
      description: language === "ku" ? "گۆڕینی تەما" : "Toggle theme",
      iconBg: theme === "dark" 
        ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
        : "bg-gradient-to-br from-slate-600 to-slate-800",
      onClick: toggleTheme,
    },
    {
      icon: Languages,
      label: language === "ku" ? "زمان" : language === "ar" ? "اللغة" : language === "zh" ? "语言" : "Language",
      description: language === "ku" ? "کوردی" : language === "ar" ? "العربية" : language === "zh" ? "中文" : "English",
      iconBg: "bg-gradient-to-br from-green-400 to-emerald-500",
      onClick: () => {
        const langs: ("ku" | "en" | "ar" | "zh")[] = ["ku", "en", "ar", "zh"];
        const currentIndex = langs.indexOf(language as "ku" | "en" | "ar" | "zh");
        const nextIndex = (currentIndex + 1) % langs.length;
        setLanguage(langs[nextIndex]);
      },
    },
    {
      icon: Bell,
      label: language === "ku" ? "ئاگادارکردنەوەکان" : "Notifications",
      description: language === "ku" ? "ڕێکخستنی ئاگادارکردنەوە" : "Manage alerts",
      path: "/portal/notification-settings",
      iconBg: "bg-gradient-to-br from-red-400 to-rose-500",
    },
    {
      icon: Shield,
      label: language === "ku" ? "پاراستن" : "Security",
      description: language === "ku" ? "پاسۆرد و ئەمنیەت" : "Password & security",
      path: "/portal/security",
      iconBg: "bg-gradient-to-br from-cyan-400 to-blue-600",
    },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  return (
    <CustomerPortalLayout>
      {/* Premium Header with Profile */}
      <div className="relative overflow-hidden">
        <div className={cn(
          "absolute inset-0",
          isDark 
            ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" 
            : "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800"
        )} />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl" />
        </div>
        
        <div className="relative px-5 pt-14 pb-6">
          <h1 className="text-xl font-bold text-white mb-6">{language === "ku" ? "پرۆفایل" : "Profile"}</h1>
          
          {/* Profile Card */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg",
                "bg-gradient-to-br from-indigo-500 to-purple-600"
              )}>
                <User className="w-10 h-10 text-white" />
              </div>
              {/* VIP Badge */}
              {summary?.status === "active" && (
                <div className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <Star className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-32 bg-slate-700" />
                  <Skeleton className="h-5 w-24 bg-slate-700 mt-2" />
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white">{account?.fullName || "Customer"}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-full border border-amber-500/30">
                      {account?.customerCode}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Card - Floating */}
      <div className="px-4 -mt-3 relative z-10">
        <div className={cn(
          "rounded-2xl shadow-xl p-4",
          isDark ? "bg-slate-800 shadow-slate-900/50" : "bg-white shadow-slate-200/50"
        )}>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2",
                isDark ? "bg-blue-900/30" : "bg-blue-100"
              )}>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800")}>
                {summary?.totalPackages || 0}
              </p>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                {language === "ku" ? "پاکەت" : "Packages"}
              </p>
            </div>
            <div className={cn("text-center border-x", isDark ? "border-slate-700" : "border-slate-100")}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2",
                isDark ? "bg-emerald-900/30" : "bg-emerald-100"
              )}>
                <CreditCard className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-lg font-bold text-emerald-500">{formatCurrency(summary?.totalPaid || 0)}</p>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                {language === "ku" ? "پارەدان" : "Paid"}
              </p>
            </div>
            <div className="text-center">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2",
                (summary?.balanceUsd || 0) > 0 
                  ? isDark ? "bg-red-900/30" : "bg-red-100"
                  : isDark ? "bg-emerald-900/30" : "bg-emerald-100"
              )}>
                <CreditCard className={cn(
                  "w-5 h-5",
                  (summary?.balanceUsd || 0) > 0 ? "text-red-500" : "text-emerald-500"
                )} />
              </div>
              <p className={cn(
                "text-lg font-bold",
                (summary?.balanceUsd || 0) > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {formatCurrency(Math.abs(summary?.balanceUsd || 0))}
              </p>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                {language === "ku" ? "باڵانس" : "Balance"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      {account && (account.mobileNumber || account.email) && (
        <div className="px-4 mt-4">
          <div className={cn(
            "rounded-2xl p-4 space-y-3",
            isDark ? "bg-slate-800" : "bg-white shadow-sm"
          )}>
            {account.mobileNumber && (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isDark ? "bg-slate-700" : "bg-slate-100"
                )}>
                  <Phone className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-600")} />
                </div>
                <div>
                  <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
                    {language === "ku" ? "ژمارەی مۆبایل" : "Mobile"}
                  </p>
                  <p className={cn("font-medium", isDark ? "text-white" : "text-slate-800")}>
                    {account.mobileNumber}
                  </p>
                </div>
              </div>
            )}
            {account.email && (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isDark ? "bg-slate-700" : "bg-slate-100"
                )}>
                  <Mail className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-600")} />
                </div>
                <div>
                  <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
                    {language === "ku" ? "ئیمەیل" : "Email"}
                  </p>
                  <p className={cn("font-medium", isDark ? "text-white" : "text-slate-800")}>
                    {account.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="px-4 py-4">
        <p className={cn("text-sm font-medium mb-3 px-1", isDark ? "text-slate-400" : "text-slate-500")}>
          {language === "ku" ? "خزمەتگوزارییەکان" : "Services"}
        </p>
        <div className={cn(
          "rounded-2xl overflow-hidden",
          isDark ? "bg-slate-800" : "bg-white shadow-sm"
        )}>
          {menuItems.map((item, index) => (
            <Link key={item.path} href={item.path}>
              <div className={cn(
                "flex items-center justify-between p-4 transition-all duration-200",
                isDark ? "hover:bg-slate-700 active:bg-slate-600" : "hover:bg-slate-50 active:bg-slate-100",
                index !== 0 && (isDark ? "border-t border-slate-700" : "border-t border-slate-100")
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg",
                    item.iconBg
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={cn("font-medium", isDark ? "text-white" : "text-slate-800")}>
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge && item.badge > 0 && (
                    <span className="min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "w-5 h-5",
                    isDark ? "text-slate-600" : "text-slate-400",
                    isRTL && "rotate-180"
                  )} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Support Section */}
        <p className={cn("text-sm font-medium mb-3 px-1 mt-6", isDark ? "text-slate-400" : "text-slate-500")}>
          {language === "ku" ? "پشتگیری و یارمەتی" : "Help & Support"}
        </p>
        <div className={cn(
          "rounded-2xl overflow-hidden",
          isDark ? "bg-slate-800" : "bg-white shadow-sm"
        )}>
          {supportItems.map((item, index) => {
            const content = (
              <div className={cn(
                "flex items-center justify-between p-4 transition-all duration-200",
                isDark ? "hover:bg-slate-700 active:bg-slate-600" : "hover:bg-slate-50 active:bg-slate-100",
                index !== 0 && (isDark ? "border-t border-slate-700" : "border-t border-slate-100")
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg",
                    item.iconBg
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={cn("font-medium block", isDark ? "text-white" : "text-slate-800")}>
                      {item.label}
                    </span>
                    <span className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
                      {item.description}
                    </span>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5",
                  isDark ? "text-slate-600" : "text-slate-400",
                  isRTL && "rotate-180"
                )} />
              </div>
            );
            
            if (item.action) {
              return (
                <div key={item.label} onClick={item.action} className="cursor-pointer">
                  {content}
                </div>
              );
            }
            
            return (
              <Link key={item.path} href={item.path!}>
                {content}
              </Link>
            );
          })}
        </div>

        {/* Settings Section */}
        <p className={cn("text-sm font-medium mb-3 px-1 mt-6", isDark ? "text-slate-400" : "text-slate-500")}>
          {language === "ku" ? "ڕێکخستنەکان" : "Settings"}
        </p>
        <div className={cn(
          "rounded-2xl overflow-hidden",
          isDark ? "bg-slate-800" : "bg-white shadow-sm"
        )}>
          {settingsItems.map((item, index) => {
            const content = (
              <div className={cn(
                "flex items-center justify-between p-4 transition-all duration-200",
                isDark ? "hover:bg-slate-700 active:bg-slate-600" : "hover:bg-slate-50 active:bg-slate-100",
                index !== 0 && (isDark ? "border-t border-slate-700" : "border-t border-slate-100")
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg",
                    item.iconBg
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={cn("font-medium block", isDark ? "text-white" : "text-slate-800")}>
                      {item.label}
                    </span>
                    <span className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
                      {item.description}
                    </span>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5",
                  isDark ? "text-slate-600" : "text-slate-400",
                  isRTL && "rotate-180"
                )} />
              </div>
            );
            
            if (item.onClick) {
              return (
                <div key={item.label} onClick={item.onClick} className="cursor-pointer">
                  {content}
                </div>
              );
            }
            
            return (
              <Link key={item.path} href={item.path!}>
                {content}
              </Link>
            );
          })}
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={cn(
            "w-full mt-6 rounded-2xl p-4 flex items-center justify-center gap-3 font-semibold transition-all duration-200 active:scale-[0.98]",
            isDark 
              ? "bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800" 
              : "bg-white text-red-600 hover:bg-red-50 shadow-sm border border-red-100"
          )}
        >
          <LogOut className="w-5 h-5" />
          {language === "ku" ? "چوونەدەرەوە" : "Logout"}
        </button>

        {/* App Info */}
        <div className="mt-8 mb-24 text-center">
          <div className="flex items-center justify-center gap-4 mb-3">
            <a href="#" className={cn("text-xs flex items-center gap-1", isDark ? "text-slate-500 hover:text-slate-400" : "text-slate-400 hover:text-slate-600")}>
              <Heart className="w-3 h-3" />
              {language === "ku" ? "ڕەخنە و پێشنیار" : "Feedback"}
            </a>
            <span className={isDark ? "text-slate-700" : "text-slate-300"}>•</span>
            <a href="#" className={cn("text-xs flex items-center gap-1", isDark ? "text-slate-500 hover:text-slate-400" : "text-slate-400 hover:text-slate-600")}>
              <Share2 className="w-3 h-3" />
              {language === "ku" ? "هاوبەشکردن" : "Share App"}
            </a>
          </div>
          <p className={cn("text-xs", isDark ? "text-slate-600" : "text-slate-400")}>
            {company.name} v1.0.0
          </p>
        </div>
      </div>
    </CustomerPortalLayout>
  );
}

export default function PortalProfile() {
  const { portalTheme } = usePortalTheme();
  
  if (portalTheme === "skin3") return <Skin3PortalProfile />;
  if (portalTheme === "modern") return <ModernPortalProfile />;
  return <ClassicPortalProfile />;
}
