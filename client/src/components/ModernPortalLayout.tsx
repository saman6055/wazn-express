import { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { Home, Package, Wallet, User, ShoppingBag, Search, Bell, Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { usePWA } from "@/components/PWAInstallPrompt";
import { LiveChatSupport, ChatFloatingButton } from "@/components/LiveChatSupport";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { motion, AnimatePresence } from "framer-motion";

interface ModernPortalLayoutProps {
  children: ReactNode;
}

export function ModernPortalLayout({ children }: ModernPortalLayoutProps) {
  useDynamicFavicon();
  const [location] = useLocation();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const { isInstalled } = usePWA();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const navItems = [
    { 
      icon: Home, 
      label: language === "ku" ? "سەرەکی" : "Home", 
      path: "/portal",
      gradient: "from-violet-500 to-purple-600",
      shadowColor: "shadow-violet-500/30",
    },
    { 
      icon: Package, 
      label: language === "ku" ? "بارەکان" : "Shipments", 
      path: "/portal/shipments",
      gradient: "from-emerald-500 to-teal-600",
      shadowColor: "shadow-emerald-500/30",
    },
    { 
      icon: ShoppingBag, 
      label: language === "ku" ? "کڕین" : "Orders", 
      path: "/portal/full-package",
      gradient: "from-orange-500 to-amber-600",
      shadowColor: "shadow-orange-500/30",
    },
    { 
      icon: Wallet, 
      label: language === "ku" ? "دارایی" : "Finance", 
      path: "/portal/financial",
      gradient: "from-blue-500 to-cyan-600",
      shadowColor: "shadow-blue-500/30",
    },
    { 
      icon: User, 
      label: language === "ku" ? "من" : "Profile", 
      path: "/portal/profile",
      gradient: "from-pink-500 to-rose-600",
      shadowColor: "shadow-pink-500/30",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/portal") return location === "/portal";
    return location.startsWith(path);
  };

  return (
    <div className={cn(
      "min-h-screen transition-all duration-500",
      isDark 
        ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" 
        : "bg-gradient-to-br from-slate-50 via-white to-slate-100",
      isRTL && "rtl",
      isInstalled ? "pb-28" : "pb-24"
    )}>
      {/* PWA Status Bar Spacer for iOS */}
      {isInstalled && (
        <div className={cn(
          "h-safe-area-top",
          isDark 
            ? "bg-gradient-to-r from-violet-950 via-slate-950 to-violet-950" 
            : "bg-gradient-to-r from-violet-100 via-white to-violet-100"
        )} />
      )}

      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={cn(
          "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20",
          isDark ? "bg-violet-600" : "bg-violet-400"
        )} />
        <div className={cn(
          "absolute top-1/2 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20",
          isDark ? "bg-blue-600" : "bg-blue-400"
        )} />
        <div className={cn(
          "absolute -bottom-40 right-1/3 w-80 h-80 rounded-full blur-3xl opacity-20",
          isDark ? "bg-emerald-600" : "bg-emerald-400"
        )} />
      </div>

      {/* Main Content */}
      <main className="relative max-w-lg mx-auto">
        {children}
      </main>

      {/* Modern Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-500",
        isInstalled && "pb-safe"
      )}>
        {/* Glass morphism background */}
        <div className={cn(
          "absolute inset-0",
          isDark 
            ? "bg-slate-900/80 backdrop-blur-2xl border-t border-slate-700/50" 
            : "bg-white/80 backdrop-blur-2xl border-t border-slate-200/50"
        )} />
        
        {/* Navigation content */}
        <div className="relative max-w-lg mx-auto px-2">
          <div className="flex items-center justify-around h-20">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} href={item.path}>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300",
                      active && "scale-105"
                    )}
                  >
                    {/* Active indicator background */}
                    <AnimatePresence>
                      {active && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={cn(
                            "absolute inset-0 rounded-2xl bg-gradient-to-br",
                            item.gradient,
                            "opacity-20"
                          )}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon container */}
                    <div className={cn(
                      "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                      active 
                        ? cn("bg-gradient-to-br shadow-lg", item.gradient, item.shadowColor)
                        : isDark 
                          ? "bg-slate-800/50" 
                          : "bg-slate-100"
                    )}>
                      <item.icon 
                        className={cn(
                          "w-5 h-5 transition-colors duration-300",
                          active 
                            ? "text-white" 
                            : isDark 
                              ? "text-slate-400" 
                              : "text-slate-500"
                        )} 
                        strokeWidth={active ? 2.5 : 2} 
                      />
                    </div>

                    {/* Label */}
                    <span className={cn(
                      "text-[10px] font-medium transition-all duration-300",
                      active 
                        ? isDark ? "text-white font-bold" : "text-slate-900 font-bold"
                        : isDark ? "text-slate-500" : "text-slate-400"
                    )}>
                      {item.label}
                    </span>

                    {/* Active dot indicator */}
                    {active && (
                      <motion.div
                        layoutId="activeIndicator"
                        className={cn(
                          "absolute -bottom-1 w-1 h-1 rounded-full bg-gradient-to-r",
                          item.gradient
                        )}
                      />
                    )}
                  </motion.button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Live Chat Support */}
      {!isChatOpen && (
        <ChatFloatingButton onClick={() => setIsChatOpen(true)} />
      )}
      <LiveChatSupport 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
}
