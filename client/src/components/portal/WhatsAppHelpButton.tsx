import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { openWaznChat, waznChatMessage, type WaznChatDetail } from "@/lib/waznChat";
import { useChatCustomer } from "@/hooks/useChatCustomer";

// ---------------------------------------------------------------------------
// WhatsAppHelpButton — one small, uniform "ask us" pill for every portal
// section. The pre-filled message tells staff WHO is asking (name + customer
// code), WHERE they are (section), and WHAT about (topic: batch code, invoice
// number, order total...), so support never has to ask "which shipment?".
// Deliberately subtle — a quiet pill, not a loud CTA — so cards stay clean.
// ---------------------------------------------------------------------------

/** WhatsApp brand glyph (lucide has no brand icons). */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
    </svg>
  );
}

export function WhatsAppHelpButton({
  language,
  section,
  topic,
  details,
  className,
}: {
  language: string;
  /** Localized section name the customer is in, e.g. "بارەکان". */
  section: string;
  /** Localized context line: batch code + status, invoice number, order total... */
  topic?: string;
  /** More of the summary, a line each: tracking, product, amount. */
  details?: readonly WaznChatDetail[];
  className?: string;
}) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);
  // Cached across every button instance on the page (react-query dedupes).
  const customer = useChatCustomer();

  // Straight into Wazn's chat, the summary already written — see lib/waznChat.
  // It used to photograph the card and offer the phone's share sheet, which
  // made the customer pick WhatsApp and then find Wazn among their chats.
  // Rendered as a <button> (not <a>) because the pill often lives inside a
  // card that is itself a link — nested anchors are invalid HTML.
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    openWaznChat(
      waznChatMessage({
        language,
        intent: { ku: "سڵاو، پێویستم بە یارمەتییە", en: "Hello, I need some help", ar: "مرحباً، أحتاج إلى مساعدة", zh: "您好，我需要帮助" },
        customer,
        section,
        details: [topic ? [{ ku: "بابەت", en: "Subject", ar: "الموضوع", zh: "主题" }, topic] : null, ...(details ?? [])],
      }),
    );
  };

  return (
    <button
      type="button"
      data-wa-help="true"
      onClick={handleClick}
      className={cn(
        "relative tap-44 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-100 active:scale-95 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/50",
        className,
      )}
    >
      <WhatsAppGlyph className="h-3.5 w-3.5 shrink-0" />
      <span>{pick({ ku: "پرسیارت هەیە؟", en: "Need help?", ar: "تحتاج مساعدة؟", zh: "需要帮助？" })}</span>
    </button>
  );
}
