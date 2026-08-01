import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import Skin3PortalLayout from "@/components/Skin3PortalLayout";
import {
  Package,
  Bell,
  Truck,
  CheckCircle,
  Plane,
  Search,
  ShoppingBag,
  Headphones,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Clock,
  ChevronRight,
  PackagePlus,
  Wallet,
  GraduationCap,
  PhoneCall,
} from "lucide-react";
import { PortalHeaderControls } from "@/components/portal/PortalHeaderControls";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PriceListSection } from "@/components/portal/PriceListSection";
import { MyDeliveryBoxes } from "@/components/portal/MyDeliveryBoxes";

// Bold ¥ glyph styled like a lucide icon (lucide has no CNY symbol).
// Accepts (and ignores) strokeWidth so it can stand in for a lucide icon.
function YuanGlyphIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span className={cn("flex items-center justify-center text-xl font-black leading-none", className)}>¥</span>
  );
}

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

// Transaction style helper
function getTransactionStyle(type: string, isDark: boolean) {
  if (type === "payment" || type === "credit") {
    return {
      icon: ArrowDownRight,
      color: isDark ? "text-emerald-400" : "text-emerald-600",
      dotColor: isDark ? "bg-emerald-400" : "bg-emerald-500",
      lineColor: isDark ? "bg-emerald-800/40" : "bg-emerald-200",
    };
  }
  return {
    icon: ArrowUpRight,
    color: isDark ? "text-red-400" : "text-red-500",
    dotColor: isDark ? "bg-red-400" : "bg-red-500",
    lineColor: isDark ? "bg-red-800/40" : "bg-red-200",
  };
}

