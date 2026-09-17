import { Search } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * The search box at the start of the bar, where Windows 11 keeps its own:
 * every page, tracking number, box and customer (Ctrl+K opens the same hub).
 * A labelled pill rather than a bare magnifier — the owner's rule that an icon
 * on its own tells nobody what it does.
 */
export function TopBarSearch({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const { language } = useTranslation();
  const label = pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" });
  const hint = pickLang(language, {
    ku: "گەڕان بۆ بەش، تراکینگ، بۆکس یان کڕیار (Ctrl+K)",
    en: "Search pages, tracking, boxes or customers (Ctrl+K)",
    ar: "ابحث عن صفحة أو تتبع أو صندوق أو عميل (Ctrl+K)",
    zh: "搜索页面、运单、箱子或客户 (Ctrl+K)",
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      title={hint}
      aria-label={hint}
      data-testid="topbar-search"
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background/70 ps-1.5 pe-1.5 text-[13px] font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground xl:pe-2.5 dark:bg-white/5",
        className,
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Search className="h-3.5 w-3.5" />
      </span>
      <span className="hidden xl:inline">{label}</span>
      <kbd dir="ltr" className="hidden rounded border border-border px-1 font-mono text-[10px] font-normal xl:inline">
        Ctrl K
      </kbd>
    </button>
  );
}
