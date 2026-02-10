import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import { 
  Package, Bell, ChevronRight, Truck, CheckCircle, Clock, 
  AlertCircle, Plane, Ship, TrendingUp, Search,
  CreditCard, Wallet, DollarSign, ArrowUpRight, ArrowDownRight,
  Sparkles, ShoppingBag, MapPin, Calendar, Eye
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Animated Counter Component
function AnimatedCounter({ value, duration = 1000, prefix = "", suffix = "" }: { 
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
      setCount(Math.floor(progress * value));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);
  
  return <>{prefix}{count.toLocaleString()}{suffix}</>;
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

// Status Card Component
function StatusCard({ 
  icon: Icon, 
  label, 
  value, 
  gradient, 
  shadowColor,
  trend,
  trendValue,
  isDark 
}: { 
  icon: any; 
  label: string; 
  value: string | number;
  gradient: string;
  shadowColor: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  isDark: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-3xl p-4",
        isDark 
          ? "bg-slate-800/50 border border-slate-700/50" 
          : "bg-white border border-slate-200/50",
        "backdrop-blur-xl shadow-lg",
        shadowColor
      )}
    >
      {/* Gradient accent */}
      <div className={cn(
        "absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-20",
        `bg-gradient-to-br ${gradient}`
      )} />
      
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className={cn(
            "text-xs font-medium mb-1",
            isDark ? "text-slate-400" : "text-slate-500"
          )}>
            {label}
          </p>
          <p className={cn(
            "text-2xl font-bold",
            isDark ? "text-white" : "text-slate-900"
          )}>
            {value}
          </p>
          {trend && trendValue && (
            <div className={cn(
              "flex items-center gap-1 mt-1 text-xs font-medium",
              trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-slate-400"
            )}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : 
               trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : null}
              {trendValue}
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg",
          gradient,
          shadowColor
        )}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </motion.div>
  );
}

// Quick Action Button
function QuickAction({ 
  icon: Icon, 
  label, 
  href, 
  gradient,
  isDark 
}: { 
  icon: any; 
  label: string; 
  href: string;
  gradient: string;
  isDark: boolean;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300",
          isDark 
            ? "bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50" 
            : "bg-white hover:bg-slate-50 border border-slate-200/50",
          "backdrop-blur-xl"
        )}
      >
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg",
          gradient
        )}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <span className={cn(
          "text-xs font-medium text-center",
          isDark ? "text-slate-300" : "text-slate-600"
        )}>
          {label}
        </span>
      </motion.div>
    </Link>
  );
}

// Recent Activity Item
function ActivityItem({ 
  icon: Icon, 
  title, 
  subtitle, 
  time, 
  status,
  gradient,
  isDark 
}: { 
  icon: any; 
  title: string; 
  subtitle: string;
  time: string;
  status?: "success" | "pending" | "warning";
  gradient: string;
  isDark: boolean;
}) {
  const statusColors = {
    success: "bg-emerald-500",
    pending: "bg-amber-500",
    warning: "bg-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300",
        isDark 
          ? "bg-slate-800/30 hover:bg-slate-800/50" 
          : "bg-white/50 hover:bg-white",
        "backdrop-blur-xl"
      )}
    >
      <div className={cn(
        "relative w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
        gradient
      )}>
        <Icon className="w-6 h-6 text-white" />
        {status && (
          <div className={cn(
            "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2",
            isDark ? "border-slate-900" : "border-white",
            statusColors[status]
          )} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium truncate",
          isDark ? "text-white" : "text-slate-900"
        )}>
          {title}
        </p>
        <p className={cn(
          "text-sm truncate",
          isDark ? "text-slate-400" : "text-slate-500"
        )}>
          {subtitle}
        </p>
      </div>
      <span className={cn(
        "text-xs whitespace-nowrap",
        isDark ? "text-slate-500" : "text-slate-400"
      )}>
        {time}
      </span>
    </motion.div>
  );
}