export default function Skin3PortalHome() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  // Fetch data - same tRPC queries as ModernPortalHome
  const { data: account, isLoading: profileLoading } =
    trpc.customerPortal.getMyAccount.useQuery();
  const { data: balance, isLoading: balanceLoading } =
    trpc.customerPortal.getMyBalance.useQuery();
  const { data: batches } =
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
      accent: isDark ? "border-indigo-500/50" : "border-indigo-400",
      iconBg: isDark ? "bg-indigo-950/60" : "bg-indigo-100",
      iconColor: isDark ? "text-indigo-400" : "text-indigo-600",
    },
    {
      label: language === "ku" ? "لەڕێگا" : "In Transit",
      value: inTransit,
      icon: Truck,
      accent: isDark ? "border-amber-500/50" : "border-amber-400",
      iconBg: isDark ? "bg-amber-950/60" : "bg-amber-100",
      iconColor: isDark ? "text-amber-400" : "text-amber-600",
    },
    {
      label: language === "ku" ? "گەیشتوو" : "Arrived",
      value: arrived,
      icon: Plane,
      accent: isDark ? "border-violet-500/50" : "border-violet-400",
      iconBg: isDark ? "bg-violet-950/60" : "bg-violet-100",
      iconColor: isDark ? "text-violet-400" : "text-violet-600",
    },
    {
      label: language === "ku" ? "گەیاندرا" : "Delivered",
      value: delivered,
      icon: CheckCircle,
      accent: isDark ? "border-emerald-500/50" : "border-emerald-400",
      iconBg: isDark ? "bg-emerald-950/60" : "bg-emerald-100",
      iconColor: isDark ? "text-emerald-400" : "text-emerald-600",
    },
  ];

  const quickActions = [
    {
      label: language === "ku" ? "شوێنکەوتن" : "Track",
      icon: Search,
      href: "/portal/search",
      bg: isDark ? "bg-indigo-600 hover:bg-indigo-500" : "bg-indigo-500 hover:bg-indigo-600",
    },
    {
      label: language === "ku" ? "داواکاری" : "Order",
      icon: ShoppingBag,
      href: "/portal/full-package",
      bg: isDark ? "bg-amber-500 hover:bg-amber-400" : "bg-amber-400 hover:bg-amber-500",
    },
    {
      label: language === "ku" ? "پشتگیری" : "Support",
      icon: Headphones,
      href: "/portal/messages",
      bg: isDark ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-500 hover:bg-emerald-600",
    },
    {
      label: language === "ku" ? "کڕینی یوان" : language === "ar" ? "شراء اليوان" : language === "zh" ? "买人民币" : "Buy Yuan",
      icon: YuanGlyphIcon,
      href: "/portal/yuan-exchange",
      bg: isDark ? "bg-red-600 hover:bg-red-500" : "bg-red-500 hover:bg-red-600",
    },
    // These sections existed only on the classic skin, so a customer here had
    // no way of knowing they were there at all.
    {
      label: language === "ku" ? "تۆماری تراک" : language === "ar" ? "تسجيل التتبع" : language === "zh" ? "登记运单" : "Declare",
      icon: PackagePlus,
      href: "/portal/declare",
      bg: isDark ? "bg-teal-600 hover:bg-teal-500" : "bg-teal-500 hover:bg-teal-600",
    },
    {
      label: language === "ku" ? "بارەکانم" : language === "ar" ? "شحناتي" : language === "zh" ? "我的货物" : "Shipments",
      icon: Truck,
      href: "/portal/shipments",
      bg: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600",
    },
    {
      label: language === "ku" ? "داراری" : language === "ar" ? "المالية" : language === "zh" ? "财务" : "Financial",
      icon: Wallet,
      href: "/portal/financial",
      bg: isDark ? "bg-lime-600 hover:bg-lime-500" : "bg-lime-500 hover:bg-lime-600",
    },
    {
      label: language === "ku" ? "فێرکاری" : language === "ar" ? "الشروحات" : language === "zh" ? "教程" : "Tutorials",
      icon: GraduationCap,
      href: "/portal/tutorials",
      bg: isDark ? "bg-violet-600 hover:bg-violet-500" : "bg-violet-500 hover:bg-violet-600",
    },
    {
      label: language === "ku" ? "پەیوەندی" : language === "ar" ? "تواصل" : language === "zh" ? "联系我们" : "Contact",
      icon: PhoneCall,
      href: "/portal/contact",
      bg: isDark ? "bg-green-600 hover:bg-green-500" : "bg-green-500 hover:bg-green-600",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <Skin3PortalLayout>
      <motion.div
        className={cn("min-h-screen px-5 pt-12 pb-8", isRTL && "rtl")}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Colour modes and language — the same strip on every skin, so a
            customer who switches skins does not lose the control. */}
        <PortalHeaderControls onLight={!isDark} showClock className="mb-4" />

        {/* ===== Greeting + Notification Bell ===== */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between mb-8"
        >
          <div>
            {profileLoading ? (
              <Skeleton className="h-10 w-48 mb-1" />
            ) : (
              <h1
                className={cn(
                  "text-3xl font-black tracking-tight leading-tight",
                  isDark ? "text-white" : "text-gray-950"
                )}
              >
                {language === "ku" ? "سڵاو" : "Hey"},{" "}
                <span className="text-indigo-500">{firstName}</span>{" "}
                <span className="inline-block animate-[wave_1.5s_ease-in-out_infinite]">
                  {"👋"}
                </span>
              </h1>
            )}
            <p
              className={cn(
                "text-sm font-medium mt-1",
                isDark ? "text-zinc-500" : "text-gray-500"
              )}
            >
              {language === "ku"
                ? "بەخێربێیتەوە بۆ پۆرتاڵی وەزن"
                : "Welcome back to Wazn Express"}
            </p>
          </div>
          <Link href="/portal/notifications">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className={cn(
                "relative w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-colors",
                isDark
                  ? "bg-zinc-900 border-zinc-700 hover:border-indigo-500"
                  : "bg-white border-black/10 hover:border-indigo-400 shadow-[3px_3px_0px_rgba(0,0,0,0.06)]"
              )}
            >
              <Bell
                className={cn(
                  "w-5 h-5",
                  isDark ? "text-zinc-300" : "text-gray-700"
                )}
                strokeWidth={2.5}
              />
              {notificationCount && notificationCount > 0 ? (
                <span className="absolute -top-1.5 -end-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-amber-50 dark:border-zinc-950">
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : null}
            </motion.button>
          </Link>
        </motion.div>

        {/* ===== Balance Pill ===== */}
        <motion.div variants={itemVariants} className="mb-8">
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border-2 p-5",
              isDark
                ? "bg-gradient-to-r from-indigo-950/80 to-violet-950/80 border-indigo-500/40"
                : "bg-gradient-to-r from-indigo-500 to-violet-500 border-indigo-600/20"
            )}
          >
            {/* Decorative geometric shapes */}
            <div className={cn(
              "absolute -top-6 -end-6 w-24 h-24 rounded-2xl rotate-12",
              isDark ? "bg-indigo-500/10" : "bg-white/10"
            )} />
            <div className={cn(
              "absolute -bottom-4 -start-4 w-16 h-16 rounded-full",
              isDark ? "bg-violet-500/10" : "bg-white/10"
            )} />

            <div className="relative">
              <p className={cn(
                "text-sm font-bold uppercase tracking-wider mb-2",
                isDark ? "text-indigo-300/70" : "text-white/70"
              )}>
                {language === "ku"
                  ? "باڵانسی ئێستا"
                  : language === "ar"
                    ? "الرصيد الحالي"
                    : "Current Balance"}
              </p>
              {balanceLoading ? (
                <Skeleton className="h-12 w-40 bg-white/20" />
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white tabular-nums tracking-tight">
                    $<AnimatedCounter value={Math.floor(Math.abs(balanceValue))} />
                  </span>
                  <span className="text-2xl font-bold text-white/60 tabular-nums">
                    .{Math.abs(balanceValue % 1).toFixed(2).slice(2)}
                  </span>
                  {balanceValue < 0 && (
                    <span className="ms-2 px-2 py-1 rounded-lg bg-red-500/30 text-red-200 text-xs font-black uppercase">
                      {language === "ku" ? "قەرز" : "Debt"}
                    </span>
                  )}
                </div>
              )}

              <Link href="/portal/financial">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all",
                    isDark
                      ? "bg-white text-indigo-700 hover:bg-indigo-50"
                      : "bg-white text-indigo-600 hover:bg-indigo-50 shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                  )}
                >
                  <CreditCard className="w-4 h-4" strokeWidth={2.5} />
                  {language === "ku"
                    ? "پارەدان"
                    : language === "ar"
                      ? "الدفع"
                      : "Pay Now"}
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ===== Price List Section — admin-curated ===== */}
        <motion.div variants={itemVariants} className="mb-8 -mx-4">        {/* The customer's own boxes, with the button to confirm receipt.
            It existed only on the classic skin, so a customer here had no way
            to confirm at all. Renders nothing when there are none. */}
        <MyDeliveryBoxes className="-mx-5 mb-6" />


          <PriceListSection />
        </motion.div>

        {/* ===== Stats 2x2 Grid ===== */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 gap-3">
            {statsCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 24,
                    delay: 0.15 + i * 0.07,
                  }}
                  className={cn(
                    "rounded-xl border-2 p-4 transition-all",
                    isDark
                      ? "bg-zinc-900 border-zinc-700/60"
                      : "bg-white border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.06)]"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                      stat.iconBg
                    )}
                  >
                    <Icon
                      className={cn("w-5 h-5", stat.iconColor)}
                      strokeWidth={2.5}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-3xl font-black tabular-nums",
                      isDark ? "text-white" : "text-gray-950"
                    )}
                  >
                    {packagesLoading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <AnimatedCounter value={stat.value} />
                    )}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-bold mt-1 uppercase tracking-wider",
                      isDark ? "text-zinc-500" : "text-gray-400"
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
        <motion.div variants={itemVariants} className="mb-8">
          <h2
            className={cn(
              "text-lg font-black mb-3 uppercase tracking-wide",
              isDark ? "text-white" : "text-gray-950"
            )}
          >
            {language === "ku"
              ? "کردارە خێراکان"
              : language === "ar"
                ? "الإجراءات السريعة"
                : "Quick Actions"}
          </h2>
          <div className="flex gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} className="flex-1">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ y: -2 }}
                    className={cn(
                      "w-full flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 text-white font-black text-sm transition-all",
                      action.bg,
                      isDark
                        ? "border-white/10"
                        : "border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.1)]"
                    )}
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                    {action.label}
                  </motion.button>
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* ===== Recent Transactions (Timeline Style) ===== */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <h2
              className={cn(
                "text-lg font-black uppercase tracking-wide",
                isDark ? "text-white" : "text-gray-950"
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
                  "text-sm font-bold flex items-center gap-0.5",
                  "text-indigo-500 hover:text-indigo-600"
                )}
              >
                {language === "ku" ? "هەموو" : "View All"}
                <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </Link>
          </div>

          {transactionsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="h-14 flex-1 rounded-xl" />
                </div>
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="relative">
              {/* Timeline vertical line */}
              <div
                className={cn(
                  "absolute top-2 bottom-2 w-0.5 rounded-full",
                  isRTL ? "end-[6px]" : "start-[6px]",
                  isDark ? "bg-zinc-800" : "bg-gray-200"
                )}
              />

              <div className="space-y-3">
                {transactions.map((tx: any, index: number) => {
                  const style = getTransactionStyle(tx.transactionType, isDark);
                  const TxIcon = style.icon;
                  const amount = Number(tx.amountUsd) || 0;
                  const isCredit =
                    tx.transactionType === "payment" ||
                    tx.transactionType === "credit";

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                        delay: index * 0.06,
                      }}
                      className="flex items-start gap-3"
                    >
                      {/* Timeline dot */}
                      <div className="relative z-10 mt-4 flex-shrink-0">
                        <div
                          className={cn(
                            "w-3.5 h-3.5 rounded-full border-2",
                            isDark ? "border-zinc-950" : "border-amber-50",
                            style.dotColor
                          )}
                        />
                      </div>

                      {/* Transaction card */}
                      <div
                        className={cn(
                          "flex-1 rounded-xl border-2 p-3 transition-all",
                          isDark
                            ? "bg-zinc-900 border-zinc-700/60"
                            : "bg-white border-black/10 shadow-[3px_3px_0px_rgba(0,0,0,0.04)]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <TxIcon
                              className={cn("w-4 h-4 flex-shrink-0", style.color)}
                              strokeWidth={2.5}
                            />
                            <p
                              className={cn(
                                "text-sm font-bold truncate",
                                isDark ? "text-white" : "text-gray-900"
                              )}
                            >
                              {tx.description ||
                                tx.transactionType?.replace(/_/g, " ")}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-black tabular-nums whitespace-nowrap ms-2",
                              style.color
                            )}
                          >
                            {isCredit ? "+" : "-"}${Math.abs(amount).toFixed(2)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-[11px] font-medium mt-1",
                            isDark ? "text-zinc-600" : "text-gray-400"
                          )}
                        >
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-xl border-2 p-10 text-center",
                isDark
                  ? "bg-zinc-900 border-zinc-700/60"
                  : "bg-white border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.06)]"
              )}
            >
              <Clock
                className={cn(
                  "w-12 h-12 mx-auto mb-3",
                  isDark ? "text-zinc-700" : "text-gray-300"
                )}
                strokeWidth={2}
              />
              <p
                className={cn(
                  "text-sm font-bold",
                  isDark ? "text-zinc-500" : "text-gray-400"
                )}
              >
                {language === "ku"
                  ? "هیچ چالاکییەک نییە"
                  : "No recent activity"}
              </p>
            </div>
          )}
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-4" />
      </motion.div>
    </Skin3PortalLayout>
  );
}
