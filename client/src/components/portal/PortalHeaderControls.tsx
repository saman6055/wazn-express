import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, LANGUAGES, type Language } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import {
  PORTAL_MODES,
  PORTAL_MODE_KEY,
  DEFAULT_PORTAL_MODE,
  modeDef,
  modeFromTheme,
  isLightHeader,
  type PortalMode,
} from "@/lib/portalModes";
import { formatClockTime, formatClockDate, msUntilNextMinute, CLOCK_HOUR12_KEY } from "@/lib/portalClock";
import { Languages, Check } from "lucide-react";

/**
 * The colour mode currently in force, kept in sync with the theme context.
 *
 * Theme and accent are stored separately because the admin side shares them,
 * so on load the mode is read back out of that pair rather than trusted from
 * its own key alone — otherwise a mode changed elsewhere would show the wrong
 * dot as selected.
 */
export function usePortalMode(): [PortalMode, (m: PortalMode) => void] {
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [mode, setModeState] = useState<PortalMode>(() => {
    const stored = localStorage.getItem(PORTAL_MODE_KEY) as PortalMode | null;
    return stored ?? DEFAULT_PORTAL_MODE;
  });

  // Apply the saved mode once on mount, so a returning customer lands in the
  // colours they left in rather than the app default.
  useEffect(() => {
    const def = modeDef(mode);
    setTheme(def.theme);
    setAccent(def.accent);
    // Deliberately mount-only: later changes go through setMode below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setModeState(modeFromTheme(theme, accent));
  }, [theme, accent]);

  const setMode = (next: PortalMode) => {
    const def = modeDef(next);
    setModeState(next);
    setTheme(def.theme);
    setAccent(def.accent);
    localStorage.setItem(PORTAL_MODE_KEY, next);
  };

  return [mode, setMode];
}

/**
 * Colour modes, language, and a live clock — the strip that sits along the top
 * of every portal skin.
 *
 * `onLight` is for skins whose header is a pale surface: the glass panels flip
 * from white-on-colour to dark-on-light so the controls stay legible.
 */
export function PortalHeaderControls({
  onLight,
  showClock,
  className,
}: {
  onLight?: boolean;
  /** Skins with no banner of their own carry the clock inside this strip. */
  showClock?: boolean;
  className?: string;
}) {
  const { language, setLanguage } = useLanguage();
  const [mode, setMode] = usePortalMode();
  const [langOpen, setLangOpen] = useState(false);

  const light = onLight ?? isLightHeader(mode);

  const glass = light
    ? "bg-slate-900/[0.06] border-slate-900/10 text-slate-800"
    : "bg-white/10 border-white/20 text-white";

  const current = LANGUAGES.find((l) => l.code === language);

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {/* Colour modes */}
      <div className={cn("flex items-center gap-1.5 rounded-full border px-2 py-1.5 backdrop-blur-sm", glass)}>
        {PORTAL_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            aria-label={pickLang(language, m.label)}
            title={pickLang(language, m.label)}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-transform duration-200 active:scale-90",
              mode === m.id
                ? light ? "border-slate-800 scale-110" : "border-white scale-110"
                : "border-transparent opacity-80 hover:opacity-100",
            )}
            style={{ backgroundImage: `linear-gradient(135deg, ${m.swatch[0]}, ${m.swatch[1]})` }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        {showClock && <PortalClock onLight={light} compact />}

        {/* Language */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition active:scale-95",
              glass,
            )}
          >
            <Languages className="h-3.5 w-3.5" />
            {current?.nativeName ?? language}
          </button>

          {langOpen && (
            <>
              {/* Tap-away layer — a dropdown with no way out is worse than none. */}
              <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
              <div className="absolute end-0 z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLanguage(l.code as Language);
                      setLangOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800",
                      language === l.code && "font-semibold",
                    )}
                  >
                    <span>{l.flag}</span>
                    <span className="flex-1 text-start">{l.nativeName}</span>
                    {language === l.code && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The clock block. Separate so a skin can place it away from the controls. */
export function PortalClock({
  onLight,
  compact,
  className,
}: {
  onLight?: boolean;
  /** One line instead of two, for sitting inside the controls strip. */
  compact?: boolean;
  className?: string;
}) {
  const { language } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  // Tapping the clock switches between 12- and 24-hour, and the choice sticks.
  const [hour12, setHour12] = useState(
    () => localStorage.getItem(CLOCK_HOUR12_KEY) === "true",
  );

  const toggleHour12 = () => {
    setHour12((prev) => {
      localStorage.setItem(CLOCK_HOUR12_KEY, String(!prev));
      return !prev;
    });
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextMinute(new Date()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const surface = onLight
    ? "border-slate-900/10 bg-slate-900/[0.06] text-slate-800"
    : "border-white/20 bg-white/10 text-white";

  const hint = pickLang(language, {
    ku: "کلیک بکە بۆ گۆڕینی 12 / 24 کاتژمێری",
    en: "Tap to switch between 12- and 24-hour",
    ar: "اضغط للتبديل بين 12 و24 ساعة",
    zh: "点击切换 12 / 24 小时制",
  });

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleHour12}
        title={`${formatClockDate(now, language)} — ${hint}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-sm transition active:scale-95",
          surface,
          className,
        )}
      >
        <span className="text-xs font-bold tabular-nums">{formatClockTime(now, language, hour12)}</span>
        {/* Short enough now to keep on a phone too — it was the spelled-out
            month that forced it to hide on narrow screens. */}
        <span className="text-[10px] opacity-75">{formatClockDate(now, language)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleHour12}
      title={hint}
      className={cn(
        "rounded-2xl border px-3 py-2 text-center backdrop-blur-sm transition active:scale-95",
        surface,
        className,
      )}
    >
      <p className="text-xl font-bold leading-none tabular-nums tracking-wide">
        {formatClockTime(now, language, hour12)}
      </p>
      <p className="mt-1 text-[10px] leading-none opacity-75">
        {formatClockDate(now, language)}
      </p>
    </button>
  );
}