export default function ModernPortalHome() {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";

  // Fetch data
  const { data: account, isLoading: profileLoading } = trpc.customerPortal.getMyAccount.useQuery();
  const { data: batches, isLoading: batchesLoading } = trpc.customerPortal.getMyBatches.useQuery();
  const { data: financialSummary, isLoading: statsLoading } = trpc.customerPortal.getMyFinancialSummary.useQuery();
  
  // Calculate stats from batches
  const stats = {
    totalPackages: batches?.reduce((sum, b) => sum + (b.customerPackageCount || 0), 0) || 0,
    inTransit: batches?.filter(b => b.status === "in_transit").length || 0,
    delivered: batches?.filter(b => b.status === "delivered" || b.status === "closed").length || 0,
    pending: batches?.filter(b => b.status === "preparing" || b.status === "customs").length || 0,
    balance: financialSummary?.balanceUsd?.toString() || "0",
  };

  const greeting = getGreeting(language);
  const firstName = (account as any)?.fullNameKurdish?.split(" ")[0] || 
                    account?.fullName?.split(" ")[0] || 
                    (language === "ku" ? "کڕیار" : "Customer");

  return (
    <ModernPortalLayout>
    <div className={cn("min-h-screen", isRTL && "rtl")}>
      {/* Header Section */}
      <div className={cn(
        "relative overflow-hidden",
        isDark 
          ? "bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950" 
          : "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700"
      )}>
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-40 -left-20 w-40 h-40 rounded-full bg-violet-400/20 blur-2xl" />
        </div>

        <div className="relative px-6 pt-12 pb-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                "bg-white/20 backdrop-blur-xl"
              )}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-sm">{greeting}</p>
                {profileLoading ? (
                  <Skeleton className="h-6 w-24 bg-white/20" />
                ) : (
                  <h1 className="text-white font-bold text-xl">{firstName}</h1>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/portal/search">
                <button className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                  <Search className="w-5 h-5 text-white" />
                </button>
              </Link>
              <Link href="/portal/notifications">
                <button className="relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    3
                  </span>
                </button>
              </Link>
            </div>
          </div>

          {/* Balance Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "relative overflow-hidden rounded-3xl p-6",
              "bg-white/10 backdrop-blur-2xl border border-white/20"
            )}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
            
            <div className="relative">
              <p className="text-white/70 text-sm mb-1">
                {language === "ku" ? "باڵانسی ئێستا" : "Current Balance"}
              </p>
              {statsLoading ? (
                <Skeleton className="h-10 w-32 bg-white/20" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">
                    ${Math.abs(parseFloat(stats?.balance || "0")).toFixed(2)}
                  </span>
                  {parseFloat(stats?.balance || "0") < 0 && (
                    <span className="text-red-400 text-sm font-medium">
                      ({language === "ku" ? "قەرز" : "Debt"})
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-4">
                <Link href="/portal/financial">
                  <button className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl",
                    "bg-white text-violet-600 font-medium text-sm",
                    "hover:bg-white/90 transition-colors"
                  )}>
                    <Eye className="w-4 h-4" />
                    {language === "ku" ? "بینینی وردەکاری" : "View Details"}
                  </button>
                </Link>
                <Link href="/portal/financial">
                  <button className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl",
                    "bg-white/20 text-white font-medium text-sm",
                    "hover:bg-white/30 transition-colors"
                  )}>
                    <CreditCard className="w-4 h-4" />
                    {language === "ku" ? "پارەدان" : "Pay Now"}
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className={cn(
        "px-4 -mt-4 relative z-10",
        isDark ? "bg-transparent" : "bg-transparent"
      )}>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatusCard
            icon={Package}
            label={language === "ku" ? "کۆی بارەکان" : "Total Packages"}
            value={stats?.totalPackages || 0}
            gradient="from-emerald-500 to-teal-600"
            shadowColor="shadow-emerald-500/20"
            isDark={isDark}
          />
          <StatusCard
            icon={Truck}
            label={language === "ku" ? "لە ڕێگادا" : "In Transit"}
            value={stats?.inTransit || 0}
            gradient="from-blue-500 to-cyan-600"
            shadowColor="shadow-blue-500/20"
            isDark={isDark}
          />
          <StatusCard
            icon={CheckCircle}
            label={language === "ku" ? "گەیشتوو" : "Delivered"}
            value={stats?.delivered || 0}
            gradient="from-violet-500 to-purple-600"
            shadowColor="shadow-violet-500/20"
            isDark={isDark}
          />
          <StatusCard
            icon={Clock}
            label={language === "ku" ? "چاوەڕوان" : "Pending"}
            value={stats?.pending || 0}
            gradient="from-amber-500 to-orange-600"
            shadowColor="shadow-amber-500/20"
            isDark={isDark}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className={cn(
            "text-lg font-bold mb-4",
            isDark ? "text-white" : "text-slate-900"
          )}>
            {language === "ku" ? "کردارە خێراکان" : "Quick Actions"}
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <QuickAction
              icon={Search}
              label={language === "ku" ? "گەڕان" : "Search"}
              href="/portal/search"
              gradient="from-violet-500 to-purple-600"
              isDark={isDark}
            />
            <QuickAction
              icon={ShoppingBag}
              label={language === "ku" ? "داواکاری" : "Request"}
              href="/portal/purchase-request"
              gradient="from-emerald-500 to-teal-600"
              isDark={isDark}
            />
            <QuickAction
              icon={MapPin}
              label={language === "ku" ? "ناونیشان" : "Address"}
              href="/portal/addresses"
              gradient="from-blue-500 to-cyan-600"
              isDark={isDark}
            />
            <QuickAction
              icon={Calendar}
              label={language === "ku" ? "مێژوو" : "History"}
              href="/portal/shipments"
              gradient="from-orange-500 to-amber-600"
              isDark={isDark}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-slate-900"
            )}>
              {language === "ku" ? "چالاکی دوایی" : "Recent Activity"}
            </h2>
            <Link href="/portal/shipments">
              <button className={cn(
                "text-sm font-medium flex items-center gap-1",
                isDark ? "text-violet-400" : "text-violet-600"
              )}>
                {language === "ku" ? "هەموو" : "View All"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          <div className={cn(
            "rounded-3xl overflow-hidden",
            isDark 
              ? "bg-slate-800/30 border border-slate-700/50" 
              : "bg-white border border-slate-200/50",
            "backdrop-blur-xl"
          )}>
            {batchesLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : batches && batches.length > 0 ? (
              <div className="divide-y divide-slate-700/30">
                {batches.slice(0, 4).map((batch: any) => (
                  <Link key={batch.id} href={`/portal/shipments/${batch.id}`}>
                    <ActivityItem
                      icon={batch.shippingType?.includes("sea") ? Ship : Plane}
                      title={batch.batchCode || `B-${batch.id}`}
                      subtitle={`${batch.customerPackageCount || 0} ${language === "ku" ? "بار" : "packages"}`}
                      time={new Date(batch.createdAt).toLocaleDateString()}
                      status={
                        batch.status === "delivered" || batch.status === "closed" ? "success" :
                        batch.status === "in_transit" ? "pending" : "warning"
                      }
                      gradient={
                        batch.shippingType?.includes("sea") 
                          ? "from-emerald-500 to-teal-600" 
                          : "from-blue-500 to-cyan-600"
                      }
                      isDark={isDark}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Package className={cn(
                  "w-12 h-12 mx-auto mb-3",
                  isDark ? "text-slate-600" : "text-slate-300"
                )} />
                <p className={cn(
                  "text-sm",
                  isDark ? "text-slate-500" : "text-slate-400"
                )}>
                  {language === "ku" ? "هیچ بارێک نییە" : "No packages yet"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-8" />
      </div>
    </div>
    </ModernPortalLayout>
  );
}
