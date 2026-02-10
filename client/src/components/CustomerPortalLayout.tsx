import { ReactNode, useState } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { Home, Package, Wallet, User, ShoppingBag, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { usePWA } from "@/components/PWAInstallPrompt";
import { LiveChatSupport, ChatFloatingButton } from "@/components/LiveChatSupport";
import { Input } from "@/components/ui/input";
import { usePortalSSE } from "@/hooks/usePortalSSE";
import { toast } from "sonner";

interface CustomerPortalLayoutProps {
  children: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isRTL = language === "ku" || language === "ar";
  const { isInstalled } = usePWA();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    const q = new URLSearchParams(searchString).get("q");
    return q ?? "";
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (e.target as HTMLFormElement).querySelector("input")?.value?.trim();
    if (q) setLocation(`/portal/search?q=${encodeURIComponent(q)}`);
  };

  // Real-time notifications (SSE). Server must expose GET /api/portal/events for events to work.
  usePortalSSE({
    enabled: true,
    onPackageStatus: (d) => {
      toast.info(
        language === "ku"
          ? `بار نوێکراوە: ${d.trackingNumber || d.packageId} - ${d.status}`
          : `Package updated: ${d.trackingNumber || d.packageId} - ${d.status}`
      );
    },
    onNewInvoice: (d) => {
      toast.info(
        language === "ku"
          ? `وەسڵی نوێ: ${d.invoiceNumber}`
          : `New invoice: ${d.invoiceNumber}`
      );
    },
    onPaymentConfirmation: (d) => {
      toast.success(
        language === "ku"
          ? `پارەدان پشتڕاستکرایەوە: $${d.amount.toFixed(2)}`
          : `Payment confirmed: $${d.amount.toFixed(2)}`
      );
    },
  });

  // Left side items
  const leftItems = [
    { 
      icon: Package, 
      label: language === "ku" ? "بارەکان" : "Shipments", 
      path: "/portal/shipments",
      activeColor: "text-emerald-500",
      activeBg: "bg-emerald-500/10",
      activeGlow: "shadow-emerald-500/20",
    },
    { 
      icon: ShoppingBag, 
      label: language === "ku" ? "کڕین" : "Full Pack", 
      path: "/portal/full-package",
      activeColor: "text-purple-500",
      activeBg: "bg-purple-500/10",
      activeGlow: "shadow-purple-500/20",
    },
  ];

  // Right side items
  const rightItems = [
    { 
      icon: Wallet, 
      label: language === "ku" ? "دارایی" : "Financial", 
      path: "/portal/financial",
      activeColor: "text-amber-500",
      activeBg: "bg-amber-500/10",
      activeGlow: "shadow-amber-500/20",
    },
    { 
      icon: User, 
      label: language === "ku" ? "من" : "Me", 
      path: "/portal/profile",
      activeColor: "text-blue-500",
      activeBg: "bg-blue-500/10",
      activeGlow: "shadow-blue-500/20",
    },
  ];

  // Home item (center)
  const homeItem = { 
    icon: Home, 
    label: language === "ku" ? "سەرەکی" : "Home", 
    path: "/portal",
  };

  const isHomeActive = location === "/portal";

  const renderNavItem = (item: typeof leftItems[0], isActive: boolean) => (
    <Link key={item.path} href={item.path}>
      <button className={cn(
        "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 min-w-[60px]",
        isActive 
          ? `${item.activeColor} ${item.activeBg} shadow-lg ${item.activeGlow}` 
          : isDark 
            ? "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50" 
            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
      )}>
        <div className={cn(
          "relative transition-transform duration-300",
          isActive && "scale-110"
        )}>
          <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
          {isActive && (
            <div className={cn(
              "absolute -inset-1 rounded-full blur-md opacity-50",
              item.activeBg
            )} />
          )}
        </div>
        <span className={cn(
          "text-[10px] font-medium transition-all duration-300",
          isActive && "font-bold"
        )}>
          {item.label}
        </span>
      </button>
    </Link>
  );

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "min-h-screen transition-colors duration-300",
        isDark ? "bg-slate-900" : "bg-slate-50",
        isRTL && "rtl",
        isInstalled ? "pb-28" : "pb-24"
      )}
    >
      {/* PWA Status Bar Spacer for iOS */}
      {isInstalled && (
        <div className={cn("h-safe-area-top", isDark ? "bg-slate-950" : "bg-slate-900")} />
      )}
      {/* Global search bar - sticky at top */}
      <div className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        isDark ? "bg-slate-900/95 border-slate-700/50 backdrop-blur-sm" : "bg-slate-50/95 border-slate-200/50 backdrop-blur-sm"
      )}>
        <form onSubmit={handleSearchSubmit} className="max-w-lg mx-auto px-3 py-2">
          <div className="relative">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
              isRTL ? "right-3" : "left-3"
            )} />
            <Input
              type="search"
              placeholder={language === "ku" ? "گەڕان بە ژمارەی تراک یان نامە..." : "Search tracking, invoices..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "h-10 rounded-xl border-0 bg-muted/50 text-sm",
                isRTL ? "pr-9 pl-4" : "pl-9 pr-4"
              )}
            />
          </div>
        </form>
      </div>
      {/* Main Content */}
      <main className="max-w-lg mx-auto">
        {children}
      </main>

      {/* Bottom Navigation - fixed with smooth transitions */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
        isInstalled && "pb-safe"
      )}>
        {/* Curved background effect */}
        <div className={cn(
          "absolute inset-0 backdrop-blur-xl border-t",
          isDark 
            ? "bg-slate-800/90 border-slate-700/30" 
            : "bg-white/90 border-slate-200/50"
        )} />
        
        {/* Navigation content */}
        <div className="relative max-w-lg mx-auto">
          <div className="flex items-end justify-between px-4 h-20">
            {/* Left Side - Shipments & Full Pack */}
            <div className="flex items-center gap-1">
              {leftItems.map((item) => {
                const isActive = location === item.path || 
                  (item.path !== "/portal" && location.startsWith(item.path));
                return renderNavItem(item, isActive);
              })}
            </div>

            {/* Center - Home Button (Large & Prominent) */}
            <div className="relative -top-4">
              <Link href={homeItem.path}>
                <button className={cn(
                  "relative group",
                )}>
                  {/* Outer glow ring */}
                  <div className={cn(
                    "absolute -inset-2 rounded-full transition-all duration-500",
                    isHomeActive 
                      ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-70 blur-lg animate-pulse" 
                      : "bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-40 blur-md"
                  )} />
                  
                  {/* Main button */}
                  <div className={cn(
                    "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                    "shadow-2xl",
                    isHomeActive
                      ? "bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 scale-110"
                      : isDark
                        ? "bg-gradient-to-br from-slate-700 to-slate-800 group-hover:from-blue-600 group-hover:to-purple-600"
                        : "bg-gradient-to-br from-slate-800 to-slate-900 group-hover:from-blue-600 group-hover:to-purple-600",
                    "group-hover:scale-105 group-active:scale-95"
                  )}>
                    {/* Inner shine effect */}
                    <div className="absolute inset-0.5 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
                    
                    {/* Icon */}
                    <homeItem.icon className={cn(
                      "w-7 h-7 text-white relative z-10 transition-transform duration-300",
                      isHomeActive && "scale-110"
                    )} strokeWidth={2.5} />
                  </div>

                  {/* Label below */}
                  <span className={cn(
                    "absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap transition-colors duration-300",
                    isHomeActive 
                      ? "text-purple-500" 
                      : isDark 
                        ? "text-slate-400" 
                        : "text-slate-500"
                  )}>
                    {homeItem.label}
                  </span>
                </button>
              </Link>
            </div>

            {/* Right Side - Financial & Me */}
            <div className="flex items-center gap-1">
              {rightItems.map((item) => {
                const isActive = location === item.path || 
                  (item.path !== "/portal" && location.startsWith(item.path));
                return renderNavItem(item, isActive);
              })}
            </div>
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
