import { CheckCircle2, UserRound, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { splitCustomerCode } from "@shared/customerCode";
import { payeeCodeMatches, payeeDigits } from "@shared/payeeCheck";

/**
 * Whose money is being taken (owner, 2026-10-21).
 *
 * The customer's name and code, large and gently flashing - «کۆدەکەش و
 * ناوەکەش تۆزێ فلاشینگ بکات ... تاوەکو ئادمین بزانێ پارەی کێ واسل دەکات» -
 * and a box for the digits of the code: until they are this customer's,
 * the payment button stays shut (and the server refuses it too:
 * shared/payeeCheck).
 */
export function PayeeConfirm({
  customerName,
  customerCode,
  boxCode,
  value,
  onChange,
  language,
}: {
  customerName: string | null | undefined;
  customerCode: string | null | undefined;
  boxCode: string | null | undefined;
  value: string;
  onChange: (v: string) => void;
  language: string;
}) {
  const split = splitCustomerCode(customerCode);
  const name = customerName || split.name || "—";
  const digits = payeeDigits(customerCode);
  const prefix = split.code.replace(/\d+$/, "");
  const typed = value.trim().length > 0;
  const ok = payeeCodeMatches(customerCode, value);

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
      {digits && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            {pickLang(language, {
              ku: "ژمارەی کۆدی کڕیار بنووسە:",
              en: "Type the customer's code number:",
              ar: "اكتب رقم رمز العميل:",
              zh: "输入客户编号：",
            })}
          </span>
          <span className="flex items-center gap-1" dir="ltr">
            <span className="font-mono font-bold text-muted-foreground">{prefix}</span>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="___"
              className={cn(
                "h-9 w-24 text-center font-mono text-base font-bold",
                typed && (ok ? "border-emerald-500 ring-1 ring-emerald-400" : "border-red-500 ring-1 ring-red-400"),
              )}
              data-testid="payee-code-input"
            />
          </span>
          {typed && (ok ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" data-testid="payee-ok" />
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400" data-testid="payee-wrong">
              <XCircle className="h-4 w-4" />
              {pickLang(language, { ku: "ئەم کڕیارە نییە", en: "Not this customer", ar: "ليس هذا العميل", zh: "不是该客户" })}
            </span>
          ))}
        </label>
      )}
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
