import { useLanguage } from "@/contexts/LanguageContext";
import { TERMS_WHATSAPP_NUMBER } from "@/constants/portalTerms";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Bell,
  ChevronRight,
  LogOut,
  MessageSquare,
  Headphones,
  HelpCircle,
  FileText,
  Banknote,
  Ban,
  BookOpen,
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getLoginUrl } from "@/const";

const APP_VERSION = "1.0.0";

const cardBase =
  "rounded-xl border-2 border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.1)]";
const cardBaseDark =
  "rounded-xl border-2 border-white/10 shadow-[4px_4px_0px_rgba(255,255,255,0.05)]";

const spring = { type: "spring" as const, stiffness: 300, damping: 24 };

export default function Skin3PortalProfile() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  const { data: account, isLoading: accountLoading } =
    trpc.customerPortal.getMyAccount.useQuery();
  const { data: _balance, isLoading: _balanceLoading } =
    trpc.customerPortal.getMyBalance.useQuery();

  const handleLogout = async () => {
    await logout();
    window.location.href = getLoginUrl();
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <ModernPortalLayout>
        <div
          className={cn(
            "min-h-screen flex items-center justify-center",
            isDark ? "bg-zinc-950" : "bg-amber-50/50"
          )}
        >
          <div className="text-center px-6">
            <div
              className={cn(
                "w-24 h-24 rounded-full mx-auto mb-5 flex items-center justify-center border-4",
                isDark
                  ? "bg-zinc-900 border-zinc-700"
                  : "bg-white border-zinc-200 shadow-[4px_4px_0px_rgba(0,0,0,0.1)]"
              )}
            >
              <User
                className={cn(
                  "w-12 h-12",
                  isDark ? "text-zinc-600" : "text-zinc-300"
                )}
              />
            </div>
            <h2
              className={cn(
                "text-xl font-black mb-2",
                isDark ? "text-white" : "text-zinc-900"
              )}
            >
              {language === "ku" ? "چوونەژوورەوە پێویستە" : "Login Required"}
            </h2>
            <Link href={getLoginUrl()}>
              <button
                className={cn(
                  "mt-4 px-8 py-3 rounded-full font-black text-sm border-2 transition-all",
                  isDark
                    ? "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500 shadow-[3px_3px_0px_rgba(99,102,241,0.3)]"
                    : "bg-indigo-500 text-white border-indigo-600 hover:bg-indigo-600 shadow-[4px_4px_0px_rgba(0,0,0,0.12)]"
                )}
              >
                {t("auth.login")}
              </button>
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
      label: language === "ku" ? "شار" : "City",
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
      label:
        language === "ku"
          ? "ناونیشانەکان"
          : language === "ar"
          ? "العناوين"
          : language === "zh"
          ? "地址"
          : "Addresses",
      href: "/portal/addresses",
    },
    {
      icon: Bell,
      label:
        language === "ku"
          ? "ئاگادارییەکان"
          : language === "ar"
          ? "الإشعارات"
          : language === "zh"
          ? "通知"
          : "Notifications",
      href: "/portal/notifications",
    },
    {
      icon: MessageSquare,
      label:
        language === "ku"
          ? "نامەکان"
          : language === "ar"
          ? "الرسائل"
          : language === "zh"
          ? "消息"
          : "Messages",
      href: "/portal/messages",
    },
    {
      icon: Banknote,
      label:
        language === "ku"
          ? "کڕینی یوانی چینی"
          : language === "ar"
          ? "شراء اليوان الصيني"
          : language === "zh"
          ? "购买人民币"
          : "Buy Chinese Yuan",
      href: "/portal/yuan-exchange",
    },
  ];

  const supportMenuItems = [
    {
      icon: BookOpen,
      label:
        language === "ku"
          ? "ڕێبەری پۆرتاڵ"
          : language === "ar"
          ? "دليل البوابة"
          : language === "zh"
          ? "门户指南"
          : "Portal guide",
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
      label:
        language === "ku"
          ? "شەرت و مەرج"
          : language === "ar"
          ? "الشروط والأحكام"
          : language === "zh"
          ? "条款和条件"
          : "Terms & Conditions",
      href: "/portal/terms",
    },
    {
      icon: Ban,
      label:
        language === "ku"
          ? "کاڵا قەدەغەکراوەکان"
          : language === "ar"
          ? "البضائع الممنوعة"
          : language === "zh"
          ? "禁运物品"
          : "Prohibited items",
      href: "/portal/prohibited-items",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: spring },
  };

  const renderMenuGroup = (
    title: string,
    items: typeof accountMenuItems,
    delayBase: number
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delayBase, ...spring }}
    >
      <h3
        className={cn(
          "text-xs font-black uppercase tracking-widest px-1 mb-2.5",
          isDark ? "text-zinc-500" : "text-zinc-400"
        )}
      >
        {title}
      </h3>
      <div
        className={cn(
          isDark ? cardBaseDark : cardBase,
          "overflow-hidden",
          isDark ? "bg-zinc-900" : "bg-white"
        )}
      >
        {items.map((item, i) => {
          const isLast = i === items.length - 1;

          const content = (
            <motion.div
              initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delayBase + 0.05 + i * 0.05, ...spring }}
              whileHover={{ x: isRTL ? -4 : 4 }}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors",
                isDark ? "hover:bg-zinc-800/80" : "hover:bg-amber-50/60",
                !isLast &&
                  (isDark ? "border-b border-zinc-800" : "border-b border-zinc-100")
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border-2",
                  isDark
                    ? "bg-indigo-500/10 border-indigo-500/30"
                    : "bg-indigo-50 border-indigo-200"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4.5 h-4.5",
                    isDark ? "text-indigo-400" : "text-indigo-600"
                  )}
                />
              </div>
              <span
                className={cn(
                  "flex-1 text-sm font-bold",
                  isDark ? "text-white" : "text-zinc-700"
                )}
              >
                {item.label}
              </span>
              <ChevronRight
                className={cn(
                  "w-4 h-4 shrink-0 transition-transform",
                  isDark ? "text-zinc-600" : "text-zinc-300",
                  isRTL && "rotate-180"
                )}
              />
            </motion.div>
          );

          if ("external" in item && item.external) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
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
    </motion.div>
  );

  return (
    <ModernPortalLayout>
      <div
        className={cn(
          "min-h-screen pb-24",
          isDark ? "bg-zinc-950" : "bg-amber-50/50",
          isRTL && "rtl"
        )}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
          {/* ── Avatar + Name ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="flex flex-col items-center pt-4 pb-2"
          >
            {/* Avatar with violet ring */}
            <div
              className={cn(
                "w-28 h-28 rounded-full flex items-center justify-center text-4xl font-black",
                "ring-[5px] ring-offset-4",
                isDark
                  ? "bg-indigo-950/60 text-indigo-400 ring-indigo-500/40 ring-offset-zinc-950"
                  : "bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-700 ring-indigo-400/50 ring-offset-amber-50/50"
              )}
            >
              {accountLoading ? (
                <Skeleton className="w-14 h-10 rounded" />
              ) : (
                getInitials(account?.fullName || user?.name)
              )}
            </div>

            {/* Name */}
            {accountLoading ? (
              <Skeleton className="h-8 w-44 mt-5 rounded-lg" />
            ) : (
              <h1
                className={cn(
                  "text-2xl font-black text-center mt-5",
                  isDark ? "text-white" : "text-zinc-900"
                )}
              >
                {account?.fullName || user?.name || t("portal.profile")}
              </h1>
            )}

            {/* Customer code pill */}
            {account?.customerCode && (
              <motion.span
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, ...spring }}
                className={cn(
                  "mt-2 px-4 py-1.5 rounded-full text-xs font-black tabular-nums tracking-wide border-2",
                  isDark
                    ? "bg-zinc-900 text-indigo-400 border-indigo-500/30"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-[2px_2px_0px_rgba(0,0,0,0.06)]"
                )}
              >
                {account.customerCode}
              </motion.span>
            )}
          </motion.div>

          {/* ── Info Cards ── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-3"
          >
            {accountLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-20 rounded-xl"
                  />
                ))
              : infoRows.map((row) => (
                  <motion.div
                    key={row.label}
                    variants={itemVariants}
                    className={cn(
                      isDark ? cardBaseDark : cardBase,
                      "p-3.5 transition-transform hover:-translate-y-0.5",
                      isDark ? "bg-zinc-900" : "bg-white"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center mb-2 border",
                        isDark
                          ? "bg-zinc-800 border-zinc-700"
                          : "bg-zinc-50 border-zinc-200"
                      )}
                    >
                      <row.icon
                        className={cn(
                          "w-4 h-4",
                          isDark ? "text-zinc-400" : "text-zinc-400"
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        isDark ? "text-zinc-600" : "text-zinc-400"
                      )}
                    >
                      {row.label}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-bold truncate mt-0.5",
                        isDark ? "text-white" : "text-zinc-800"
                      )}
                    >
                      {row.value}
                    </p>
                  </motion.div>
                ))}
          </motion.div>

          {/* ── Account Menu Group ── */}
          {renderMenuGroup(
            language === "ku"
              ? "هەژمار"
              : language === "ar"
              ? "الحساب"
              : language === "zh"
              ? "账户"
              : "Account",
            accountMenuItems,
            0.25
          )}

          {/* ── Support Menu Group ── */}
          {renderMenuGroup(t("portal.support"), supportMenuItems, 0.4)}

          {/* ── Logout Button ── */}
          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, ...spring }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-black text-sm border-2 transition-all",
              isDark
                ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 shadow-[4px_4px_0px_rgba(239,68,68,0.1)]"
                : "bg-red-50 text-red-600 border-red-300 hover:bg-red-100 shadow-[4px_4px_0px_rgba(0,0,0,0.08)]"
            )}
          >
            <LogOut className="w-5 h-5" />
            {t("portal.logout")}
          </motion.button>

          {/* App Version */}
          <p
            className={cn(
              "text-center text-[11px] font-bold pb-4",
              isDark ? "text-zinc-700" : "text-zinc-300"
            )}
          >
            Wazn Express v{APP_VERSION}
          </p>
        </div>
      </div>
    </ModernPortalLayout>
  );
}
