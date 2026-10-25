import { UserRound } from "lucide-react";
import { pickLang } from "@/lib/lang";
import { splitCustomerCode } from "@shared/customerCode";

/**
 * Whose money is being taken (owner, 2026-10-21).
 *
 * The customer's name and code, large and gently flashing - «کۆدەکەش و
 * ناوەکەش تۆزێ فلاشینگ بکات ... تاوەکو ئادمین بزانێ پارەی کێ واسل دەکات» -
 * The digits of the code are no longer typed (owner, 2026-10-25: it
 * slowed every payment); the flashing name and code stay.
 */
export function PayeeConfirm({
  customerName,
  customerCode,
  boxCode,
  language,
}: {
  customerName: string | null | undefined;
  customerCode: string | null | undefined;
  boxCode: string | null | undefined;
  value?: string;
  onChange?: (v: string) => void;
  language: string;
}) {
  const split = splitCustomerCode(customerCode);
  const name = customerName || split.name || "—";

  return (
    <div className="space-y-2.5 rounded-xl border-2 border-primary/50 bg-primary/5 p-3" data-testid="payee-confirm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold motion-safe:animate-pulse" data-testid="payee-name">{name}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span dir="ltr" className="rounded-md bg-primary px-2 py-0.5 font-mono text-base font-bold text-primary-foreground motion-safe:animate-pulse" data-testid="payee-code">
              {split.code || "—"}
            </span>
            {boxCode && <span dir="ltr" className="font-mono text-xs text-muted-foreground">{boxCode}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

/** The payment button's words: whose money, and how much. */
export function payeeButtonLabel(language: string, name: string | null | undefined, amount: string): string {
  const who = name || "";
  // Kept left-to-right inside a right-to-left line, or "$35.00" reads "35.00$".
  amount = `⁦${amount}⁩`;
  return pickLang(language, {
    ku: `وەرگرتنی ${amount} لە ${who}`,
    en: `Take ${amount} from ${who}`,
    ar: `استلام ${amount} من ${who}`,
    zh: `向 ${who} 收取 ${amount}`,
  });
}
