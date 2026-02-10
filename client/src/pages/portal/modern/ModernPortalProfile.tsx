import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ModernPortalLayout } from "@/components/ModernPortalLayout";
import { 
  User, Mail, Phone, MapPin, Edit2, Camera, Shield, Bell, 
  Globe, ChevronRight, LogOut, Settings, Key, CreditCard,
  Package, History, Star, Award, CheckCircle
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getLoginUrl } from "@/const";

export default function ModernPortalProfile() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  
  const { data: account, isLoading } = trpc.customerPortal.getMyAccount.useQuery();
  // Stats will be calculated from account data

  const menuItems = [
    {
      icon: User,
      label: language === "ku" ? "زانیاری کەسی" : "Personal Info",
      href: "/portal/profile/edit",
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      icon: MapPin,
      label: language === "ku" ? "ناونیشانەکان" : "Addresses",
      href: "/portal/addresses",
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      icon: Bell,
      label: language === "ku" ? "ئاگادارکردنەوەکان" : "Notifications",
      href: "/portal/notifications",
      gradient: "from-amber-500 to-orange-600"
    },
    {
      icon: Shield,
      label: language === "ku" ? "پاراستن" : "Security",
      href: "/portal/security",
      gradient: "from-violet-500 to-purple-600"
    },
    {
      icon: Globe,
      label: language === "ku" ? "زمان" : "Language",
      href: "/portal/language",
      gradient: "from-pink-500 to-rose-600"
    },
  ];

  const statsItems = [
    {
      icon: Package,
      label: language === "ku" ? "کۆی بارەکان" : "Total Packages",
      value: 0,
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      icon: CheckCircle,
      label: language === "ku" ? "گەیشتووە" : "Delivered",
      value: 0,
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      icon: History,
      label: language === "ku" ? "مامەڵەکان" : "Transactions",
      value: 0,
      gradient: "from-violet-500 to-purple-600"
    },
  ];

  const handleLogout = async () => {
    await logout();
    window.location.href = getLoginUrl();
  };

  if (!user) {
    return (
      <ModernPortalLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-bold mb-2">
              {language === "ku" ? "چوونەژوورەوە پێویستە" : "Login Required"}
            </h2>
            <Link href={getLoginUrl()}>
              <button className="mt-4 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium">
                {language === "ku" ? "چوونەژوورەوە" : "Login"}
              </button>
            </Link>
          </div>
        </div>
      </ModernPortalLayout>
    );
  }

  return (
    <ModernPortalLayout>
      <div className={cn("min-h-screen pb-8", isRTL && "rtl")}>
        {/* Header */}
        <div className={cn(
          "relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" 
            : "bg-gradient-to-br from-slate-700 via-slate-600 to-slate-800"
        )}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute top-40 -left-20 w-40 h-40 rounded-full bg-emerald-400/10 blur-2xl" />
          </div>

          <div className="relative px-6 pt-12 pb-8">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              {/* Avatar */}
              <div className="relative mb-4">
                <div className={cn(
                  "w-24 h-24 rounded-full overflow-hidden",
                  "bg-gradient-to-br from-emerald-400 to-teal-500",
                  "flex items-center justify-center text-white text-3xl font-bold",
                  "ring-4 ring-white/20"
                )}>
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <button className={cn(
                  "absolute bottom-0 right-0 w-8 h-8 rounded-full",
                  "bg-white shadow-lg flex items-center justify-center",
                  "text-slate-600"
                )}>
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Name & Email */}
              <h1 className="text-white font-bold text-xl mb-1">
                {user?.name || (language === "ku" ? "کڕیار" : "Customer")}
              </h1>
              <p className="text-white/60 text-sm mb-2">
                {user?.email || ""}
              </p>

              {/* Customer ID Badge */}
              {account?.customerCode && (
                <div className={cn(
                  "px-4 py-1.5 rounded-full",
                  "bg-white/10 backdrop-blur-xl border border-white/20",
                  "text-white/80 text-sm"
                )}>
                  ID: {account.customerCode}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 -mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "grid grid-cols-3 gap-3 p-4 rounded-2xl",
              isDark 
                ? "bg-slate-800/50 border border-slate-700/50" 
                : "bg-white border border-slate-200/50",
              "backdrop-blur-xl shadow-lg"
            )}
          >
            {statsItems.map((stat, index) => (
              <div key={stat.label} className="text-center">
                <div className={cn(
                  "w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center bg-gradient-to-br",
                  stat.gradient
                )}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <p className={cn(
                  "text-lg font-bold",
                  isDark ? "text-white" : "text-slate-900"
                )}>
                  {stat.value}
                </p>
                <p className={cn(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-slate-500"
                )}>
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Menu Items */}
        <div className="px-6 py-6">
          <h3 className={cn(
            "font-bold text-lg mb-4",
            isDark ? "text-white" : "text-slate-900"
          )}>
            {language === "ku" ? "ڕێکخستنەکان" : "Settings"}
          </h3>

          <div className="space-y-3">
            {menuItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={item.href}>
                  <div className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer",
                    isDark 
                      ? "bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800/70" 
                      : "bg-white border border-slate-200/50 hover:shadow-md",
                    "backdrop-blur-xl"
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br",
                      item.gradient
                    )}>
                      <item.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={cn(
                      "flex-1 font-medium",
                      isDark ? "text-white" : "text-slate-900"
                    )}>
                      {item.label}
                    </span>
                    <ChevronRight className={cn(
                      "w-5 h-5",
                      isDark ? "text-slate-600" : "text-slate-300"
                    )} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Logout Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleLogout}
            className={cn(
              "w-full mt-6 flex items-center justify-center gap-3 p-4 rounded-2xl transition-all",
              "bg-red-500/10 border border-red-500/20 text-red-500",
              "hover:bg-red-500/20"
            )}
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">
              {language === "ku" ? "چوونەدەرەوە" : "Logout"}
            </span>
          </motion.button>
        </div>
      </div>
    </ModernPortalLayout>
  );
}
