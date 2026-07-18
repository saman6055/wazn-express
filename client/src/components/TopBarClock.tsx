import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

type ClockFormat = "12" | "24";
const STORAGE_KEY = "topbar.clockFormat";

// Preferred Intl locales per app language, each with fallbacks so the date
// still renders on browsers that don't ship the primary tag (e.g. Sorani).
const LOCALES: Record<string, string[]> = {
  ku: ["ckb-IQ", "ku", "en-GB"],
  ar: ["ar-IQ", "ar"],
  en: ["en-GB"],
  zh: ["zh-CN"],
};

/**
 * Live clock + date for the top bar. The time is read straight from the
 * device (`new Date()`), so it is inherently "global" — it shows the correct
 * local wall-clock time wherever the app is opened, following the viewer's
 * own timezone. Staff can switch between 12-hour (AM/PM) and 24-hour display;
 * the choice persists in localStorage.
 */
export function TopBarClock({ className }: { className?: string }) {
  const { language } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const [format, setFormat] = useState<ClockFormat>(() => {
    if (typeof window === "undefined") return "24";
    return localStorage.getItem(STORAGE_KEY) === "12" ? "12" : "24";
  });

  // Tick every second. Cleared on unmount so no stray timers linger.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const setAndStore = (f: ClockFormat) => {
    setFormat(f);
    try {
      localStorage.setItem(STORAGE_KEY, f);
    } catch {
      /* private mode / storage disabled — display still works */
    }
  };

  const locale = LOCALES[language] || ["en-GB"];
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: format === "12",
  }).format(now);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(now);
  // Short timezone label (e.g. "GMT+3") makes the "follows your location"
  // behaviour visible at a glance.
  const tz =
    new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={pickLang(language, {
            ku: "کات و بەروار — کلیک بۆ گۆڕینی ١٢/٢٤ سەعات",
            en: "Time & date — click to switch 12/24-hour",
            ar: "الوقت والتاريخ — انقر للتبديل بين 12/24 ساعة",
            zh: "时间和日期 — 点击切换 12/24 小时制",
          })}
          className={cn(
            "group flex items-center gap-2 rounded-xl border border-transparent px-2.5 h-9 transition-colors",
            "hover:border-gray-200 dark:hover:border-gray-700 hover:bg-muted/50",
            className
          )}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span
              className="font-mono text-sm font-bold tabular-nums tracking-tight text-foreground"
              dir="ltr"
            >
              {time}
            </span>
            <span className="mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
              {date}
              {tz ? ` · ${tz}` : ""}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48">
        <DropdownMenuLabel>
          {pickLang(language, {
            ku: "شێوازی کات",
            en: "Time format",
            ar: "تنسيق الوقت",
            zh: "时间格式",
          })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={format}
          onValueChange={(v) => setAndStore(v as ClockFormat)}
        >
          <DropdownMenuRadioItem value="12">
            {pickLang(language, {
              ku: "١٢ سەعاتی (AM/PM)",
              en: "12-hour (AM/PM)",
              ar: "12 ساعة (ص/م)",
              zh: "12 小时制 (AM/PM)",
            })}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="24">
            {pickLang(language, {
              ku: "٢٤ سەعاتی",
              en: "24-hour",
              ar: "24 ساعة",
              zh: "24 小时制",
            })}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
