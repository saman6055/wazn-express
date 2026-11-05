import { useEffect, useState } from "react";
import { Banknote, Building2, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";

/**
 * Where the box's money went (owner, 2026-11-05: «تەنها بە یەک کلیک دیاری
 * بکرێت پارەکە چووەتە کوێ»): cash, FIB or Qi Card. Sent as the payment's
 * method, so the money received can be read by place and checked against
 * each app. Qi Card is the CARD method. The last choice is remembered on
 * this device; cash when nothing is.
 */
export type MoneyChannel = "CASH" | "FIB" | "CARD";

const KEY = "wazn-money-channel";

function remembered(): MoneyChannel {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "CASH" || v === "FIB" || v === "CARD") return v;
  } catch { /* private window */ }
  return "CASH";
}

export function useMoneyChannel(): [MoneyChannel, (c: MoneyChannel) => void] {
  const [channel, setChannel] = useState<MoneyChannel>(() => remembered());
  useEffect(() => {
    try { localStorage.setItem(KEY, channel); } catch { /* private window */ }
  }, [channel]);
  return [channel, setChannel];
}

export function MoneyChannelPicker({ value, onChange }: { value: MoneyChannel; onChange: (c: MoneyChannel) => void }) {
  const { language } = useLanguage();
  const options: Array<{ id: MoneyChannel; label: string; Icon: typeof Banknote }> = [
    { id: "CASH", label: pickLang(language, { ku: "کاش", en: "Cash", ar: "نقد", zh: "现金" }), Icon: Banknote },
    { id: "FIB", label: "FIB", Icon: Building2 },
    { id: "CARD", label: "Qi Card", Icon: CreditCard },
  ];
  return (
    <div className="space-y-1" data-testid="money-channel">
      <span className="text-xs text-muted-foreground">
        {pickLang(language, { ku: "پارەکە چووە کوێ؟", en: "Where did the money go?", ar: "أين ذهب المال؟", zh: "款项去向？" })}
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            data-testid={`money-channel-${id}`}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-md border text-sm transition-colors",
              value === id
                ? "border-sky-500 bg-sky-50 font-semibold text-sky-800 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200"
                : "border-border hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
