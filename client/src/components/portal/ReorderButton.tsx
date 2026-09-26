import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { openWaznChat, waznChatMessage } from "@/lib/waznChat";
import { useChatCustomer } from "@/hooks/useChatCustomer";
import { WhatsAppGlyph } from "@/components/portal/WhatsAppHelpButton";
import { REORDER_WORDS, canReorder, reorderDetails, type ReorderSubject } from "@shared/reorderRequest";

/**
 * "Can you order this for me again?" — one tap, into Wazn's chat.
 *
 * The owner's rule of 2026-09-26. The customer liked the thing, they are
 * looking at it, and the alternative is describing a pair of sunglasses they
 * bought in July down a phone line. So the message carries the three facts
 * the office needs to buy it again — the shop's order number, the tracking
 * and a link to the picture — already written (shared/reorderRequest).
 *
 * Straight into Wazn's own chat, never the phone's share sheet: the owner's
 * standing rule for every WhatsApp button in the system (lib/waznChat).
 *
 * A <button> rather than a link, because these cards are often links
 * themselves and nested anchors are invalid HTML.
 */
export function ReorderButton({
  language,
  subject,
  className,
}: {
  language: string;
  subject: ReorderSubject;
  className?: string;
}) {
  const pick = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);
  const customer = useChatCustomer();

  // Nothing to ask with is nothing to offer: a button on a row that cannot
  // name what it is about only costs the customer a tap.
  if (!canReorder(subject)) return null;

  return (
    <button
      type="button"
      data-testid="reorder-button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        openWaznChat(
          waznChatMessage({
            language,
            intent: REORDER_WORDS.intent,
            customer,
            section: REORDER_WORDS.section,
            // The picture is absolute against the site the portal is served
            // from, because a wa.me message is text and a relative path in
            // somebody's WhatsApp opens nothing.
            details: reorderDetails(subject, typeof window === "undefined" ? "" : window.location.origin),
          }),
        );
      }}
      className={cn(
        "relative tap-44 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 active:scale-95 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/50",
        className,
      )}
    >
      <WhatsAppGlyph className="h-3.5 w-3.5 shrink-0" />
      <span>{pick(REORDER_WORDS.button)}</span>
    </button>
  );
}
