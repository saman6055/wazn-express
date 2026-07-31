import { NewsTicker } from "@/components/portal/NewsTicker";
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

interface Skin3PortalLayoutProps {
  children: ReactNode;
}

export default function Skin3PortalLayout({ children }: Skin3PortalLayoutProps) {
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
        "portal-theme min-h-screen transition-colors duration-300",
        isDark ? "bg-zinc-950" : "bg-amber-50/50",
        isRTL && "rtl",
        isInstalled ? "pb-32" : "pb-28"
      )}
    >
      {/* PWA Status Bar Spacer for iOS */}
      {isInstalled && (
        <div
          className={cn(
            "h-safe-area-top",
            isDark ? "bg-zinc-950" : "bg-amber-50/50"
          )}
        />
      )}

      {/* Company logo header */}
      <PortalTopBar />

      {/* Main Content */}
      <main className="relative max-w-lg mx-auto">
        {children}
        {/* Wazn News strip — in-flow at the very end of the content, the same
            as the classic skin. It was only ever rendered there, so on this
            skin the news never appeared at all. */}
        <NewsTicker language={language} />
      </main>

      {/* Floating Pill Bottom Navigation */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 flex justify-center",
          isInstalled ? "pb-safe" : "pb-4"
        )}
      >
        <motion.nav
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.2 }}
          className={cn(
            "rounded-full px-2 py-2 flex items-center gap-1",
            isDark
              ? "bg-zinc-900/90 backdrop-blur-xl border-2 border-zinc-700/60 shadow-[0px_4px_20px_rgba(0,0,0,0.5)]"
              : "bg-white/90 backdrop-blur-xl border-2 border-black/10 shadow-[4px_4px_0px_rgba(0,0,0,0.08)]"
          )}
        >
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;

            return (
              <Link key={item.path} href={item.path}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    "relative flex flex-col items-center justify-center px-3 py-1.5 rounded-full transition-all duration-200",
                    active
                      ? isDark
                        ? "bg-indigo-500"
                        : "bg-indigo-500"
                      : "bg-transparent"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-200",
                      active
                        ? "text-white"
                        : isDark
                          ? "text-zinc-500"
                          : "text-gray-400"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-bold mt-0.5 transition-colors duration-200",
                      active
                        ? "text-white"
                        : isDark
                          ? "text-zinc-500"
                          : "text-gray-400"
                    )}
                  >
                    {item.label}
                  </span>
                </motion.button>
              </Link>
            );
          })}
        </motion.nav>
      </div>

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
