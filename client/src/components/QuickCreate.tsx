import { Plus, Package, DollarSign, Truck, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

// A compact "+ New" menu in the top bar for the most common create actions —
// pure navigation to existing routes, no logic. Localised to all 4 languages.
export function QuickCreate() {
  const [, setLocation] = useLocation();
  const { language } = useTranslation();

  const items = [
    { icon: Package, path: "/full-package/new", label: { ku: "پاکێجی تەواوی نوێ", en: "New full package", ar: "باقة كاملة جديدة", zh: "新建全包订单" } },
    { icon: DollarSign, path: "/commission/new", label: { ku: "کڕینی نوێ بە تێچوو", en: "New buy-at-cost order", ar: "طلب شراء بالتكلفة جديد", zh: "新建代购订单" } },
    { icon: Truck, path: "/packages/quick-register", label: { ku: "تۆماری خێرا", en: "Quick register", ar: "تسجيل سريع", zh: "快速登记" } },
    { icon: CreditCard, path: "/customer-delivery-scanner", label: { ku: "گەیاندن بە کڕیار", en: "Customer delivery", ar: "التسليم للعميل", zh: "客户交付" } },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8 gap-1 px-2.5" title={pickLang(language, { ku: "دروستکردنی نوێ", en: "Create new", ar: "إنشاء جديد", zh: "新建" })}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{pickLang(language, { ku: "نوێ", en: "New", ar: "جديد", zh: "新建" })}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{pickLang(language, { ku: "دروستکردنی خێرا", en: "Quick create", ar: "إنشاء سريع", zh: "快速创建" })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((it) => (
          <DropdownMenuItem key={it.path} onClick={() => setLocation(it.path)} className="cursor-pointer gap-2 rounded-lg">
            <it.icon className="h-4 w-4 text-muted-foreground" />
            <span>{pickLang(language, it.label)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
