import { ReactNode, useState, useEffect, useRef } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Home, Package, Wallet, User, ShoppingBag, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { usePortalWidthClass } from "@/hooks/usePortalWidth";
import { PortalWidthSwitch } from "@/components/portal/PortalWidthSwitch";
import { usePortalIdleLogout } from "@/hooks/usePortalIdleLogout";
import { usePWA } from "@/components/PWAInstallPrompt";
import { LiveChatSupport, ChatFloatingButton } from "@/components/LiveChatSupport";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { Input } from "@/components/ui/input";
import CompanyLogo from "@/components/CompanyLogo";
import { PortalNavButtons } from "@/components/PortalNavButtons";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { DeclarePackageBanner } from "@/components/portal/DeclarePackageBanner";
import { NewsTicker } from "@/components/portal/NewsTicker";
import { usePortalSSE } from "@/hooks/usePortalSSE";
import { toast } from "sonner";

interface CustomerPortalLayoutProps {
  children: ReactNode;
}

export function CustomerPortalLayout({ children }: CustomerPortalLayoutProps) {
  useDynamicFavicon();
  const [location, setLocation] = useLocation();
  const isSearchPage = location.startsWith("/portal/search");
  const searchString = useSearch();
  // How wide this portal sits: grows with the screen unless the reader
  // has chosen a fixed width for themselves.
  const portalWidth = usePortalWidthClass();
  // Half an hour of nothing and the customer is signed out. A shared computer
  // at an internet cafe should not stay open behind them.
  usePortalIdleLogout(true);
  const { language, t } = useLanguage();
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

  // Portal page-view tracking for the admin Portal Center. Best-effort and
  // fire-and-forget: fails silently and never blocks navigation. Skips repeat
  // fires for the same path so a re-render doesn't double-log.
  const trackActivity = trpc.customerPortal.trackActivity.useMutation();
  const lastTrackedPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastTrackedPath.current === location) return;
    lastTrackedPath.current = location;
    trackActivity.mutate({ path: location });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Real-time notifications via SSE. The backend stream is at
  // GET /api/portal/events (see server/_core/index.ts) and pushes events
  // whenever createCustomerNotification fires for this customer.
  const utils = trpc.useUtils();
  // Refresh the unread counters live so the bell starts ringing/flashing the
  // moment something arrives, without waiting for a page refresh.
  const refreshBadges = () => {
    utils.customerPortal.getNotificationCount.invalidate();
    utils.customerPortal.getUnreadMessageCount.invalidate();
  };
  usePortalSSE({
    enabled: true,
    onPackageStatus: (d) => {
      toast.info(
        t('portal.packageUpdatedNotif', { tracking: d.trackingNumber || d.packageId, status: d.status })
      );
      refreshBadges();
    },
    onNewInvoice: (d) => {
      toast.info(
        t('portal.newInvoiceNotif', { invoiceNumber: d.invoiceNumber })
      );
      refreshBadges();
    },
    onPaymentConfirmation: (d) => {
      toast.success(
        t('portal.paymentConfirmedNotif', { amount: d.amount.toFixed(2) })
      );
      refreshBadges();
    },
    onNotification: (d) => {
      // Generic catch-all for any customerNotifications row inserted
      // server-side — package status, batch updates, refunds, etc. —
      // so the customer doesn't need to refresh to see fresh activity.
      toast.info(d.title || d.body, d.title && d.body ? { description: d.body } : undefined);
      refreshBadges();
    },
    onNews: (d) => {
      // Company-wide Wazn News broadcast — live toast + refresh the news feeds
      // so the carousel/ticker/news page pick up the new post without a reload.
      const heading =
        language === 'ku' ? 'وەزن نیوز: بابەتی نوێ' :
        language === 'ar' ? 'وزن نيوز: منشور جديد' :
        language === 'zh' ? 'Wazn 新闻：新帖子' : 'Wazn News: new post';
      toast.info(heading, { description: d.title || undefined });
      utils.blog.published.invalidate();
      utils.blog.featured.invalidate();
    },
  });

  // Left side items
  const leftItems = [
    { 
      icon: Package, 
      label: t('portal.shipments'), 
      path: "/portal/shipments",
      activeColor: "text-emerald-500",
      activeBg: "bg-emerald-500/10",
      activeGlow: "shadow-emerald-500/20",
    },
    { 
      icon: ShoppingBag, 
      label: t('portal.fullPack'), 
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
      label: t('portal.financial'), 
      path: "/portal/financial",
      activeColor: "text-amber-500",
      activeBg: "bg-amber-500/10",
      activeGlow: "shadow-amber-500/20",
    },
    { 
      icon: User, 
      label: t('portal.me'), 
      path: "/portal/profile",
      activeColor: "text-blue-500",
      activeBg: "bg-blue-500/10",
      activeGlow: "shadow-blue-500/20",
    },
  ];

  // Home item (center)
  const homeItem = { 
    icon: Home, 
    label: t('portal.home'), 
    path: "/portal",
  };

  const isHomeActive = location === "/portal";

  const renderNavItem = (item: typeof leftItems[0], isActive: boolean) => (
    <Link
      key={item.path}
      href={item.path}
      aria-current={isActive ? "page" : undefined}
      className={cn(
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
          "text-[11px] font-medium transition-all duration-300",
          isActive && "font-bold"
        )}>
          {item.label}
        </span>
    </Link>
  );

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        // A flex column so <main> can grow: that is what lets the news strip
        // sit at the bottom of a short page instead of directly under the
        // content, halfway up the screen.
        "portal-theme min-h-screen flex flex-col transition-colors duration-300",
        isDark ? "bg-slate-900" : "bg-slate-50 dark:bg-slate-950/40",
        isRTL && "rtl",
        // Bottom room so content (incl. the in-flow news ticker) clears the
        // fixed bottom nav when scrolled to the end.
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
        <div className={cn(portalWidth, "mx-auto px-3 py-2 flex items-center gap-2")}>
          {/* Company logo (uploaded in Settings) at the leading edge */}
          <CompanyLogo size={36} className="shrink-0" />
          <PortalNavButtons />
          {/* The search page has its own, larger search field. Two stacked
              search boxes with different placeholders on one screen reads as
              a mistake, so the chrome yields to the page that owns the job. */}
          {!isSearchPage && (
          <form onSubmit={handleSearchSubmit} className="flex-1">
            <div className="relative">
              <Search className={cn(
                "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
                isRTL ? "right-3" : "left-3"
              )} />
              <Input
                type="search"
                placeholder={t('portal.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-10 rounded-xl border-0 bg-muted/50 text-sm",
                  isRTL ? "pr-9 pl-4" : "pl-9 pr-4"
                )}
              />
            </div>
          </form>
          )}
        </div>
      </div>
      {/* Main Content. Grows to fill the viewport so the news strip below can
          be pushed to the bottom on a short page — without it the strip landed
          wherever the content happened to end, halfway up the screen on a page
          like Shipments with only a couple of rows. */}
      <main className={cn(portalWidth, "mx-auto w-full flex-1 flex flex-col")}>
        {/* Admin-set announcement banner — shown on every portal page */}
        <AnnouncementBanner />
        {/* Prominent pre-declaration CTA — home only, above every skin */}
        {location === "/portal" && <DeclarePackageBanner />}
        {children}
        {/* Wazn News ticker — in-flow, and mt-auto pins it to the bottom of a
            short page while still sitting at the end of a long one. Never
            fixed: it should come into view, not hover over the content. */}
        <div className="mt-auto">
          <NewsTicker language={language} />
        </div>
      </main>

      {/* Staff at a desk, and customers on one, can see the portal at
          another screen's width. Renders nothing on a phone unless the
          reader is staff. */}
      <PortalWidthSwitch />

      {/* Bottom Navigation - fixed with smooth transitions */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
        "pb-safe"
      )}>
        {/* Curved background effect */}
        <div className={cn(
          "absolute inset-0 backdrop-blur-xl border-t",
          isDark 
            ? "bg-slate-800/90 border-slate-700/30" 
            : "bg-white/90 border-slate-200/50"
        )} />
        
        {/* Navigation content */}
        {/* The bottom bar stays phone-width whatever the page does: it is a
            thumb-reach pattern, and stretched across a monitor its items end
            up a hand-span apart with a hole in the middle. */}
        <div className={cn("relative", "max-w-lg", "mx-auto")}>
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
              <Link
                href={homeItem.path}
                aria-current={isHomeActive ? "page" : undefined}
                className="relative group block"
              >
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

      {/* Web Push enable prompt — only renders when supported, server-enabled, and not dismissed */}
      <PushNotificationPrompt enabled={true} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnnouncementBanner — admin-set portal-wide banner (Portal Center → set
// announcement). Localized per the active UI language; hidden when disabled.
// ---------------------------------------------------------------------------
function AnnouncementBanner() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { data } = trpc.customerPortal.getAnnouncement.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });
  if (!data) return null;
  const text =
    (language === "ku" && data.ku) ||
    (language === "ar" && data.ar) ||
    (language === "zh" && data.zh) ||
    data.en || data.ku || data.ar || data.zh;
  if (!text) return null;
  const styles: Record<string, string> = {
    info: isDark
      ? "bg-sky-950/60 border-sky-800 text-sky-200"
      : "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-800 dark:text-sky-200",
    warning: isDark
      ? "bg-amber-950/60 border-amber-800 text-amber-200"
      : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200",
    success: isDark
      ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
      : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200",
  };
  return (
    <div className={cn("mx-4 mt-3 rounded-2xl border px-4 py-3 text-sm font-medium leading-relaxed", styles[data.type] ?? styles.info)}>
      {text}
    </div>
  );
}
