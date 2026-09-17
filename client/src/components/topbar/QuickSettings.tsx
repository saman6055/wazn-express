import { useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Moon, Rows3, SlidersHorizontal, Type, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppearanceDialog } from "@/components/AppearanceDialog";
import { LANGUAGES, useTranslation, type Language } from "@/contexts/LanguageContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme, type Accent } from "@/contexts/ThemeContext";
import { useDensity } from "@/hooks/useDensity";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * Quick settings, the way Windows 11 gathers them behind one button in the
 * system tray.
 *
 * Owner, 2026-09-17: seven bare icons sat in the top bar — dark mode, colour,
 * text, compact mode, full screen, language — and nobody could tell them
 * apart. They are one labelled button now, opening tiles that each say what
 * they do. Every choice applies at once and is kept for this browser, as
 * before.
 */

/** The colour themes (ThemeContext accents). */
export const ACCENTS: { id: Accent; swatch: string; label: Words }[] = [
  { id: "default", swatch: "oklch(0.50 0.13 220)", label: { ku: "بنەڕەت", en: "Default", ar: "افتراضي", zh: "默认" } },
  { id: "rose", swatch: "oklch(0.55 0.15 350)", label: { ku: "ڕۆز", en: "Rose", ar: "وردي", zh: "玫瑰" } },
  { id: "violet", swatch: "oklch(0.53 0.16 300)", label: { ku: "مۆر", en: "Violet", ar: "بنفسجي", zh: "紫罗兰" } },
  { id: "ocean", swatch: "oklch(0.52 0.15 245)", label: { ku: "ئۆقیانوس", en: "Ocean", ar: "محيط", zh: "海洋" } },
  { id: "amber", swatch: "oklch(0.58 0.13 65)", label: { ku: "گەرم", en: "Amber", ar: "كهرماني", zh: "琥珀" } },
];

const TXT = {
  button: { ku: "ڕێکخستن", en: "Settings", ar: "الإعدادات", zh: "设置" },
  title: { ku: "ڕێکخستنی خێرا", en: "Quick settings", ar: "إعدادات سريعة", zh: "快速设置" },
  dark: { ku: "دۆخی تاریک", en: "Dark mode", ar: "الوضع الداكن", zh: "深色模式" },
  compact: { ku: "دۆخی چڕ", en: "Compact rows", ar: "صفوف مضغوطة", zh: "紧凑行距" },
  fullScreen: { ku: "پڕ بە شاشە", en: "Full screen", ar: "ملء الشاشة", zh: "全屏" },
  colour: { ku: "ڕەنگی سیستەم", en: "Colour", ar: "اللون", zh: "颜色" },
  language: { ku: "زمان", en: "Language", ar: "اللغة", zh: "语言" },
  appearance: { ku: "ڕووکار و قەبارەی نووسین", en: "Text size and appearance", ar: "المظهر وحجم الخط", zh: "字体大小与外观" },
} as const;

function Tile({
  on,
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  on: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors",
        on ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-muted/40 text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}

export function QuickSettings({ fullScreen, onToggleFullScreen }: { fullScreen: boolean; onToggleFullScreen: () => void }) {
  const { language, isRTL } = useTranslation();
  const { setLanguage } = useLanguage();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const [compact, setCompact] = useDensity();
  const [open, setOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const L = (words: Words) => pickLang(language, words);
  const Onward = isRTL ? ChevronLeft : ChevronRight;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={L(TXT.title)}
            aria-label={L(TXT.title)}
            data-testid="quick-settings"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground xl:px-2.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden xl:inline">{L(TXT.button)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3" dir={isRTL ? "rtl" : "ltr"}>
          <p className="mb-2 text-sm font-bold">{L(TXT.title)}</p>

          <div className="grid grid-cols-3 gap-2">
            <Tile on={theme === "dark"} icon={Moon} label={L(TXT.dark)} onClick={() => toggleTheme?.()} testId="qs-dark" />
            <Tile on={compact} icon={Rows3} label={L(TXT.compact)} onClick={() => setCompact(!compact)} testId="qs-compact" />
            <Tile
              on={fullScreen}
              icon={Maximize2}
              label={L(TXT.fullScreen)}
              onClick={() => {
                setOpen(false);
                onToggleFullScreen();
              }}
              testId="qs-fullscreen"
            />
          </div>

          <p className="mb-1.5 mt-3 text-xs font-semibold text-muted-foreground">{L(TXT.colour)}</p>
          <div className="flex items-center gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccent(a.id)}
                aria-pressed={accent === a.id}
                title={L(a.label)}
                aria-label={L(a.label)}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                  accent === a.id ? "border-foreground" : "border-transparent",
                )}
                style={{ background: a.swatch }}
              />
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-xs font-semibold text-muted-foreground">{L(TXT.language)}</p>
          <div className="grid grid-cols-4 gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code as Language)}
                aria-pressed={language === l.code}
                className={cn(
                  "rounded-lg border px-1 py-1.5 text-xs font-semibold transition-colors",
                  language === l.code ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                )}
              >
                {l.nativeName}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setAppearanceOpen(true);
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Type className="h-4 w-4 text-primary" />
            {L(TXT.appearance)}
            <Onward className="ms-auto h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverContent>
      </Popover>

      <AppearanceDialog open={appearanceOpen} onOpenChange={setAppearanceOpen} hideTrigger />
    </>
  );
}
