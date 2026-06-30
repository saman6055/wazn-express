import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  Truck,
  ShoppingBag,
  Package,
  ClipboardList,
  Layers,
  AlertTriangle,
  FileText,
  DollarSign,
  Building2,
  Boxes,
  QrCode,
  CreditCard,
  Activity,
  BarChart3,
  Wallet,
  Receipt,
  Settings,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";

interface LangText {
  ku: string;
  en: string;
  ar: string;
  zh: string;
}

interface Dest {
  label: LangText;
  path: string;
  icon: LucideIcon;
  keywords?: string;
}

// One flat, searchable map of everywhere you can go. Keywords carry the
// English/alternate terms so searching "commission", "batch", "scan" etc.
// finds the Kurdish-labelled destination.
const GROUPS: { heading: LangText; items: Dest[] }[] = [
  {
    heading: { ku: "خێرا", en: "Quick", ar: "سريع", zh: "快捷" },
    items: [
      { label: { ku: "تۆماری خێرا", en: "Quick register", ar: "تسجيل سريع", zh: "快速登记" }, path: "/packages/quick-register", icon: Truck, keywords: "quick register package تۆمار" },
      { label: { ku: "کڕینی نوێ بە خستنەسەر", en: "New markup order", ar: "طلب جديد بهامش ربح", zh: "新加价订单" }, path: "/commission/new", icon: PlusCircle, keywords: "new commission markup order عمولە" },
      { label: { ku: "پاکێجی تەواوی نوێ", en: "New full package", ar: "باقة كاملة جديدة", zh: "新全包订单" }, path: "/full-package/new", icon: PlusCircle, keywords: "new full package order" },
      { label: { ku: "گەیاندن بە کڕیار", en: "Deliver to customer", ar: "تسليم للعميل", zh: "交付给客户" }, path: "/customer-delivery-scanner", icon: CreditCard, keywords: "delivery scan customer" },
    ],
  },
  {
    heading: { ku: "سەرەکی", en: "Main", ar: "الرئيسية", zh: "主要" },
    items: [
      { label: { ku: "داشبۆرد", en: "Dashboard", ar: "لوحة التحكم", zh: "仪表板" }, path: "/dashboard", icon: LayoutDashboard, keywords: "dashboard home" },
      { label: { ku: "کڕیارەکان", en: "Customers", ar: "العملاء", zh: "客户" }, path: "/customers", icon: Users, keywords: "customers clients" },
      { label: { ku: "پەیامەکانی کڕیار", en: "Customer messages", ar: "رسائل العملاء", zh: "客户消息" }, path: "/customer-messages", icon: MessageCircle, keywords: "messages chat" },
    ],
  },
  {
    heading: { ku: "پاکێجەکان", en: "Packages", ar: "الباقات", zh: "包裹" },
    items: [
      { label: { ku: "ئاگاداری تراکینگ", en: "Tracking alerts", ar: "تنبيهات التتبع", zh: "追踪提醒" }, path: "/tracking-alerts", icon: AlertTriangle, keywords: "tracking alerts" },
      { label: { ku: "پاکێجی تەواو", en: "Full package", ar: "الباقة الكاملة", zh: "全包" }, path: "/full-package", icon: Package, keywords: "full package orders" },
      { label: { ku: "کڕین بە تێچوو", en: "Markup purchase", ar: "شراء بهامش ربح", zh: "加价采购" }, path: "/commission", icon: DollarSign, keywords: "commission markup orders عمولە" },
      { label: { ku: "سێلف ئۆردەر", en: "Self order", ar: "طلب ذاتي", zh: "自助下单" }, path: "/self-orders", icon: ShoppingBag, keywords: "self orders shipping" },
      { label: { ku: "فرۆشیارەکان", en: "Suppliers", ar: "الموردون", zh: "供应商" }, path: "/suppliers", icon: Building2, keywords: "suppliers vendors" },
      { label: { ku: "داشبۆردی یەکگرتوو", en: "Unified dashboard", ar: "لوحة موحدة", zh: "统一仪表板" }, path: "/unified-orders", icon: LayoutDashboard, keywords: "unified orders" },
    ],
  },
  {
    heading: { ku: "ئۆپەریشن", en: "Operations", ar: "العمليات", zh: "运营" },
    items: [
      { label: { ku: "هەموو پاکەتەکان", en: "All packages", ar: "كل الطرود", zh: "所有包裹" }, path: "/packages/all", icon: Package, keywords: "all packages list" },
      { label: { ku: "تۆماری کۆمەڵە", en: "Bulk register", ar: "تسجيل جماعي", zh: "批量登记" }, path: "/packages/bulk-register", icon: ClipboardList, keywords: "bulk register" },
      { label: { ku: "باچەکان", en: "Batches", ar: "الدفعات", zh: "批次" }, path: "/batches", icon: Layers, keywords: "batches" },
      { label: { ku: "پاکەتە بێ خاوەنەکان", en: "Unclaimed packages", ar: "طرود بلا مالك", zh: "无主包裹" }, path: "/packages/unclaimed", icon: AlertTriangle, keywords: "unclaimed packages" },
      { label: { ku: "داواکاری خاوەنداری", en: "Claim requests", ar: "طلبات المطالبة", zh: "认领请求" }, path: "/packages/claim-requests", icon: FileText, keywords: "claim requests" },
    ],
  },
  {
    heading: { ku: "سکان", en: "Scan", ar: "المسح", zh: "扫描" },
    items: [
      { label: { ku: "سکانی خێرا", en: "Quick scan", ar: "مسح سريع", zh: "快速扫描" }, path: "/quick-register", icon: QrCode, keywords: "quick scan register" },
      { label: { ku: "خستنە ناو باچ", en: "Batch assignment", ar: "تعيين الدفعة", zh: "分配批次" }, path: "/batch-assignment-scanner", icon: Boxes, keywords: "batch assignment scan" },
      { label: { ku: "پشکنینی گەیشتن", en: "Arrival verification", ar: "التحقق من الوصول", zh: "到货核验" }, path: "/arrival-verification-scanner", icon: Truck, keywords: "arrival verification scan" },
      { label: { ku: "داشبۆردی سکان", en: "Scan dashboard", ar: "لوحة المسح", zh: "扫描仪表板" }, path: "/scan-dashboard", icon: Activity, keywords: "scan dashboard" },
      { label: { ku: "ڕاپۆرتی سکان", en: "Scan reports", ar: "تقارير المسح", zh: "扫描报告" }, path: "/scan-reports", icon: BarChart3, keywords: "scan reports" },
    ],
  },
  {
    heading: { ku: "دارایی", en: "Finance", ar: "المالية", zh: "财务" },
    items: [
      { label: { ku: "بەڕێوەبردنی دارایی", en: "Finance management", ar: "إدارة المالية", zh: "财务管理" }, path: "/finance", icon: Wallet, keywords: "finance money" },
      { label: { ku: "پسووڵەکان", en: "Invoices", ar: "الفواتير", zh: "发票" }, path: "/invoices", icon: Receipt, keywords: "invoices" },
      { label: { ku: "ڕاپۆرتی قەرزداران", en: "Debtors report", ar: "تقرير المدينين", zh: "欠款人报告" }, path: "/finance/debtors", icon: Users, keywords: "debtors debt" },
      { label: { ku: "ڕێکخستنەکان", en: "Settings", ar: "الإعدادات", zh: "设置" }, path: "/settings", icon: Settings, keywords: "settings configuration" },
    ],
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * App-wide "find a function" palette. Open it from the top bar or with Ctrl/Cmd+K,
 * type any page/function name (Kurdish or English) and jump straight to it.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, navigate] = useLocation();
  const { language } = useTranslation();

  // Global Ctrl/Cmd+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={pickLang(language, { ku: "گەڕان بۆ فەنکشن یان پەڕە... (Ctrl+K)", en: "Search for a function or page... (Ctrl+K)", ar: "ابحث عن وظيفة أو صفحة... (Ctrl+K)", zh: "搜索功能或页面... (Ctrl+K)" })} />
      <CommandList>
        <CommandEmpty>{pickLang(language, { ku: "هیچ ئەنجامێک نەدۆزرایەوە", en: "No results found", ar: "لم يتم العثور على نتائج", zh: "未找到结果" })}</CommandEmpty>
        {GROUPS.map((group) => {
          const heading = pickLang(language, group.heading);
          return (
          <CommandGroup key={heading} heading={heading}>
            {group.items.map((item) => {
              const label = pickLang(language, item.label);
              return (
              <CommandItem
                key={item.path}
                value={`${label} ${item.keywords ?? ""}`}
                onSelect={() => go(item.path)}
                className="gap-2"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{label}</span>
              </CommandItem>
              );
            })}
          </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
