import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, Boxes, ChevronLeft, ChevronRight, Home, LayoutGrid, LogOut, Moon, Package, Receipt, ScanLine, Search,
  ShoppingCart, Sun, Layers, Users, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useBackCloses } from "@/hooks/useBackCloses";
import CompanyLogo from "@/components/CompanyLogo";
import { SYSTEM_TITLE } from "@shared/appVariant";

/**
 * The office system on a phone, shaped like an app (owner, 2026-09-27):
 * «کردنەوەی سیستەم لە مۆبایل هێشتا وەکو دیسک تۆپە… وەکو ئەپی پۆرتال بێت».
 *
 * Below `md` DashboardLayout draws these instead of the rail, the drawer
 * and the desktop tool strip:
 *
 *  - MobileTopBar: the page's own name with a back arrow, or «سیستەم» on a
 *    tab's home; search, the two bells.
 *  - MobileTabBar: five places a thumb reaches — home, parcels, a raised
 *    scan button in the middle, batches, and «زیاتر».
 *  - the scan sheet: every scanning screen the person may open, big tiles.
 *  - the «زیاتر» sheet: every section of the menu as a grid of tiles,
 *    grouped as the menu groups them, with a filter on top, and the person's
 *    own corner (name, dark mode, sign out).
 *
 * The menu itself is the one the desktop uses, already filtered by
 * permission — nothing here decides who sees what.
 */

export interface ShellItem {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: number;
}
export interface ShellGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  items: ShellItem[];
}

