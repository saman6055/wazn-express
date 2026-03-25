import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import {
  Package,
  Bell,
  ChevronRight,
  Truck,
  CheckCircle,
  Clock,
  Search,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  MessageSquare,
  Headphones,
  Plane,
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Animated Counter Component
function AnimatedCounter({
  value,
  duration = 800,
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return (
    <>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </>
  );
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

  if (language === "ar") {
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء الخير";
  }

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

// Transaction icon/color helper
function getTransactionStyle(type: string) {
  if (type === "payment" || type === "credit") {
    return {
      icon: ArrowDownRight,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    };
  }
  return {
    icon: ArrowUpRight,
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
  };
}

export default function ModernPortalHome() {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  // Fetch data - keeping all original tRPC queries
  const { data: account, isLoading: profileLoading } =
    trpc.customerPortal.getMyAccount.useQuery();
  const { data: balance, isLoading: balanceLoading } =
    trpc.customerPortal.getMyBalance.useQuery();
  const { data: batches, isLoading: batchesLoading } =
    trpc.customerPortal.getMyBatches.useQuery();
  const { data: packages, isLoading: packagesLoading } =
    trpc.customerPortal.getMyPackages.useQuery();
  const { data: transactions, isLoading: transactionsLoading } =
    trpc.customerPortal.getMyTransactions.useQuery({ limit: 5 });
  const { data: notificationCount } =
    trpc.customerPortal.getNotificationCount.useQuery();

  // Calculate stats from packages
  const totalPackages = packages?.length || 0;
  const inTransit =
    packages?.filter((p: any) => p.status === "in_transit").length || 0;
  const arrived =
    packages?.filter(
      (p: any) => p.status === "arrived" || p.status === "customs"
    ).length || 0;
  const delivered =
    packages?.filter(
      (p: any) => p.status === "delivered" || p.status === "closed"
    ).length || 0;

  const greeting = getGreeting(language);
  const firstName =
    (account as any)?.fullNameKurdish?.split(" ")[0] ||
    account?.fullName?.split(" ")[0] ||
    (language === "ku" ? "کڕیار" : "Customer");

  const balanceValue =
    typeof balance === "number"
      ? balance
      : typeof balance === "string"
        ? parseFloat(balance)
        : 0;

  const statsCards = [
    {
      label: language === "ku" ? "کۆی بارەکان" : "Total",
      value: totalPackages,
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: language === "ku" ? "لەڕێگا" : "In Transit",
      value: inTransit,
      icon: Truck,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: language === "ku" ? "گەیشتوو" : "Arrived",
      value: arrived,
      icon: Plane,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/40",
    },
    {
      label: language === "ku" ? "گەیاندرا" : "Delivered",
      value: delivered,
      icon: CheckCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
  ];

  const quickActions = [
    {
      label: language === "ku" ? "شوێنکەوتن" : "Track",
      icon: Search,
      href: "/portal/search",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: language === "ku" ? "داواکاری" : "Full Pkg",
      icon: ShoppingBag,
      href: "/portal/full-package",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: language === "ku" ? "نامەکان" : "Messages",
      icon: MessageSquare,
      href: "/portal/messages",
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950/40",
    },
    {
      label: language === "ku" ? "پشتگیری" : "Support",
      icon: Headphones,
      href: "/portal/support",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  };

  return (
    <ModernPortalLayout>
      <motion.div
        className={cn("min-h-screen px-5 pt-12 pb-8", isRTL && "rtl")}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ===== Greeting + Notification Bell ===== */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-zinc-400" : "text-gray-500"
              )}
            >
              {greeting}
            </p>
            {profileLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <h1
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {language === "ku" ? `سڵاو، ${firstName}` : `Hi, ${firstName}`}
              </h1>
            )}
          </div>
          <Link href="/portal/notifications">
            <button
              className={cn(
                "relative w-11 h-11 rounded-2xl flex items-center justify-center transition-colors",
                isDark
                  ? "bg-zinc-800/80 hover:bg-zinc-700/80"
                  : "bg-white hover:bg-gray-100 shadow-sm"
              )}
            >
              <Bell
                className={cn(
                  "w-5 h-5",
                  isDark ? "text-zinc-300" : "text-gray-600"
                )}
              />
              {notificationCount && notificationCount > 0 ? (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : null}
            </button>
          </Link>
        </motion.div>

        {/* ===== Balance Card ===== */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 shadow-lg shadow-emerald-500/20">
            {/* Decorative circles */}
            <div className="absolute -top-10 -end-10 w-36 h-36 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -start-8 w-28 h-28 rounded-full bg-white/10" />

            <div className="relative">
              <p className="text-emerald-100 text-sm mb-1">
                {language === "ku"
                  ? "باڵانسی ئێستا"
                  : language === "ar"
                    ? "الرصيد الحالي"
                    : "Current Balance"}
              </p>
              {balanceLoading ? (
                <Skeleton className="h-10 w-36 bg-white/20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white font-mono tracking-tight">
                    $
                    <AnimatedCounter
                      value={Math.floor(Math.abs(balanceValue))}
                    />
                  </span>
                  <span className="text-xl text-white/80 font-mono">
                    .
                    {Math.abs(balanceValue % 1)
                      .toFixed(2)
                      .slice(2)}
                  </span>
                  {balanceValue < 0 && (
                    <span className="text-red-200 text-xs font-medium ms-2 px-2 py-0.5 rounded-full bg-red-500/30">
                      {language === "ku" ? "قەرز" : "Debt"}
                    </span>
                  )}
                </div>
              )}

              <Link href="/portal/financial">
                <button className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-700 font-semibold text-sm hover:bg-white/90 transition-colors shadow-sm">
                  <CreditCard className="w-4 h-4" />
                  {language === "ku"
                    ? "پارەدان"
                    : language === "ar"
                      ? "الدفع"
                      : "Pay Now"}
                </button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ===== Stats Row (horizontal scroll) ===== */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-5 px-5">
            {statsCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className={cn(
                    "flex-shrink-0 w-[130px] rounded-2xl p-4 shadow-sm",
                    isDark
                      ? "bg-zinc-900 border border-zinc-800"
                      : "bg-white border border-gray-100"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
                      stat.bg
                    )}
                  >
                    <Icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold font-mono",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    {packagesLoading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : (
                      <AnimatedCounter value={stat.value} />
                    )}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      isDark ? "text-zinc-500" : "text-gray-500"
                    )}
                  >
                    {stat.label}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ===== Quick Actions ===== */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2
            className={cn(
              "text-base font-bold mb-3",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            {language === "ku"
              ? "کردارە خێراکان"
              : language === "ar"
                ? "الإجراءات السريعة"
                : "Quick Actions"}
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
                        isDark
                          ? "bg-zinc-900 border border-zinc-800"
                          : "bg-white border border-gray-100"
                      )}
                    >
                      <Icon className={cn("w-6 h-6", action.color)} />
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-medium text-center leading-tight",
                        isDark ? "text-zinc-400" : "text-gray-600"
                      )}
                    >
                      {action.label}
                    </span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* ===== Recent Activity ===== */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <h2
              className={cn(
                "text-base font-bold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {language === "ku"
                ? "چالاکی دوایی"
                : language === "ar"
                  ? "النشاط الأخير"
                  : "Recent Activity"}
            </h2>
            <Link href="/portal/financial">
              <button
                className={cn(
                  "text-sm font-medium flex items-center gap-0.5",
                  "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {language === "ku" ? "هەموو" : "View All"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          <div
            className={cn(
              "rounded-2xl overflow-hidden shadow-sm",
              isDark
                ? "bg-zinc-900 border border-zinc-800"
                : "bg-white border border-gray-100"
            )}
          >
            {transactionsLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div
                className={cn(
                  "divide-y",
                  isDark ? "divide-zinc-800" : "divide-gray-50"
                )}
              >
                {transactions.map((tx: any, index: number) => {
                  const style = getTransactionStyle(tx.transactionType);
                  const TxIcon = style.icon;
                  const amount = Number(tx.amountUsd) || 0;

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          style.bg
                        )}
                      >
                        <TxIcon className={cn("w-5 h-5", style.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          {tx.description ||
                            tx.transactionType?.replace(/_/g, " ")}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            isDark ? "text-zinc-500" : "text-gray-400"
                          )}
                        >
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold font-mono whitespace-nowrap",
                          style.color
                        )}
                      >
                        {tx.transactionType === "payment" ||
                        tx.transactionType === "credit"
                          ? "+"
                          : "-"}
                        ${Math.abs(amount).toFixed(2)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Clock
                  className={cn(
                    "w-10 h-10 mx-auto mb-2",
                    isDark ? "text-zinc-700" : "text-gray-300"
                  )}
                />
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-zinc-500" : "text-gray-400"
                  )}
                >
                  {language === "ku"
                    ? "هیچ چالاکییەک نییە"
                    : "No recent activity"}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-4" />
      </motion.div>
    </ModernPortalLayout>
  );
}
