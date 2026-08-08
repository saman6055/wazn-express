import { CustomerPortalLayout } from "@/components/CustomerPortalLayout";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { lazy, useState } from "react";
// Lazy: only the active skin's chunk is downloaded (global admin setting).
const ModernPortalProfile = lazy(() => import("./modern/ModernPortalProfile"));
const Skin3PortalProfile = lazy(() => import("./skin3/Skin3PortalProfile"));
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { 
  User, MessageSquare, Bell, MapPin, FileText, HelpCircle, 
  AlertTriangle, ChevronRight, LogOut, Settings, Shield, Phone, Mail,
  Package, CreditCard, Star, Moon, Sun, Headphones, MessageCircle, PhoneCall,
  Globe, Languages, Info, Heart, Share2, ExternalLink, BookOpen, Check
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useAuth } from "@/_core/hooks/useAuth";
import { pickLang } from "@/lib/lang";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { toast } from "sonner";

// Language options for the picker — each labelled in its own script (native) so
// a customer always recognises their language regardless of the current UI
// locale, plus a Latin `roman` subtitle for quick scanning. No flags: languages
// don't map cleanly to countries (Kurdish has no flag emoji; Arabic/English span
// many nations), and a wrong flag reads worse than none.
const LANG_OPTIONS: { code: "ku" | "en" | "ar" | "zh"; native: string; roman: string }[] = [
  { code: "ku", native: "کوردی", roman: "Kurdî" },
  { code: "en", native: "English", roman: "English" },
  { code: "ar", native: "العربية", roman: "Arabic" },
  { code: "zh", native: "中文", roman: "Chinese" },
];
const LANG_NATIVE_NAMES = Object.fromEntries(LANG_OPTIONS.map((l) => [l.code, l.native])) as Record<"ku" | "en" | "ar" | "zh", string>;

