/**
 * Under a money row's date: when it was typed in on a later day, that day and
 * who typed it (owner, 2026-11-12: «پارەدان: 08/11 · تۆمارکرا: 12/11 ·
 * Administrator»). Nothing when it was entered the day it is dated.
 */
import { enteredLater, shortDay } from "@shared/paidOn";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";

export function EnteredLater({ createdAt, enteredAt, byName, className }: {
  createdAt: Date | string | null | undefined;
  enteredAt: Date | string | null | undefined;
  byName?: string | null;
  className?: string;
}) {
  const { language } = useTranslation();
  if (!enteredLater(createdAt, enteredAt)) return null;
  const paid = pickLang(language, { ku: "پارەدان", en: "Paid", ar: "الدفع", zh: "付款" });
  const entered = pickLang(language, { ku: "تۆمارکرا", en: "Entered", ar: "أُدخل", zh: "录入" });
  return (
    <div className={className ?? "text-[11px] text-amber-700 dark:text-amber-300 leading-tight mt-0.5"}>
      <bdi>{paid}: <span dir="ltr">{shortDay(createdAt!)}</span> · {entered}: <span dir="ltr">{shortDay(enteredAt!)}</span>{byName ? ` · ${byName}` : ""}</bdi>
    </div>
  );
}
