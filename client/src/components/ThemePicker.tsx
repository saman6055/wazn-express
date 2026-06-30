import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme, type Accent } from "@/contexts/ThemeContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Lang = "ku" | "en" | "ar" | "zh";

const TITLE: Record<Lang, string> = { ku: "ڕووکار", en: "Theme", ar: "السمة", zh: "主题" };

const ACCENTS: { id: Accent; swatch: string; label: Record<Lang, string> }[] = [
  { id: "default", swatch: "oklch(0.50 0.13 220)", label: { ku: "بنەڕەت", en: "Default", ar: "افتراضي", zh: "默认" } },
  { id: "rose", swatch: "oklch(0.55 0.15 350)", label: { ku: "🌸 ڕۆز", en: "🌸 Rose", ar: "🌸 وردي", zh: "🌸 玫瑰" } },
  { id: "violet", swatch: "oklch(0.53 0.16 300)", label: { ku: "💜 مۆر", en: "💜 Violet", ar: "💜 بنفسجي", zh: "💜 紫罗兰" } },
  { id: "ocean", swatch: "oklch(0.52 0.15 245)", label: { ku: "🔵 ئۆقیانوس", en: "🔵 Ocean", ar: "🔵 محيط", zh: "🔵 海洋" } },
  { id: "amber", swatch: "oklch(0.58 0.13 65)", label: { ku: "🧡 گەرم", en: "🧡 Amber", ar: "🧡 كهرماني", zh: "🧡 琥珀" } },
];

export function ThemePicker() {
  const { accent, setAccent } = useTheme();
  const { language } = useTranslation();
  const lang: Lang = (["ku", "en", "ar", "zh"].includes(language) ? language : "ku") as Lang;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title={TITLE[lang]} aria-label={TITLE[lang]}>
          <Palette className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{TITLE[lang]}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCENTS.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => setAccent(a.id)} className="cursor-pointer gap-2 rounded-lg">
            <span className="h-4 w-4 rounded-full border border-black/10 dark:border-white/15" style={{ background: a.swatch }} />
            <span className="flex-1">{a.label[lang]}</span>
            {accent === a.id && <Check className={cn("h-4 w-4 text-emerald-600 dark:text-emerald-400")} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
