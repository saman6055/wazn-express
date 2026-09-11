import { ClipboardCopy, Eye, EyeOff, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { copyText } from "@/lib/copyText";
import { openExternal } from "@/lib/html";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/entry/messages";
import { usePrivacyMode, usePrivacyShortcut } from "@/hooks/entry/usePrivacyMode";

/**
 * Small pieces for the warehouse and the counter. Each is used only where a
 * screen places it; none changes anything by being here.
 */

interface LiveCounterHudProps {
  count: number;
  target?: number | null;
  label: string;
  /** The last code scanned, shown small underneath. */
  last?: string | null;
  className?: string;
}

/**
 * A counter that stays on screen while cartons go into a box or a batch: how
 * many so far, of how many, and the last one. A screen reader reads it as it
 * changes; it never covers the page's own buttons (it takes no clicks).
 */
export function LiveCounterHud({ count, target, label, last, className }: LiveCounterHudProps) {
  const done = target != null && target > 0 && count >= target;
  const percent = target && target > 0 ? Math.min(100, Math.round((count / target) * 100)) : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] end-4 z-40 min-w-40 rounded-xl border bg-card/95 px-4 py-3 shadow-lg backdrop-blur",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-3xl font-bold tabular-nums", done && "text-emerald-600 dark:text-emerald-400")} dir="ltr">
        {count}
        {target ? <span className="text-lg font-semibold text-muted-foreground"> / {target}</span> : null}
      </p>
      {percent !== null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className={cn("h-full rounded-full bg-primary", done && "bg-emerald-500")} style={{ width: `${percent}%` }} />
        </div>
      )}
      {last ? (
        <p className="mt-1 max-w-48 truncate font-mono text-xs text-muted-foreground" dir="ltr">
          {last}
        </p>
      ) : null}
    </div>
  );
}

/** One press copies a parcel's summary (lib/entry/messages.ts waybillSummary) for a chat. */
export function CopySummaryButton({ text, label, className }: { text: string | (() => string); label?: string; className?: string }) {
  const { language } = useTranslation();
  const name = label ?? pickLang(language, { ku: "کۆپیکردنی پوختە", en: "Copy summary", ar: "نسخ الملخص", zh: "复制摘要" });
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={name}
      title={name}
      onClick={async () => {
        const copied = await copyText(typeof text === "function" ? text() : text, name);
        if (copied) toast.success(pickLang(language, { ku: "کۆپی کرا", en: "Copied", ar: "تم النسخ", zh: "已复制" }));
      }}
    >
      <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

/**
 * Opens WhatsApp with the customer's number and the note already written
 * (lib/entry/messages.ts). Nothing is sent until staff press send there.
 */
export function WhatsAppNoticeButton({
  phone,
  message,
  label,
  className,
}: {
  phone: string | null | undefined;
  message: string;
  label?: string;
  className?: string;
}) {
  const { language } = useTranslation();
  const link = whatsappLink(phone, message);
  const name = label ?? pickLang(language, { ku: "ئاگادارکردنەوە بە وەتسئاپ", en: "Notify on WhatsApp", ar: "إشعار عبر واتساب", zh: "通过 WhatsApp 通知" });
  const noNumber = pickLang(language, { ku: "ژمارەی مۆبایلی دروست نییە", en: "No usable mobile number", ar: "لا يوجد رقم هاتف صالح", zh: "没有可用的手机号" });
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={!link}
      title={link ? name : noNumber}
      onClick={() => link && openExternal(link)}
    >
      <MessageCircle className="me-1.5 h-4 w-4" aria-hidden="true" />
      {name}
    </Button>
  );
}

/** The eye that hides the amounts while a customer can see the screen; Ctrl+Shift+H does the same. */
export function PrivacyModeToggle({ className }: { className?: string }) {
  const { language } = useTranslation();
  const { on, toggle } = usePrivacyMode();
  usePrivacyShortcut();
  const name = on
    ? pickLang(language, { ku: "پیشاندانی بڕەکان", en: "Show amounts", ar: "إظهار المبالغ", zh: "显示金额" })
    : pickLang(language, { ku: "شاردنەوەی بڕەکان", en: "Hide amounts", ar: "إخفاء المبالغ", zh: "隐藏金额" });
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={on}
      aria-label={name}
      title={`${name} (Ctrl+Shift+H)`}
      onClick={toggle}
    >
      {on ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