type Words = { ku: string; en: string; ar: string; zh: string };
const W = {
  home: { ku: "سەرەکی", en: "Home", ar: "الرئيسية", zh: "首页" },
  parcels: { ku: "پاکەت", en: "Parcels", ar: "الطرود", zh: "包裹" },
  scan: { ku: "سکان", en: "Scan", ar: "مسح", zh: "扫描" },
  batches: { ku: "باچ", en: "Batches", ar: "الدفعات", zh: "批次" },
  more: { ku: "زیاتر", en: "More", ar: "المزيد", zh: "更多" },
  allSections: { ku: "هەموو بەشەکان", en: "All sections", ar: "كل الأقسام", zh: "全部功能" },
  scanning: { ku: "سکان و تۆمار", en: "Scan and register", ar: "المسح والتسجيل", zh: "扫描与登记" },
  filter: { ku: "بگەڕێ لە بەشەکان…", en: "Find a section…", ar: "ابحث عن قسم…", zh: "查找功能…" },
  none: { ku: "هیچ بەشێک بەم ناوە نییە", en: "No section by that name", ar: "لا يوجد قسم بهذا الاسم", zh: "没有此功能" },
  search: { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" },
  back: { ku: "گەڕانەوە", en: "Back", ar: "رجوع", zh: "返回" },
  close: { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" },
  dark: { ku: "دۆخی تاریک", en: "Dark mode", ar: "الوضع الداكن", zh: "深色模式" },
  light: { ku: "دۆخی ڕووناک", en: "Light mode", ar: "الوضع الفاتح", zh: "浅色模式" },
  signOut: { ku: "چوونەدەرەوە", en: "Sign out", ar: "تسجيل الخروج", zh: "退出" },
} satisfies Record<string, Words>;

/** The tabs, in the order a thumb meets them. The middle one is the scan button. */
export const MOBILE_TABS = [
  { key: "home", path: "/dashboard", icon: Home, words: W.home },
  { key: "parcels", path: "/packages/all", icon: Package, words: W.parcels },
  { key: "scan", path: null, icon: ScanLine, words: W.scan },
  { key: "batches", path: "/batches", icon: Layers, words: W.batches },
  { key: "more", path: null, icon: LayoutGrid, words: W.more },
] as const;

/** The pages a tab stands for: a tab's own page shows «سیستەم», not a back arrow. */
export const TAB_ROOTS = ["/dashboard", "/packages/all", "/batches"];

const TILE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
};
const tileTone = (color: string) => TILE[color] ?? TILE.slate;

const isActivePath = (location: string, path: string) => location === path || location.startsWith(path + "/");

/** The menu item a location belongs to — the longest path that matches. */
export function currentItem(groups: ShellGroup[], location: string): ShellItem | null {
  let best: ShellItem | null = null;
  for (const g of groups) {
    for (const item of g.items) {
      if (isActivePath(location, item.path) && (!best || item.path.length > best.path.length)) best = item;
    }
  }
  return best;
}

export function MobileTopBar({
  groups,
  location,
  language,
  isRTL,
  onBack,
  onSearch,
  bells,
}: {
  groups: ShellGroup[];
  location: string;
  language: string;
  isRTL: boolean;
  onBack: () => void;
  onSearch: () => void;
  /** The risk bell and the task bell, as the layout already builds them. */
  bells: ReactNode;
}) {
  const L = (w: Words) => pickLang(language, w);
  const atRoot = TAB_ROOTS.includes(location);
  const item = currentItem(groups, location);
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <header
      className="md:hidden fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur print:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      data-testid="mobile-topbar"
    >
      <div className="flex h-14 items-center gap-1.5 px-2">
        {atRoot ? (
          <span className="flex min-w-0 items-center gap-2 ps-1">
            <CompanyLogo size={30} iconClassName="h-4 w-4 text-white" fallbackBg="bg-emerald-600" />
            <span className="truncate text-lg font-bold">{SYSTEM_TITLE}</span>
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onBack}
              aria-label={L(W.back)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground active:bg-muted"
              data-testid="mobile-back"
            >
              <BackIcon className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <span className="min-w-0 truncate text-base font-bold">{item?.label ?? SYSTEM_TITLE}</span>
          </>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onSearch}
          aria-label={L(W.search)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground active:bg-muted"
          data-testid="mobile-search"
        >
          <Search className="h-5 w-5" />
        </button>
        {bells}
      </div>
    </header>
  );
}

export function MobileTabBar({
  location,
  language,
  canViewPath,
  onNavigate,
  onScan,
  onMore,
  sheet,
}: {
  location: string;
  language: string;
  canViewPath: (path: string) => boolean;
  onNavigate: (path: string) => void;
  onScan: () => void;
  onMore: () => void;
  /** Which sheet is up, so its tab reads as the current one. */
  sheet: "scan" | "more" | null;
}) {
  const L = (w: Words) => pickLang(language, w);
  // A tab whose page this person may not open is not drawn; the rest share the width.
  const tabs = MOBILE_TABS.filter((t) => !t.path || canViewPath(t.path));

  return (
    <nav
      // Over the sheets (z-55): the raised scan button reaches above the bar.
      className="md:hidden fixed inset-x-0 bottom-0 z-[56] border-t border-border bg-background/95 backdrop-blur print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="mobile-tabbar"
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active =
            t.key === "scan" ? sheet === "scan" : t.key === "more" ? sheet === "more" : !sheet && !!t.path && isActivePath(location, t.path);
          const onClick = t.key === "scan" ? onScan : t.key === "more" ? onMore : () => onNavigate(t.path!);
          if (t.key === "scan") {
            return (
              <button key={t.key} type="button" onClick={onClick} className="relative flex flex-col items-center justify-end pb-1.5" data-testid="mobile-tab-scan">
                <span
                  className={cn(
                    "absolute -top-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition active:scale-95",
                    active && "brightness-110",
                  )}
                >
                  <t.icon className="h-6 w-6" strokeWidth={2.4} />
                </span>
                <span className={cn("text-[11px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>{L(t.words)}</span>
              </button>
            );
          }
          return (
            <button
              key={t.key}
              type="button"
              onClick={onClick}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5 active:scale-95"
              data-testid={`mobile-tab-${t.key}`}
            >
              <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", active && "bg-primary/12 text-primary")}>
                <t.icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cn("text-[11px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>{L(t.words)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Tile({ item, tone, active, onOpen }: { item: ShellItem; tone: string; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "relative flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 text-center transition active:scale-[0.97]",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <span className={cn("grid h-10 w-10 place-items-center rounded-xl", tone)}>
        <item.icon className="h-5 w-5" />
      </span>
      <span className="line-clamp-2 text-[12px] font-semibold leading-tight">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="absolute end-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </button>
  );
}

function SheetFrame({ title, language, onClose, children, testId }: { title: string; language: string; onClose: () => void; children: ReactNode; testId: string }) {
  return (
    // Above the page and its top bar, but not over the tab bar: the tab that
    // opened it stays lit underneath, and tapping it again puts it away.
    <div
      className="md:hidden fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[55] flex flex-col bg-background print:hidden"
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3" style={{ marginTop: "env(safe-area-inset-top)" }}>
        <span className="flex-1 truncate text-lg font-bold">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={pickLang(language, W.close)}
          className="grid h-10 w-10 place-items-center rounded-full active:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3">{children}</div>
    </div>
  );
}

export function MobileScanSheet({
  groups,
  location,
  language,
  onNavigate,
  onClose,
}: {
  groups: ShellGroup[];
  location: string;
  language: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const scanning = groups.find((g) => g.id === "scanning");
  const items = scanning?.items ?? [];
  return (
    <SheetFrame title={pickLang(language, W.scanning)} language={language} onClose={onClose} testId="mobile-scan-sheet">
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item) => (
          <Tile key={item.path} item={item} tone={tileTone(scanning?.color ?? "cyan")} active={isActivePath(location, item.path)} onOpen={() => onNavigate(item.path)} />
        ))}
      </div>
    </SheetFrame>
  );
}

export function MobileMoreSheet({
  groups,
  location,
  language,
  userName,
  userRoleLabel,
  isDark,
  onToggleTheme,
  onSignOut,
  onNavigate,
  onClose,
}: {
  groups: ShellGroup[];
  location: string;
  language: string;
  userName: string;
  userRoleLabel: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const L = (w: Words) => pickLang(language, w);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(needle) || g.title.toLowerCase().includes(needle)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  return (
    <SheetFrame title={L(W.allSections)} language={language} onClose={onClose} testId="mobile-more-sheet">
      {/* The person, and the two things everybody reaches for. */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-base font-bold text-white">
          {(userName || "?").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{userName}</span>
          <span className="block truncate text-xs text-muted-foreground">{userRoleLabel}</span>
        </span>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? L(W.light) : L(W.dark)}
          className="grid h-10 w-10 place-items-center rounded-full border border-border active:bg-muted"
        >
          {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          aria-label={L(W.signOut)}
          className="grid h-10 w-10 place-items-center rounded-full border border-border text-red-600 active:bg-muted dark:text-red-400"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={L(W.filter)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          data-testid="mobile-more-filter"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={L(W.close)} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {shown.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{L(W.none)}</p>}

      <div className="space-y-4">
        {shown.map((g) => (
          <section key={g.id}>
            <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-muted-foreground">
              <g.icon className="h-4 w-4" />
              {g.title}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((item) => (
                <Tile key={item.path} item={item} tone={tileTone(g.color)} active={isActivePath(location, item.path)} onOpen={() => onNavigate(item.path)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SheetFrame>
  );
}

/**
 * Which sheet is up, as one step in the phone's history: Back closes it and
 * leaves the page where it was ([[back-button-one-step]]).
 */
export function useMobileSheet(navigate: (path: string) => void) {
  const [sheet, setSheet] = useState<"scan" | "more" | null>(null);
  useBackCloses(sheet !== null, () => setSheet(null));
  const leaving = useRef(0);

  /**
   * Going somewhere from a sheet. Closing the sheet takes its history step
   * back; navigating in the same moment would be undone by that step. So the
   * sheet closes first and the page opens once the step is gone — the same
   * order the portal's parcel sheet uses (PortalParcelSheet `leave`).
   */
  const go = useCallback(
    (path: string) => {
      if (sheet === null) {
        navigate(path);
        return;
      }
      const open = () => {
        window.removeEventListener("popstate", open);
        window.clearTimeout(leaving.current);
        navigate(path);
      };
      window.addEventListener("popstate", open);
      leaving.current = window.setTimeout(open, 400);
      setSheet(null);
    },
    [navigate, sheet],
  );

  return { sheet, setSheet, go };
}

const QUICK = [
  { path: "/quick-register", icon: ScanLine, tone: "emerald", words: { ku: "تۆماری خێرا", en: "Quick register", ar: "تسجيل سريع", zh: "快速登记" } },
  { path: "/customer-delivery-scanner", icon: Package, tone: "blue", words: { ku: "گەیاندن", en: "Delivery", ar: "التسليم", zh: "派送" } },
  { path: "/customers", icon: Users, tone: "violet", words: { ku: "کڕیاران", en: "Customers", ar: "العملاء", zh: "客户" } },
  { path: "/finance", icon: Wallet, tone: "amber", words: { ku: "دارایی", en: "Finance", ar: "المالية", zh: "财务" } },
  { path: "/commission", icon: ShoppingCart, tone: "orange", words: { ku: "کڕین بە تێچوو", en: "Buy at cost", ar: "شراء بالتكلفة", zh: "代购" } },
  { path: "/full-package", icon: Boxes, tone: "cyan", words: { ku: "پاکێجی تەواو", en: "Full package", ar: "الباقة الكاملة", zh: "全包" } },
  { path: "/company/expenses", icon: Receipt, tone: "rose", words: { ku: "خەرجی", en: "Expenses", ar: "المصاريف", zh: "支出" } },
  { path: "/reports", icon: BarChart3, tone: "indigo", words: { ku: "ڕاپۆرت", en: "Reports", ar: "التقارير", zh: "报表" } },
] as const;

/**
 * The dashboard's first row on a phone: the eight jobs the office does all
 * day, one tap each, before any figure (the mockup the owner approved,
 * 2026-09-27). Pages the person may not open are left out. Hidden from md up,
 * where the rail and the pinned pages already do this.
 */
export function MobileQuickActions({
  language,
  canViewPath,
  onNavigate,
}: {
  language: string;
  canViewPath: (path: string) => boolean;
  onNavigate: (path: string) => void;
}) {
  const items = QUICK.filter((q) => canViewPath(q.path));
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-2 md:hidden" data-testid="mobile-quick-actions">
      {items.map((q) => (
        <button
          key={q.path}
          type="button"
          onClick={() => onNavigate(q.path)}
          className="flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card p-1.5 text-center transition active:scale-[0.97]"
        >
          <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tileTone(q.tone))}>
            <q.icon className="h-[18px] w-[18px]" />
          </span>
          <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{pickLang(language, q.words)}</span>
        </button>
      ))}
    </div>
  );
}
