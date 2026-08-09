import { useLanguage } from "@/contexts/LanguageContext";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import {
  User, Mail, Phone, MapPin, Bell, ChevronRight, LogOut,
  MessageSquare, Headphones, HelpCircle, FileText, Banknote, Ban, BookOpen
} from "lucide-react";
import { pickLang } from "@/lib/lang";
import { PortalErrorState } from "@/components/portal/PortalErrorState";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getLoginUrl } from "@/const";

const APP_VERSION = "1.0.0";

export default function ModernPortalProfile() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  const accountQuery = trpc.customerPortal.getMyAccount.useQuery();
  const { data: account, isLoading: accountLoading } =
    accountQuery;
  const { data: balance, isLoading: balanceLoading } =
    trpc.customerPortal.getMyBalance.useQuery();

  const handleLogout = async () => {
    await logout();
    window.location.href = getLoginUrl();
  };

  const getInitials = (name?: string | null) => {
    // Trim first, then test. A name of "   " passed the !name guard, split to
    // a single empty part, and charAt(0) returned the space — an avatar
    // circle with nothing in it rather than the fallback letter.
    const trimmed = (name ?? "").trim();
    if (!trimmed) return "U";
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <ModernPortalLayout>
      {/* A failed request used to render the identity card blank. */}
      {accountQuery.isError && (
        <div className="px-4 pt-4">
          <PortalErrorState compact onRetry={() => void accountQuery.refetch()} isRetrying={accountQuery.isFetching} />
        </div>
      )}
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center px-6">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center",
              isDark ? "bg-slate-800" : "bg-slate-100 dark:bg-slate-950/40"
            )}>
              <User className={cn("w-10 h-10", isDark ? "text-slate-600" : "text-slate-300")} />
            </div>
            <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-slate-900 dark:text-slate-200")}>
              {pickLang(language, { ku: "چوونەژوورەوە پێویستە", en: "Login Required", ar: "تسجيل الدخول مطلوب", zh: "需要登录" })}
            </h2>
            <Link href={getLoginUrl()}>
              <span className="block mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors">
                {t("auth.login")}
              </span>
            </Link>
          </div>
        </div>
      </ModernPortalLayout>
    );
  }

  const infoRows = [
    {
      icon: Phone,
      label: t("portal.phone"),
      value: account?.mobileNumber || "-",
    },
    {
      icon: Mail,
      label: t("portal.email"),
      value: account?.email || user?.email || "-",
    },
    {
      icon: MapPin,
      label: pickLang(language, { ku: "شار", en: "City", ar: "المدينة", zh: "城市" }),
      value: account?.city || "-",
    },
    {
      icon: MapPin,
      label: t("portal.address"),
      value: account?.address || "-",
    },
  ];

  const accountMenuItems = [
    {
      icon: MapPin,
      label: language === "ku" ? "ناونیشانەکان" : language === "ar" ? "العناوين" : language === "zh" ? "地址" : "Addresses",
      href: "/portal/addresses",
    },
    {
      icon: Bell,
      label: language === "ku" ? "ئاگادارییەکان" : language === "ar" ? "الإشعارات" : language === "zh" ? "通知" : "Notifications",
      href: "/portal/notifications",
    },
    {
      icon: MessageSquare,
      label: language === "ku" ? "نامەکان" : language === "ar" ? "الرسائل" : language === "zh" ? "消息" : "Messages",
      href: "/portal/messages",
    },
    {
      icon: Banknote,
      label: language === "ku" ? "کڕینی یوانی چینی" : language === "ar" ? "شراء اليوان الصيني" : language === "zh" ? "购买人民币" : "Buy Chinese Yuan",
      href: "/portal/yuan-exchange",
    },
  ];

  const supportMenuItems = [
    {
      icon: BookOpen,
      label: language === "ku" ? "ڕێبەری پۆرتاڵ" : language === "ar" ? "دليل البوابة" : language === "zh" ? "门户指南" : "Portal guide",
      href: "/portal/guide",
    },
    {
      icon: Headphones,
      label: t("portal.support"),
      // The company WhatsApp — was a placeholder number, so "Support" opened
      // a chat with nobody. Use the shared constant so it can never drift.
      href: `https://wa.me/${TERMS_WHATSAPP_NUMBER}`,
      external: true,
    },
    {
      icon: HelpCircle,
      label: t("portal.faq"),
      href: "/portal/faq",
    },
    {
      icon: FileText,
      label: language === "ku" ? "شەرت و مەرج" : language === "ar" ? "الشروط والأحكام" : language === "zh" ? "条款和条件" : "Terms & Conditions",
      href: "/portal/terms",
    },
    {
      icon: Ban,
      label: language === "ku" ? "کاڵا قەدەغەکراوەکان" : language === "ar" ? "البضائع الممنوعة" : language === "zh" ? "禁运物品" : "Prohibited items",
      href: "/portal/prohibited-items",
    },
  ];

  const renderMenuGroup = (
    title: string,
    items: typeof accountMenuItems,
    delayBase: number
  ) => (
    <div className="space-y-1.5">
      <h3 className={cn("text-xs font-semibold uppercase tracking-wider px-1 mb-2", isDark ? "text-slate-500" : "text-slate-400")}>
        {title}
      </h3>
      <div
        className={cn(
          "rounded-2xl overflow-hidden shadow-sm border divide-y",
          isDark
            ? "bg-slate-800/50 border-slate-700/40 divide-slate-700/40"
            : "bg-white border-slate-100 dark:border-slate-800/60 divide-slate-50"
        )}
      >
        {items.map((item, i) => {
          const content = (
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 8 : -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delayBase + i * 0.05 }}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer",
                isDark ? "hover:bg-slate-700/40" : "hover:bg-slate-50"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  isDark ? "bg-emerald-500/10" : "bg-emerald-50 dark:bg-emerald-950/40"
                )}
              >
                <item.icon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span
                className={cn(
                  "flex-1 text-sm font-medium",
                  isDark ? "text-white" : "text-slate-700 dark:text-slate-300"
                )}
              >
                {item.label}
              </span>
              <ChevronRight
                className={cn(
                  "w-4 h-4 shrink-0",
                  isDark ? "text-slate-600" : "text-slate-300",
                  isRTL && "rotate-180"
                )}
              />
            </motion.div>
          );

          if ("external" in item && item.external) {
            return (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            );
          }

          return (
            <Link key={item.label} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <ModernPortalLayout>
      <div className={cn("min-h-screen pb-24", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

          {/* Avatar + Name Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center pt-4 pb-2"
          >
            {/* Avatar circle */}
            <div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4",
                "ring-4",
                isDark
                  ? "bg-emerald-600/20 text-emerald-400 ring-emerald-500/20"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-emerald-100"
              )}
            >
              {accountLoading ? (
                <Skeleton className="w-12 h-8 rounded" />
              ) : (
                getInitials(account?.fullName || user?.name)
              )}
            </div>

            {/* Name */}
            {accountLoading ? (
              <Skeleton className="h-7 w-40 mb-1" />
            ) : (
              <h1
                className={cn(
                  "text-xl font-bold text-center",
                  isDark ? "text-white" : "text-slate-900 dark:text-slate-200"
                )}
              >
                {account?.fullName || user?.name || t("portal.profile")}
              </h1>
            )}

            {/* Customer code */}
            {account?.customerCode && (
              <span
                className={cn(
                  "mt-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium",
                  isDark
                    ? "bg-slate-800 text-slate-400 border border-slate-700"
                    : "bg-slate-100 dark:bg-slate-950/40 text-slate-500"
                )}
              >
                {account.customerCode}
              </span>
            )}
          </motion.div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              "rounded-2xl shadow-sm border overflow-hidden",
              isDark
                ? "bg-slate-800/50 border-slate-700/40"
                : "bg-white border-slate-100 dark:border-slate-800/60"
            )}
          >
            {accountLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-16 mb-1.5" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn("divide-y", isDark ? "divide-slate-700/40" : "divide-slate-50")}>
                {infoRows.map((row, i) => (
                  <div key={row.label + i} className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        isDark ? "bg-slate-700/60" : "bg-slate-50 dark:bg-slate-950/40"
                      )}
                    >
                      <row.icon
                        className={cn(
                          "w-4 h-4",
                          isDark ? "text-slate-400" : "text-slate-400"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[11px]", isDark ? "text-slate-500" : "text-slate-400")}>
                        {row.label}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          isDark ? "text-white" : "text-slate-800 dark:text-slate-200"
                        )}
                      >
                        {row.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Account Menu Group */}
          {renderMenuGroup(
            language === "ku" ? "هەژمار" : language === "ar" ? "الحساب" : language === "zh" ? "账户" : "Account",
            accountMenuItems,
            0.25
          )}

          {/* Support Menu Group */}
          {renderMenuGroup(
            t("portal.support"),
            supportMenuItems,
            0.4
          )}

          {/* Logout Button */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-medium text-sm transition-colors border",
              "text-red-500 border-red-200 dark:border-red-800/60 hover:bg-red-50",
              "dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/10"
            )}
          >
            <LogOut className="w-4.5 h-4.5" />
            {t("portal.logout")}
          </motion.button>

          {/* App Version */}
          <p className={cn("text-center text-[11px] pb-4", isDark ? "text-slate-600" : "text-slate-300")}>
            Wazn Express v{APP_VERSION}
          </p>
        </div>
      </div>
    </ModernPortalLayout>
  );
}
