import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

/**
 * A small "how does this work?" link that drops the customer into the
 * tutorials for one section. Put it next to anything a first-time customer
 * hesitates over — the video is one tap away and they never leave the portal.
 */
export function TutorialHint({ section, className }: { section?: string; className?: string }) {
  const { language } = useLanguage();
  const href = section ? `/portal/tutorials?s=${encodeURIComponent(section)}` : "/portal/tutorials";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 transition active:scale-95 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
        className,
      )}
    >
      <GraduationCap className="h-3.5 w-3.5" />
      {pickLang(language, {
        ku: "چۆن؟ سەیری فێرکاری بکە",
        en: "How? Watch the tutorial",
        ar: "كيف؟ شاهد الشرح",
        zh: "怎么做？观看教程",
      })}
    </Link>
  );
}
