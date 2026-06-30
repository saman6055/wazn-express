import { useEffect } from "react";
import { useLocation } from "wouter";
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

interface Dest {
  label: string;
  path: string;
  icon: LucideIcon;
  keywords?: string;
}

// One flat, searchable map of everywhere you can go. Keywords carry the
// English/alternate terms so searching "commission", "batch", "scan" etc.
// finds the Kurdish-labelled destination.
const GROUPS: { heading: string; items: Dest[] }[] = [
  {
    heading: "خێرا",
    items: [
      { label: "تۆماری خێرا", path: "/packages/quick-register", icon: Truck, keywords: "quick register package تۆمار" },
      { label: "کڕینی نوێ بە خستنەسەر", path: "/commission/new", icon: PlusCircle, keywords: "new commission markup order عمولە" },
      { label: "پاکێجی تەواوی نوێ", path: "/full-package/new", icon: PlusCircle, keywords: "new full package order" },
      { label: "گەیاندن بە کڕیار", path: "/customer-delivery-scanner", icon: CreditCard, keywords: "delivery scan customer" },
    ],
  },
  {
    heading: "سەرەکی",
    items: [
      { label: "داشبۆرد", path: "/dashboard", icon: LayoutDashboard, keywords: "dashboard home" },
      { label: "کڕیارەکان", path: "/customers", icon: Users, keywords: "customers clients" },
      { label: "پەیامەکانی کڕیار", path: "/customer-messages", icon: MessageCircle, keywords: "messages chat" },
    ],
  },
  {
    heading: "پاکێجەکان",
    items: [
      { label: "ئاگاداری تراکینگ", path: "/tracking-alerts", icon: AlertTriangle, keywords: "tracking alerts" },
      { label: "پاکێجی تەواو", path: "/full-package", icon: Package, keywords: "full package orders" },
      { label: "کڕین بە خستنەسەر", path: "/commission", icon: DollarSign, keywords: "commission markup orders عمولە" },
      { label: "سێلف ئۆردەر", path: "/self-orders", icon: ShoppingBag, keywords: "self orders shipping" },
      { label: "فرۆشیارەکان", path: "/suppliers", icon: Building2, keywords: "suppliers vendors" },
      { label: "داشبۆردی یەکگرتوو", path: "/unified-orders", icon: LayoutDashboard, keywords: "unified orders" },
    ],
  },
  {
    heading: "ئۆپەریشن",
    items: [
      { label: "هەموو پاکەتەکان", path: "/packages/all", icon: Package, keywords: "all packages list" },
      { label: "تۆماری کۆمەڵە", path: "/packages/bulk-register", icon: ClipboardList, keywords: "bulk register" },
      { label: "باچەکان", path: "/batches", icon: Layers, keywords: "batches" },
      { label: "پاکەتە بێ خاوەنەکان", path: "/packages/unclaimed", icon: AlertTriangle, keywords: "unclaimed packages" },
      { label: "داواکاری خاوەنداری", path: "/packages/claim-requests", icon: FileText, keywords: "claim requests" },
    ],
  },
  {
    heading: "سکان",
    items: [
      { label: "سکانی خێرا", path: "/quick-register", icon: QrCode, keywords: "quick scan register" },
      { label: "خستنە ناو باچ", path: "/batch-assignment-scanner", icon: Boxes, keywords: "batch assignment scan" },
      { label: "پشکنینی گەیشتن", path: "/arrival-verification-scanner", icon: Truck, keywords: "arrival verification scan" },
      { label: "داشبۆردی سکان", path: "/scan-dashboard", icon: Activity, keywords: "scan dashboard" },
      { label: "ڕاپۆرتی سکان", path: "/scan-reports", icon: BarChart3, keywords: "scan reports" },
    ],
  },
  {
    heading: "دارایی",
    items: [
      { label: "بەڕێوەبردنی دارایی", path: "/finance", icon: Wallet, keywords: "finance money" },
      { label: "پسووڵەکان", path: "/invoices", icon: Receipt, keywords: "invoices" },
      { label: "ڕاپۆرتی قەرزداران", path: "/finance/debtors", icon: Users, keywords: "debtors debt" },
      { label: "ڕێکخستنەکان", path: "/settings", icon: Settings, keywords: "settings configuration" },
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
      <CommandInput placeholder="گەڕان بۆ فەنکشن یان پەڕە... (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>هیچ ئەنجامێک نەدۆزرایەوە</CommandEmpty>
        {GROUPS.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.items.map((item) => (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords ?? ""}`}
                onSelect={() => go(item.path)}
                className="gap-2"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
