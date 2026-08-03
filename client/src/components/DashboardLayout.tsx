import { useAuth } from "../_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CompanyLogo from "@/components/CompanyLogo";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import {
  LayoutDashboard, 
  Users, 
  Package, 
  Layers, 
  Warehouse, 
  Globe, 
  DollarSign, 
  FileText, 
  BarChart3, 
  LogOut, 
  Shield,
  Languages,
  ShoppingBag,
  Crown,
  Scan,
  Wallet,
  Tags,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Home,
  ScanLine,
  Settings,
  Building2,
  Receipt,
  Landmark,
  PiggyBank,
  Scale,
  Activity,
  AlertTriangle,
  Ban,
  MessageCircle,
  QrCode,
  Bell,
  Printer,
  Truck,
  Moon,
  Sun,
  Menu,
  X,
  ClipboardList,
  Images,
  PackageSearch,
  Database,
  Wrench,
  Banknote,
  HardDrive,
  Clock,
  Target,
  FileSignature,
  CircleDollarSign,
  Calendar,
  Code,
  Boxes,
  CreditCard,
  Send,
  Search,
  type LucideIcon
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsOverlay } from "./ShortcutsOverlay";
import { RecentlyViewed } from "./RecentlyViewed";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { ScrollButtons } from "./ScrollButtons";
import { ThemePicker } from "./ThemePicker";
import { QuickCreate } from "./QuickCreate";
import { DensityToggle } from "./DensityToggle";
import { TopBarClock } from "./TopBarClock";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { usePermissions } from "@/hooks/usePermissions";

const languages: { value: Language; label: string; flag: string }[] = [
  { value: "ku", label: "کوردی", flag: "🇮🇶" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
];

interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: number;
}

