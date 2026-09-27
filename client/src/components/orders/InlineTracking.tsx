import { useEffect, useRef } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { pickLang } from "@/lib/lang";
import { orderTrackingWarnings } from "@shared/orderTrackingSanity";

/**
 * A tracking number typed straight into the row it belongs to.
 *
 * The owner, 2026-09-27: «لێرەش بە دوو کلیک لە شوێنی تراک بتوانی تراک زیاد
 * بکەی». The list already shows which orders are waiting for one; leaving
 * it to type the number somewhere else is the part that made it a chore.
 *
 * Enter saves, Escape gives up, and the same length check the order forms
 * run says so when a shop order number has been pasted into the tracking
 * box — a warning, never a refusal, because a strange but real number must
 * still be savable (shared/orderTrackingSanity).
 */
export function InlineTracking({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  orderNumber,
  language,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  orderNumber?: string | null;
  language: string;
}) {
  const box = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);

  const warnings = orderTrackingWarnings(orderNumber ?? null, value);
  const suspect = warnings.includes("trackingLooksLikeOrder") || warnings.includes("trackingTooShort");

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <Input
          ref={box}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          dir="ltr"
          className="h-8 w-40 font-mono text-xs"
          placeholder={pickLang(language, { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "运单号" })}
          data-testid="inline-tracking-input"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim() || saving}
          className="grid h-7 w-7 place-items-center rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 dark:hover:bg-emerald-950/40"
          title={pickLang(language, { ku: "پاشەکەوت", en: "Save", ar: "حفظ", zh: "保存" })}
          data-testid="inline-tracking-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          title={pickLang(language, { ku: "پاشگەزبوونەوە", en: "Cancel", ar: "إلغاء", zh: "取消" })}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {suspect && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {pickLang(language, {
            ku: "ئەمە لە ژمارەی ئۆردەر دەچێت — دڵنیایت تراکینگە؟",
            en: "That looks like an order number — sure it is a tracking?",
            ar: "يبدو أنه رقم طلب — هل أنت متأكد أنه تتبع؟",
            zh: "这看起来像订单号——确定是运单号吗？",
          })}
        </p>
      )}
    </div>
  );
}