function ClassicPortalProfile() {
const { t, language, setLanguage } = useLanguage();
  const company = useCompanyInfo();
  const isRTL = language === "ku" || language === "ar";
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  
  const [showLangPicker, setShowLangPicker] = useState(false);

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
    {
      icon: PhoneCall,
      label: language === "ku" ? "پەیوەندی" : language === "ar" ? "تواصل" : language === "zh" ? "联系我们" : "Contact",
      path: "/portal/contact",
      iconBg: "bg-gradient-to-br from-emerald-400 to-green-600",
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
      // The company WhatsApp — was a placeholder number, so "Support" opened
      // a chat with nobody. Use the shared constant so it can never drift.
      action: () => window.open(`https://wa.me/${TERMS_WHATSAPP_NUMBER}`, "_blank", "noopener,noreferrer"),
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
      description: LANG_NATIVE_NAMES[language as keyof typeof LANG_NATIVE_NAMES] ?? "English",
      iconBg: "bg-gradient-to-br from-green-400 to-emerald-500",
      onClick: () => setShowLangPicker(true),
    },
    {
      icon: Bell,
      label: language === "ku" ? "ئاگادارکردنەوەکان" : "Notifications",
      description: language === "ku" ? "بینینی ئاگادارکردنەوەکان" : "View alerts",
      path: "/portal/notifications",
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

  // Feedback → WhatsApp with a pre-filled message that says who is writing.
  const handleFeedback = () => {
    const who = account?.fullName || account?.customerCode
      ? `${pickLang(language, { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" })}: ${account?.fullName ?? ""}${account?.customerCode ? ` (${account.customerCode})` : ""}`.trim()
      : null;
    const message = [
      pickLang(language, {
        ku: "سڵاو، ڕەخنە/پێشنیارێکم هەیە دەربارەی ئەپەکە",
        en: "Hello, I have some feedback about the app",
        ar: "مرحباً، لديّ ملاحظات حول التطبيق",
        zh: "您好，我对应用有一些反馈",
      }),
      who,
    ].filter(Boolean).join("\n");
    window.open(
      `https://wa.me/${TERMS_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // Share App → native share sheet where available, else copy the link.
  const handleShareApp = async () => {
    const url = window.location.origin;
    const shareData = {
      title: company.name,
      text: pickLang(language, {
        ku: `${company.name} — بارهێنانی ئاسان لە چینەوە`,
        en: `${company.name} — easy shipping from China`,
        ar: `${company.name} — شحن سهل من الصين`,
        zh: `${company.name} — 从中国轻松发货`,
      }),
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      throw new Error("no share");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return; // user cancelled
      try {
        await navigator.clipboard.writeText(url);
        toast.success(pickLang(language, {
          ku: "لینک کۆپی کرا",
          en: "Link copied",
          ar: "تم نسخ الرابط",
          zh: "链接已复制",
        }));
      } catch {
        toast.error(pickLang(language, {
          ku: "نەتوانرا هاوبەش بکرێت",
          en: "Couldn't share",
          ar: "تعذّرت المشاركة",
          zh: "无法分享",
        }));
      }
    }
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
                isDark ? "bg-blue-900/30" : "bg-blue-100 dark:bg-blue-950/40"
              )}>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                {summary?.totalPackages || 0}
              </p>
              <p className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>
                {language === "ku" ? "پاکەت" : "Packages"}
              </p>
            </div>
            <div className={cn("text-center border-x", isDark ? "border-slate-700" : "border-slate-100 dark:border-slate-800/60")}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2",
                isDark ? "bg-emerald-900/30" : "bg-emerald-100 dark:bg-emerald-950/40"
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
                  ? isDark ? "bg-red-900/30" : "bg-red-100 dark:bg-red-950/40"
                  : isDark ? "bg-emerald-900/30" : "bg-emerald-100 dark:bg-emerald-950/40"
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
                  isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40"
                )}>
                  <Phone className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-600")} />
                </div>
                <div>
                  <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
                    {language === "ku" ? "ژمارەی مۆبایل" : "Mobile"}
                  </p>
                  <p className={cn("font-medium", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                    {account.mobileNumber}
                  </p>
                </div>
              </div>
            )}
            {account.email && (
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isDark ? "bg-slate-700" : "bg-slate-100 dark:bg-slate-950/40"
                )}>
                  <Mail className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-600")} />
                </div>
                <div>
                  <p className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-500")}>
                    {language === "ku" ? "ئیمەیل" : "Email"}
                  </p>
                  <p className={cn("font-medium", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
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
                index !== 0 && (isDark ? "border-t border-slate-700" : "border-t border-slate-100 dark:border-slate-800/60")
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg",
                    item.iconBg
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className={cn("font-medium", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
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
                index !== 0 && (isDark ? "border-t border-slate-700" : "border-t border-slate-100 dark:border-slate-800/60")
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg",
                    item.iconBg
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={cn("font-medium block", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
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
                index !== 0 && (isDark ? "border-t border-slate-700" : "border-t border-slate-100 dark:border-slate-800/60")
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg",
                    item.iconBg
                  )}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className={cn("font-medium block", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
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
              : "bg-white text-red-600 hover:bg-red-50 shadow-sm border border-red-100 dark:border-red-800/60"
          )}
        >
          <LogOut className="w-5 h-5" />
          {language === "ku" ? "چوونەدەرەوە" : "Logout"}
        </button>

        {/* App Info */}
        <div className="mt-8 mb-24 text-center">
          <div className="flex items-center justify-center gap-4 mb-3">
            <button type="button" onClick={handleFeedback} className={cn("text-xs flex items-center gap-1 transition", isDark ? "text-slate-500 hover:text-slate-400" : "text-slate-400 hover:text-slate-600")}>
              <Heart className="w-3 h-3" />
              {pickLang(language, { ku: "ڕەخنە و پێشنیار", en: "Feedback", ar: "ملاحظات", zh: "反馈" })}
            </button>
            <span className={isDark ? "text-slate-700 dark:text-slate-300" : "text-slate-300"}>•</span>
            <button type="button" onClick={handleShareApp} className={cn("text-xs flex items-center gap-1 transition", isDark ? "text-slate-500 hover:text-slate-400" : "text-slate-400 hover:text-slate-600")}>
              <Share2 className="w-3 h-3" />
              {pickLang(language, { ku: "هاوبەشکردن", en: "Share App", ar: "مشاركة التطبيق", zh: "分享应用" })}
            </button>
          </div>
          <p className={cn("text-xs", isDark ? "text-slate-600" : "text-slate-400")}>
            {company.name} v1.0.0
          </p>
        </div>
      </div>

      {/* Language picker — pick a specific language, not a blind cycle. */}
      <Dialog open={showLangPicker} onOpenChange={setShowLangPicker}>
        <DialogContent className={cn(
          "max-w-xs rounded-3xl p-0 overflow-hidden",
          isDark ? "bg-slate-900 border-slate-800" : "bg-white"
        )}>
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle className={cn("text-center", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")}>
              {pickLang(language, { ku: "زمان هەڵبژێرە", en: "Choose language", ar: "اختر اللغة", zh: "选择语言" })}
            </DialogTitle>
          </DialogHeader>
          <div className="p-3 pt-0">
            {LANG_OPTIONS.map((opt) => {
              const active = language === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => { setLanguage(opt.code); setShowLangPicker(false); }}
                  dir={opt.code === "ku" || opt.code === "ar" ? "rtl" : "ltr"}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 my-1 transition-all",
                    active
                      ? "bg-gradient-to-br from-green-400/15 to-emerald-500/15 ring-1 ring-emerald-500/40"
                      : isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                  )}
                >
                  <span className="flex flex-col items-start">
                    <span className={cn("font-semibold", isDark ? "text-white" : "text-slate-800 dark:text-slate-200")}>
                      {opt.native}
                    </span>
                    <span className={cn("text-xs", isDark ? "text-slate-500" : "text-slate-400")}>
                      {opt.roman}
                    </span>
                  </span>
                  {active && (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </CustomerPortalLayout>
  );
}

export default function PortalProfile() {
  const { portalTheme } = usePortalTheme();
  
  if (portalTheme === "skin3") return <Skin3PortalProfile />;
  if (portalTheme === "modern") return <ModernPortalProfile />;
  return <ClassicPortalProfile />;
}
