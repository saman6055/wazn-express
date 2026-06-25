import { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { Home, Package, Wallet, User, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { usePWA } from "@/components/PWAInstallPrompt";
import { LiveChatSupport, ChatFloatingButton } from "@/components/LiveChatSupport";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { PortalTopBar } from "@/components/PortalTopBar";
import { motion } from "framer-motion";

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
      label: language === "ku" ? "سەرەکی" : language === "ar" ? "الرئيسية" : "Home",
      path: "/portal",
    },
    {
      icon: Package,
      label: language === "ku" ? "بارەکان" : language === "ar" ? "الشحنات" : "Shipments",
      path: "/portal/shipments",
    },
    {
      icon: ShoppingBag,
      label: language === "ku" ? "کڕین" : language === "ar" ? "الطلبات" : "Orders",
      path: "/portal/full-package",
    },
    {
      icon: Wallet,
      label: language === "ku" ? "دارایی" : language === "ar" ? "المالية" : "Finance",
      path: "/portal/financial",
    },
    {
      icon: User,
      label: language === "ku" ? "من" : language === "ar" ? "حسابي" : "Profile",
      path: "/portal/profile",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/portal") return location === "/portal";
    return location.startsWith(path);
  };

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-300",
        isDark ? "bg-zinc-950" : "bg-gray-50",
        isRTL && "rtl",
        isInstalled ? "pb-28" : "pb-24"
      )}
    >
      {/* PWA Status Bar Spacer for iOS */}
      {isInstalled && (
        <div
          className={cn(
            "h-safe-area-top",
            isDark ? "bg-zinc-950" : "bg-gray-50"
          )}
        />
      )}

      {/* Company logo header */}
      <PortalTopBar />

      {/* Main Content */}
      <main className="relative max-w-lg mx-auto">{children}</main>

      {/* Glass Morphism Bottom Navigation */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          isInstalled && "pb-safe"
        )}
      >
        {/* Glass background */}
        <div
          className={cn(
            "absolute inset-0",
            isDark
              ? "bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800/60"
              : "bg-white/80 backdrop-blur-xl border-t border-gray-200/60"
          )}
        />

        {/* Nav content */}
        <div className="relative max-w-lg mx-auto px-4">
          <div className="flex items-center justify-around h-[72px]">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;

              return (
                <Link key={item.path} href={item.path}>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    className="relative flex flex-col items-center justify-center gap-1 px-3 py-2"
                  >
                    {/* Icon */}
                    <div className="relative">
                      <Icon
                        className={cn(
                          "w-6 h-6 transition-colors duration-200",
                          active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isDark
                              ? "text-zinc-500"
                              : "text-gray-400"
                        )}
                        strokeWidth={active ? 2.5 : 1.8}
                        fill={active ? "currentColor" : "none"}
                      />
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        "text-[10px] font-medium transition-colors duration-200",
                        active
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isDark
                            ? "text-zinc-500"
                            : "text-gray-400"
                      )}
                    >
                      {item.label}
                    </span>

                    {/* Active dot indicator */}
                    {active && (
                      <motion.div
                        layoutId="modernNavDot"
                        className="absolute -bottom-1 w-1 h-1 rounded-full bg-emerald-500"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
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