interface MenuGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  items: MenuItem[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  // Redirect customers to portal
  useEffect(() => {
    if (!loading && user && (user as any).isCustomer) {
      setLocation("/portal");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">{t("auth.accessRequired") || "Access Required"}</h1>
          <p className="text-muted-foreground">{t("auth.pleaseSignIn") || "Please sign in to continue"}</p>
          <Button asChild>
            <a href={getLoginUrl()}>{t("auth.signIn") || "Sign In"}</a>
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const company = useCompanyInfo();
  useDynamicFavicon();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop icon-rail: only the clicked group's items pop out in a flyout next
  // to the rail. flyoutTop anchors the panel vertically to the clicked icon.
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["main"]);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  // A group the user explicitly clicked to close while still hovering it — this
  // overrides the hover-open until the mouse leaves, so one click really closes.
  const [clickClosedGroup, setClickClosedGroup] = useState<string | null>(null);
  const hoverLeaveTimer = useRef<number | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Most-repeated daily functions, pinned to the top bar for one-click access.
  const PINNED: { icon: LucideIcon; label: string; path: string }[] = [
    { icon: Truck, label: t("nav.quickRegister") || "تۆماری خێرا", path: "/packages/quick-register" },
    { icon: CreditCard, label: t("nav.customerDelivery") || "گەیاندن بە کڕیار", path: "/customer-delivery-scanner" },
    { icon: DollarSign, label: pickLang(language, { ku: "کڕینی نوێ بە خستنەسەر", en: "New markup purchase", ar: "شراء جديد بهامش ربح", zh: "新增加价采购" }), path: "/commission/new" },
    { icon: Package, label: pickLang(language, { ku: "پاکێجی تەواوی نوێ", en: "New complete package", ar: "حزمة كاملة جديدة", zh: "新增完整套餐" }), path: "/full-package/new" },
  ];
  const { canViewPath } = usePermissions();

  const userRole = user?.role || "user";

  // Unread messages count for sidebar badge — guarded against non-number values
  const unreadQuery = trpc.supportChat.getUnreadCount.useQuery(undefined, {
    refetchInterval: 60000,
    retry: false,
  });
  const unreadMsgCount: number = typeof unreadQuery.data === "number" ? unreadQuery.data : 0;

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (sidebarOpen && isMobile) {
      const handleClickOutside = (e: MouseEvent) => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.contains(e.target as Node)) {
          setSidebarOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sidebarOpen, isMobile]);

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location, isMobile]);

  // Auto-expand group containing active item
  useEffect(() => {
    const groups = getMenuGroups();
    for (const group of groups) {
      if (group.items.some(item => location === item.path || location.startsWith(item.path + '/'))) {
        if (!expandedGroups.includes(group.id)) {
          setExpandedGroups(prev => [...prev, group.id]);
        }
        break;
      }
    }
  }, [location]);

  // Menu groups organized professionally
  const getMenuGroups = (): MenuGroup[] => {
    const groups: MenuGroup[] = [];
    
    const isSuperAdmin = userRole === "super_admin";
    const isAdmin = isSuperAdmin || userRole === "admin";
    const isEmployee = isSuperAdmin || ["admin", "employee"].includes(userRole);
    const isAccountant = isSuperAdmin || ["admin", "accountant"].includes(userRole);

    // 1. Main Dashboard - Always visible
    groups.push({
      id: "main",
      title: t("nav.main") || "سەرەکی",
      icon: LayoutDashboard,
      color: "emerald",
      items: [
        { icon: LayoutDashboard, label: t("nav.dashboard") || "داشبۆرد", path: "/dashboard" },
        { icon: Users, label: t("nav.customers") || "کڕیارەکان", path: "/customers" },
        { icon: MessageCircle, label: t("nav.customerMessages") || "پەیامەکانی کڕیار", path: "/customer-messages", badge: unreadMsgCount },
      ]
    });

    // Customer Portal Center — its own top-level group so it gets a dedicated
    // rail icon (admin only). Single item, so the rail icon links straight to it.
    if (isAdmin) {
      groups.push({
        id: "portalCenter",
        title: pickLang(language, { ku: "سەنتەری پۆرتاڵ", en: "Portal Center", ar: "مركز البوابة", zh: "门户中心" }),
        icon: Activity,
        color: "indigo",
        items: [
          { icon: Activity, label: pickLang(language, { ku: "سەنتەری پۆرتاڵی موشتەری", en: "Customer Portal Center", ar: "مركز بوابة العملاء", zh: "客户门户中心" }), path: "/portal-center" },
        ],
      });
    }

    // Wazn Store — public storefront management (admin only)
    if (isAdmin) {
      groups.push({
        id: "store",
        title: pickLang(language, { ku: "وەزن ستۆر", en: "Wazn Store", ar: "متجر وزن", zh: "Wazn 商店" }),
        icon: ShoppingBag,
        color: "violet",
        items: [
          { icon: ShoppingBag, label: pickLang(language, { ku: "وەزن ستۆر", en: "Wazn Store", ar: "متجر وزن", zh: "Wazn 商店" }), path: "/store-management" },
        ],
      });
    }

    // 2. Packages (full package / markup / self orders) - Employees — above operations
    if (isEmployee) {
      groups.push({
        id: "fullPackage",
        title: t("nav.fullPackageSection") || "پاکێجەکان",
        icon: Boxes,
        color: "violet",
        items: [
          { icon: AlertTriangle, label: t("nav.trackingAlerts") || "ئاگاداری تراکینگ", path: "/tracking-alerts" },
          { icon: Package, label: t("nav.completePackage") || "پاکێجی تەواو", path: "/full-package" },
          { icon: DollarSign, label: t("nav.markupPurchase") || "کڕین بە تێچوو", path: "/commission" },
          { icon: ShoppingBag, label: t("nav.selfOrders") || "سێلف ئۆردەر", path: "/self-orders" },
          { icon: Building2, label: t("nav.suppliers") || "فرۆشیارەکان", path: "/suppliers" },
          { icon: LayoutDashboard, label: t("nav.unifiedOrders") || "داشبۆردی یەکگرتوو", path: "/unified-orders" },
        ]
      });
    }

    // 3. Operations (registration, batches, claims) - Employees — below packages
    if (isEmployee) {
      groups.push({
        id: "operations",
        title: t("nav.operations") || "ئۆپەریشن",
        icon: Package,
        color: "blue",
        items: [
          { icon: Truck, label: t("nav.quickRegister") || "تۆمارکردنی خێرا", path: "/packages/quick-register" },
          { icon: Package, label: t("nav.allPackages") || "هەموو پاکەتەکان", path: "/packages/all" },
          { icon: ClipboardList, label: t("nav.bulkRegister") || "تۆماری کۆمەڵە", path: "/packages/bulk-register" },
          { icon: Layers, label: t("nav.batches") || "باچەکان", path: "/batches" },
          { icon: AlertTriangle, label: t("nav.unclaimedPackages") || "پاکەتی بێ خاوەن", path: "/packages/unclaimed" },
          { icon: FileText, label: t("nav.claimRequests") || "داواکاری خاوەنداری", path: "/packages/claim-requests" },
        ]
      });
    }

    // 4. Scanning - Employees (4 modules only)
    if (isEmployee) {
      groups.push({
        id: "scanning",
        title: t("nav.scanningSection") || "سکان",
        icon: ScanLine,
        color: "cyan",
        items: [
          { icon: QrCode, label: t("nav.quickRegister") || "تۆماری خێرا", path: "/quick-register" },
          { icon: Images, label: t("nav.registrations") || "تۆمارەکان", path: "/packages/registrations" },
          { icon: PackageSearch, label: t("nav.awaitingArrival") || "نەگەیشتووەکان", path: "/packages/awaiting" },
          { icon: Ban, label: pickLang(language, { ku: "تۆماری کەلوپەلی قەدەغە", en: "Register prohibited items", ar: "تسجيل البضائع الممنوعة", zh: "登记违禁物品" }), path: "/packages/prohibited-register" },
          { icon: Boxes, label: t("nav.batchAssignment") || "خستنە ناو باچ", path: "/batch-assignment-scanner" },
          { icon: Truck, label: t("nav.arrivalVerification") || "پشکنینی گەیشتن", path: "/arrival-verification-scanner" },
          { icon: CreditCard, label: t("nav.customerDelivery") || "گەیاندن بە کڕیار", path: "/customer-delivery-scanner" },
          { icon: Activity, label: t("nav.scanDashboard") || "داشبۆردی سکان", path: "/scan-dashboard" },
          { icon: BarChart3, label: t("nav.scanReports") || "ڕاپۆرتی سکان", path: "/scan-reports" },
        ]
      });
    }

    // 5. Customer Finance - Accountants
    if (isAccountant) {
      groups.push({
        id: "customerFinance",
        title: t("nav.customerFinanceSection") || "دارایی کڕیار",
        icon: Wallet,
        color: "amber",
        items: [
          { icon: Wallet, label: t("nav.financeManagement") || "بەڕێوەبردنی دارایی", path: "/finance" },
          { icon: Receipt, label: t("nav.invoices") || "پسووڵەکان", path: "/invoices" },
          { icon: Users, label: t("nav.debtorsReport") || "ڕاپۆرتی قەرزداران", path: "/finance/debtors" },
          { icon: Clock, label: t("nav.debtReminders") || "بیرهێنەرەوەی قەرز", path: "/finance/debt-reminders" },
        ]
      });
    }

    // 6. Company Finance - Accountants
    if (isAccountant) {
      groups.push({
        id: "companyFinance",
        title: t("nav.companyFinanceSection") || "دارایی کۆمپانیا",
        icon: Landmark,
        color: "rose",
        items: [
          { icon: BarChart3, label: t("nav.companyDashboard") || "داشبۆردی کۆمپانیا", path: "/finance/company-dashboard" },
          { icon: Scale, label: t("nav.balanceSheet") || "تەرازوی دارایی", path: "/finance/balance-sheet" },
          { icon: Landmark, label: t("nav.bankAccounts") || "هەژمارە بانکییەکان", path: "/finance/bank-accounts" },
          { icon: Receipt, label: t("nav.expenses") || "خەرجییەکان", path: "/company/expenses" },
          { icon: AlertTriangle, label: t("nav.expenseAlerts") || "ئاگادارکردنەوەی خەرجی", path: "/company/expense-alerts" },
          { icon: Users, label: t("nav.partners") || "هاوبەشەکان", path: "/company/partners" },
          { icon: PiggyBank, label: t("nav.treasury") || "خەزنە", path: "/company/treasury" },
          { icon: Banknote, label: t("nav.companyDebts") || "قەرزەکانی کۆمپانیا", path: "/company/debts" },
        ]
      });
    }

    // 7. Services Management - Staff
    if (isEmployee) {
      groups.push({
        id: "services",
        title: t("nav.servicesSection") || "Services",
        icon: Wrench,
        color: "cyan",
        items: [
          { icon: Wrench, label: t("nav.allServices") || "All Services", path: "/services" },
        ]
      });
    }

    // 8. Reports & Analytics - Accountants
    if (isAccountant) {
      groups.push({
        id: "reports",
        title: t("nav.reportsSection") || "ڕاپۆرتەکان",
        icon: BarChart3,
        color: "indigo",
        items: [
          { icon: BarChart3, label: t("nav.reportsOverview") || "پوختەی ڕاپۆرت", path: "/reports" },
          { icon: Boxes, label: t("nav.batchReports") || "ڕاپۆرتی باچەکان", path: "/reports/batches" },
          { icon: Wrench, label: t("nav.serviceProfitReport") || "Service Report", path: "/reports/services" },
          { icon: TrendingUp, label: t("nav.profitDashboard") || "داشبۆردی قازانج", path: "/reports/profit" },
          { icon: Calendar, label: t("nav.monthlyProfitReport") || "ڕاپۆرتی مانگانە", path: "/reports/monthly-profit" },
          { icon: CircleDollarSign, label: t("nav.profitByType") || "قازانج بە جۆری ئۆردەر", path: "/profit-by-type" },
          { icon: FileText, label: t("nav.scanReports") || "ڕاپۆرتی سکان", path: "/scan-reports" },
          { icon: Receipt, label: t("nav.invoiceReports") || "ڕاپۆرتی پسوڵەکان", path: "/invoice-reports" },
          { icon: Target, label: t("nav.businessAnalytics") || "شیکاری بازرگانی", path: "/business-analytics" },
        ]
      });
    }

    // 8. System Settings - Admin only
    if (isAdmin) {
      groups.push({
        id: "settings",
        title: t("nav.systemSettingsSection") || "ڕێکخستنەکان",
        icon: Settings,
        color: "slate",
        items: [
          { icon: Settings, label: t("nav.systemSettings") || "ڕێکخستنی گشتی", path: "/settings" },
          { icon: Globe, label: t("nav.countries") || "وڵاتەکان", path: "/countries" },
          { icon: Warehouse, label: t("nav.warehouses") || "کۆگاکان", path: "/warehouses" },
          { icon: Crown, label: t("nav.vipCustomers") || "کڕیاری VIP", path: "/vip-customers" },
          { icon: Tags, label: t("nav.productCategories") || "جۆری بەرهەم", path: "/product-categories" },
          { icon: Wrench, label: t("nav.serviceTypes") || "جۆری خزمەتگوزاری", path: "/service-types" },
          { icon: Code, label: t("nav.customerCodePrefixes") || "پشگیری کۆدی کڕیار", path: "/settings/code-prefixes" },
          { icon: DollarSign, label: t("nav.pricingRules") || "نرخی گواستنەوە", path: "/settings/pricing" },
          { icon: DollarSign, label: t("priceList.admin.pageTitle") || "لیستی نرخی پۆرتاڵ", path: "/settings/portal-price-list" },
        ]
      });
    }

    // 9. Users & Permissions - Admin only
    if (isAdmin) {
      groups.push({
        id: "users",
        title: t("nav.userManagementSection") || "بەکارهێنەران",
        icon: Shield,
        color: "orange",
        items: [
          { icon: Shield, label: t("nav.users") || "بەکارهێنەران", path: "/users" },
          { icon: Users, label: t("nav.staffManagement") || "بەڕێوەبردنی ستاف", path: "/staff-management" },
          { icon: Shield, label: t("nav.permissionsManagement") || "بەڕێوەبردنی مۆڵەتەکان", path: "/permissions-management" },
          { icon: FileText, label: t("nav.auditLogs") || "لۆگی چاودێری", path: "/audit-logs" },
        ]
      });
    }

    // 10. Templates & Data - Admin only
    if (isAdmin) {
      groups.push({
        id: "data",
        title: t("nav.dataBackupSection") || "داتا و چاپ",
        icon: Database,
        color: "teal",
        items: [
          { icon: QrCode, label: t("nav.labelTemplates") || "داڕشتەی لەیبڵ", path: "/settings/label-templates" },
          { icon: Boxes, label: t("nav.batchLabelTemplate") || "داڕشتەی لەیبڵی باچ", path: "/settings/batch-label-template" },
          { icon: Printer, label: t("nav.labelPrinting") || "چاپکردنی لەیبڵ", path: "/label-printing" },
          { icon: FileSignature, label: t("nav.invoiceTemplate") || "داڕشتەی پسووڵە", path: "/settings/invoice-template" },
          { icon: Bell, label: t("nav.notificationSettings") || "ئاگادارکردنەوەکان", path: "/settings/notifications" },
          { icon: Send, label: t("nav.pushCenter") || "ناردنی ئاگادارکردنەوە", path: "/admin/push-notifications" },
          { icon: Database, label: t("nav.dataManagement") || "بەڕێوەبردنی داتا", path: "/settings/data-management" },
          { icon: HardDrive, label: t("nav.backupManagement") || "بەڕێوەبردنی بەکاپ", path: "/backup-management" },
          { icon: Clock, label: t("nav.scheduledBackups") || "بەکاپی خۆکار", path: "/scheduled-backups" },
        ]
      });
    }

    return groups;
  };

  // Filter menu groups based on user permissions
  const menuGroups = useMemo(
    () =>
      getMenuGroups().map(group => ({
        ...group,
        items: group.items.filter(item => canViewPath(item.path)),
      })).filter(group => group.items.length > 0),
    // getMenuGroups reads userRole, t/language, and unreadMsgCount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userRole, language, t, unreadMsgCount, canViewPath],
  );

  const isItemActive = (path: string) => location === path || location.startsWith(path + '/');

  // Desktop icon-rail mode: rail shows only group icons; clicking one pops out
  // that group's items. Mobile renders the full menu inside its drawer.
  const compact = !isMobile;

  // Close the flyout once the mouse fully leaves the rail + flyout (desktop).
  const handleSidebarLeave = () => {
    if (isMobile) return;
    setFlyoutGroup(null);
  };

  // Keep the flyout inside the viewport: if anchoring it to the clicked icon
  // would push it past the bottom edge, shift it up so all items stay visible.
  useLayoutEffect(() => {
    if (!flyoutGroup || !flyoutRef.current) return;
    const height = flyoutRef.current.offsetHeight;
    const maxTop = window.innerHeight - height - 12;
    setFlyoutTop((current) => Math.max(12, Math.min(current, maxTop)));
  }, [flyoutGroup]);

  // Record visited locations for the "recently viewed" dropdown — client-only
  // UI state. Prefer a known menu-item label; otherwise derive a best-effort
  // label from the last path segment.
  const { record } = useRecentlyViewed();
  useEffect(() => {
    if (!location || location === "/") return;
    const matched = menuGroups
      .flatMap((g) => g.items)
      .find((item) => location === item.path || location.startsWith(item.path + '/'));
    const fallback = decodeURIComponent(
      location.split("/").filter(Boolean).pop() || location
    )
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    record(location, matched?.label || fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Click toggles a group, and the click wins over hover: clicking an
  // already-open (incl. hover-opened) group closes it on the spot, and clicking
  // a closed one pins it open. Works the same on desktop and touch.
  const handleGroupClick = (groupId: string, currentlyExpanded: boolean) => {
    if (currentlyExpanded) {
      setExpandedGroups(prev => prev.filter(id => id !== groupId));
      setClickClosedGroup(groupId); // override hover so it really closes
    } else {
      setExpandedGroups(prev => (prev.includes(groupId) ? prev : [...prev, groupId]));
      setClickClosedGroup(prev => (prev === groupId ? null : prev));
    }
  };

  // Desktop convenience: open a group on hover, close it shortly after the
  // mouse leaves. On touch devices hover is disabled so tapping is the only
  // trigger. Leaving resets the click-close override for the next hover.
  const handleGroupEnter = (groupId: string) => {
    if (isMobile) return;
    if (hoverLeaveTimer.current) {
      window.clearTimeout(hoverLeaveTimer.current);
      hoverLeaveTimer.current = null;
    }
    setHoveredGroup(groupId);
  };
  const handleGroupLeave = () => {
    if (isMobile) return;
    if (hoverLeaveTimer.current) window.clearTimeout(hoverLeaveTimer.current);
    hoverLeaveTimer.current = window.setTimeout(() => {
      setHoveredGroup(null);
      setClickClosedGroup(null);
    }, 220);
  };
  useEffect(() => () => {
    if (hoverLeaveTimer.current) window.clearTimeout(hoverLeaveTimer.current);
  }, []);

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; text: string; icon: string; activeBg: string }> = {
      emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", icon: "text-emerald-600", activeBg: "bg-emerald-100 dark:bg-emerald-900/40" },
      blue: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", icon: "text-blue-600", activeBg: "bg-blue-100 dark:bg-blue-900/40" },
      violet: { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-400", icon: "text-violet-600", activeBg: "bg-violet-100 dark:bg-violet-900/40" },
      cyan: { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-400", icon: "text-cyan-600", activeBg: "bg-cyan-100 dark:bg-cyan-900/40" },
      amber: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", icon: "text-amber-600", activeBg: "bg-amber-100 dark:bg-amber-900/40" },
      rose: { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", icon: "text-rose-600", activeBg: "bg-rose-100 dark:bg-rose-900/40" },
      indigo: { bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-700 dark:text-indigo-400", icon: "text-indigo-600", activeBg: "bg-indigo-100 dark:bg-indigo-900/40" },
      slate: { bg: "bg-slate-50 dark:bg-slate-900/20", text: "text-slate-700 dark:text-slate-400", icon: "text-slate-600", activeBg: "bg-slate-100 dark:bg-slate-900/40" },
      orange: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", icon: "text-orange-600", activeBg: "bg-orange-100 dark:bg-orange-900/40" },
      teal: { bg: "bg-teal-50 dark:bg-teal-900/20", text: "text-teal-700 dark:text-teal-400", icon: "text-teal-600", activeBg: "bg-teal-100 dark:bg-teal-900/40" },
    };
    return colors[color] || colors.emerald;
  };

  return (
    <div className={cn("min-h-screen bg-gray-50 dark:bg-gray-900", isRTL && "rtl")}>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex items-center gap-2">
          <CompanyLogo
            size={24}
            iconClassName="h-4 w-4 text-white"
            fallbackBg="bg-emerald-600"
          />
          <span className="font-semibold text-gray-900 dark:text-gray-200 dark:text-white">{company.name}</span>
        </div>
        <div className="w-9" />
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      {/* Rail + flyout share one mouse-leave boundary so moving from an icon
          onto its flyout doesn't close it; leaving both closes the flyout. */}
      <div onMouseLeave={handleSidebarLeave}>
      <aside
        id="sidebar"
        className={cn(
          "fixed top-0 h-full bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 z-50 transition-all duration-300 ease-in-out overflow-hidden flex flex-col",
          isRTL ? "right-0 border-l" : "left-0 border-r",
          isMobile
            ? cn(
                "w-72",
                sidebarOpen
                  ? "translate-x-0"
                  : isRTL ? "translate-x-full" : "-translate-x-full"
              )
            : "w-20 translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn(
          "h-16 flex items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0",
          compact ? "justify-center px-2" : "justify-between px-4"
        )}>
          <div className={cn("flex items-center", compact ? "" : "gap-3")}>
            <CompanyLogo
              size={40}
              className="shadow-lg shadow-emerald-500/25"
              iconClassName="h-5 w-5 text-white"
              fallbackBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            {!compact && (
              <div>
                <span className="font-bold text-lg text-gray-900 dark:text-gray-200 dark:text-white block leading-tight">
                  {company.name}
                </span>
              </div>
            )}
          </div>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Sidebar Content - Scrollable */}
        {compact ? (
          <div className="flex-1 overflow-y-auto py-3 flex flex-col items-center gap-1.5">
            {menuGroups.map((group) => {
              const hasActiveItem = group.items.some(item => isItemActive(item.path));
              const colorClasses = getColorClasses(group.color, hasActiveItem);
              const isFlyoutOpen = flyoutGroup === group.id;
              return (
                <button
                  key={group.id}
                  title={group.title}
                  aria-label={group.title}
                  onClick={(e) => {
                    // Single-item groups act as a direct link (no flyout needed).
                    if (group.items.length === 1) {
                      setFlyoutGroup(null);
                      setLocation(group.items[0].path);
                      return;
                    }
                    const top = e.currentTarget.getBoundingClientRect().top;
                    setFlyoutTop(top);
                    setFlyoutGroup((prev) => (prev === group.id ? null : group.id));
                  }}
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
                    isFlyoutOpen && "ring-2 ring-orange-400 dark:ring-orange-500",
                    hasActiveItem
                      ? colorClasses.activeBg
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-orange-100 dark:hover:bg-orange-900/40"
                  )}
                >
                  <group.icon className={cn(
                    "h-5 w-5 transition-colors",
                    hasActiveItem ? colorClasses.icon : "text-gray-500 dark:text-gray-400"
                  )} />
                </button>
              );
            })}
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto py-3 px-2">
          {menuGroups.map((group) => {
            const isExpanded =
              clickClosedGroup === group.id
                ? false
                : expandedGroups.includes(group.id) || hoveredGroup === group.id;
            const hasActiveItem = group.items.some(item => isItemActive(item.path));
            const colorClasses = getColorClasses(group.color, hasActiveItem);

            return (
              <div
                key={group.id}
                className="mb-1"
                onMouseEnter={() => handleGroupEnter(group.id)}
                onMouseLeave={handleGroupLeave}
              >
                {/* Group Header */}
                <button
                  onClick={() => handleGroupClick(group.id, isExpanded)}
                  className={cn(
                    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    hasActiveItem
                      ? cn(colorClasses.bg, colorClasses.text)
                      : "text-gray-600 dark:text-gray-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30 dark:hover:text-orange-400"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    hasActiveItem ? colorClasses.activeBg : "bg-gray-100 dark:bg-gray-700 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40"
                  )}>
                    <group.icon className={cn(
                      "h-4 w-4 transition-colors",
                      hasActiveItem ? colorClasses.icon : "text-gray-500 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400"
                    )} />
                  </div>
                  <span className="flex-1 text-start text-base font-bold">{group.title}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isExpanded ? "rotate-0" : "-rotate-90",
                    isRTL && !isExpanded && "rotate-90"
                  )} />
                </button>

                {/* Group Items */}
                <div className={cn(
                  "overflow-hidden transition-all duration-200",
                  isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                )}>
                  <div className={cn("mt-1 space-y-0.5", "ms-4")}>
                    {group.items.map((item) => {
                      const isActive = isItemActive(item.path);
                      return (
                        <button
                          key={item.path}
                          onClick={() => setLocation(item.path)}
                          className={cn(
                            "group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                            isActive
                              ? cn(colorClasses.activeBg, colorClasses.text, "font-medium")
                              : "text-gray-600 dark:text-gray-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30 dark:hover:text-orange-400"
                          )}
                        >
                          <item.icon className={cn(
                            "h-4 w-4 flex-shrink-0 transition-colors",
                            isActive ? colorClasses.icon : "text-gray-400 dark:text-gray-500 group-hover:text-orange-600 dark:group-hover:text-orange-400"
                          )} />
                          <span className="truncate text-[15px] font-bold">{item.label}</span>
                          {item.badge && item.badge > 0 ? (
                            <span className="ms-auto min-w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          ) : null}
                          {isActive && !item.badge && (
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full ms-auto",
                              `bg-${group.color}-500`
                            )} style={{ backgroundColor: `var(--${group.color}-500, #10b981)` }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {/* Language switcher + user profile moved to the top bar (top-left in
            RTL) to free up the sidebar — see the global navigation bar. */}
      </aside>

      {/* Rail flyout — only the clicked group's items, anchored to its icon. */}
      {compact && flyoutGroup && (() => {
        const group = menuGroups.find((g) => g.id === flyoutGroup);
        if (!group) return null;
        const hasActiveItem = group.items.some((item) => isItemActive(item.path));
        const colorClasses = getColorClasses(group.color, hasActiveItem);
        return (
          <div
            ref={flyoutRef}
            className="fixed z-50 w-60 max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-2"
            style={{ top: flyoutTop, [isRTL ? "right" : "left"]: "5rem" }}
          >
            <div className="px-2 py-1.5 flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center",
                hasActiveItem ? colorClasses.activeBg : "bg-gray-100 dark:bg-gray-700"
              )}>
                <group.icon className={cn(
                  "h-4 w-4",
                  hasActiveItem ? colorClasses.icon : "text-gray-500 dark:text-gray-400"
                )} />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-200 dark:text-white">{group.title}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {group.items.map((item) => {
                const isActive = isItemActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { setLocation(item.path); setFlyoutGroup(null); }}
                    className={cn(
                      "group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                      isActive
                        ? cn(colorClasses.activeBg, colorClasses.text, "font-medium")
                        : "text-gray-600 dark:text-gray-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30 dark:hover:text-orange-400"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 flex-shrink-0 transition-colors",
                      isActive ? colorClasses.icon : "text-gray-400 dark:text-gray-500 group-hover:text-orange-600 dark:group-hover:text-orange-400"
                    )} />
                    <span className="truncate text-[15px] font-bold text-start">{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="ms-auto min-w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center px-1">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
      </div>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300 bg-gradient-to-b from-background to-muted/20 dark:to-muted/10",
        isMobile ? "pt-14" : "ms-20"
      )}>
        {/* Global navigation bar — go one step back / forward, or jump to the
            dashboard home. Available on every page. Sticks just below the
            mobile header (top-14) or to the viewport on desktop (top-0). */}
        <div className={cn(
          "sticky z-30 flex items-center gap-1 h-11 px-2 md:px-6 border-b border-gray-200 dark:border-gray-700 bg-white/85 dark:bg-gray-900/85 backdrop-blur print:hidden",
          isMobile ? "top-14" : "top-0"
        )}>
          {/* Nav cluster — Windows 11–style rounded pill group */}
          <div className="flex items-center gap-0.5 rounded-full bg-muted/50 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title={t("nav.back") || "گەڕانەوە"}
              aria-label={t("nav.back") || "گەڕانەوە"}
              onClick={() => window.history.back()}
            >
              {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title={t("nav.forward") || "بۆ دواتر"}
              aria-label={t("nav.forward") || "بۆ دواتر"}
              onClick={() => window.history.forward()}
            >
              {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title={t("nav.home") || "پەڕەی سەرەکی"}
              aria-label={t("nav.home") || "پەڕەی سەرەکی"}
              onClick={() => setLocation("/dashboard")}
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>

          {/* Pinned daily shortcuts (hidden on small screens) — own pill group */}
          <div className="hidden sm:flex items-center gap-0.5 rounded-full bg-muted/50 p-0.5 ms-1.5">
            {PINNED.map((p) => (
              <Button
                key={p.path}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title={p.label}
                aria-label={p.label}
                onClick={() => setLocation(p.path)}
              >
                <p.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {/* Centered live clock + date. The flex-1 spacer absorbs the gap
              and centers the clock while pushing the controls group to the
              far edge (replacing the group's old ms-auto). */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <TopBarClock className="hidden md:flex" />
          </div>

          {/* Controls group (RTL: top-left): search + language + user profile */}
          <div className="flex items-center gap-1.5">
            {/* Function search — compact icon that opens the command palette */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setCmdOpen(true)}
              title={pickLang(language, { ku: "گەڕان بۆ فەنکشن (Ctrl+K)", en: "Search for a function (Ctrl+K)", ar: "البحث عن وظيفة (Ctrl+K)", zh: "搜索功能 (Ctrl+K)" })}
              aria-label={pickLang(language, { ku: "گەڕان بۆ فەنکشن", en: "Search for a function", ar: "البحث عن وظيفة", zh: "搜索功能" })}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Recently viewed pages dropdown */}
            <RecentlyViewed className="h-8 w-8" />

            {/* Quick create ("+ New") */}
            <QuickCreate />

            {/* Compact / comfortable table density */}
            <DensityToggle />

            {/* Accent theme (skin) picker */}
            <ThemePicker />

            {/* Dark / light mode — one-click toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              title={theme === "dark" ? (t("lightMode") || "دۆخی ڕووناک") : (t("darkMode") || "دۆخی تاریک")}
              aria-label={theme === "dark" ? (t("lightMode") || "دۆخی ڕووناک") : (t("darkMode") || "دۆخی تاریک")}
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            </Button>

            {/* Language */}
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="h-8 w-auto gap-1 px-2 text-xs">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {languages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2"><span>{lang.flag}</span><span>{lang.label}</span></span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-muted transition-colors">
                  <Avatar className="h-7 w-7 border-2 border-emerald-200 dark:border-emerald-800">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:block text-start leading-tight">
                    <p className="text-xs font-semibold truncate max-w-[120px]">{user?.name || "User"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {userRole === "admin" ? t("roles.admin") : userRole === "employee" ? t("roles.employee") : userRole === "accountant" ? t("roles.accountant") : userRole === "super_admin" ? t("roles.superAdmin") || "Super Admin" : userRole}
                    </p>
                  </div>
                  <ChevronDown className="hidden lg:block h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? "start" : "end"} className="w-56">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                </div>
                <div className="p-1">
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer rounded-lg">
                    {theme === "dark" ? (
                      <Sun className="me-2 h-4 w-4 text-amber-500" />
                    ) : (
                      <Moon className="me-2 h-4 w-4 text-indigo-500" />
                    )}
                    <span>{theme === "dark" ? t("lightMode") || "دۆخی ڕووناک" : t("darkMode") || "دۆخی تاریک"}</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <div className="p-1">
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 rounded-lg">
                    <LogOut className="me-2 h-4 w-4" />
                    <span>{t("signOut") || "چوونەدەرەوە"}</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <ShortcutsOverlay />
      <ScrollButtons />
    </div>
  );
}
