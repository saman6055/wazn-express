import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { displayDateValue, parseDateShortcut } from "@/lib/entry/dateShortcuts";

interface DateShortcutInputProps {
  /** YYYY-MM-DD, or "" — the same value a date box holds. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

/**
 * A date box that takes shortcuts: t (today), y (yesterday), +2, -7, or a
 * date written 28/07/2026. Enter or leaving the box turns it into the date.
 * It holds the same YYYY-MM-DD a date box holds, so it can stand in for one
 * without changing what is saved. Text that is not a date is kept, marked,
 * and never guessed at.
 */
export function DateShortcutInput({ value, onChange, id, className }: DateShortcutInputProps) {
  const { language } = useTranslation();
  const [text, setText] = useState(displayDateValue(value));
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    setText(displayDateValue(value));
    setWrong(false);
  }, [value]);

  const commit = () => {
    if (text.trim() === "") {
      setWrong(false);
      if (value) onChange("");
      return;
    }
    const date = parseDateShortcut(text);
    if (!date) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setText(displayDateValue(date));
    if (date !== value) onChange(date);
  };

  const hint = wrong
    ? pickLang(language, {
        ku: "ئەمە بەروار نییە — وەک 28/07/2026 بینووسە",
        en: "Not a date — write it like 28/07/2026",
        ar: "ليس تاريخًا — اكتبه هكذا 28/07/2026",
        zh: "不是日期——请写成 28/07/2026",
      })
    : pickLang(language, {
        ku: "t ئەمڕۆ · y دوێنێ · +2 دوو ڕۆژ دواتر",
        en: "t today · y yesterday · +2 in two days",
        ar: "t اليوم · y أمس · +2 بعد يومين",
        zh: "t 今天 · y 昨天 · +2 两天后",
      });

  return (
    <div className={className}>
      <Input
        id={id}
        value={text}
        dir="ltr"
        placeholder="dd/mm/yyyy"
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setWrong(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        aria-invalid={wrong || undefined}
        className={cn("tabular-nums", wrong && "border-destructive")}
        // Enter turns the shortcut into a date here; FastEntry's Enter-to-next stays off this box.
        data-no-fast=""
      />
      <p className={cn("mt-1 text-xs", wrong ? "text-destructive" : "text-muted-foreground")}>{hint}</p>
    </div>
  );
}
