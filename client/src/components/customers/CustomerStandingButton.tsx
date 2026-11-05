import { Ban } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { trpc } from "@/lib/trpc";
import type { Standing } from "@shared/customerStanding";

/**
 * The way to the blacklist from wherever a customer is on screen (owner,
 * 2026-11-05: «لە زۆر جێگا ئەو شتە بێتەوە... ئاسان بێ»).
 *
 * It opens /customers/standing with this customer already chosen, so a note
 * or a block is one form away. Its colour says where they stand now: red on
 * the blacklist, amber under a caution, quiet otherwise.
 */

/** Everyone with a caution or a block, by id - one small list for a whole page. */
export function useStandingById(): Map<number, Standing> {
  const flagged = trpc.ledger.flaggedCustomers.useQuery(undefined, { staleTime: 60_000 });
  const map = new Map<number, Standing>();
  for (const f of flagged.data ?? []) map.set(Number(f.customerId), f.standing as Standing);
  return map;
}

export function standingHref(customerId: number): string {
  return `/customers/standing?customer=${customerId}`;
}

const WORDS: Record<Standing, { ku: string; en: string; ar: string; zh: string }> = {
  ok: { ku: "تێبینی / لیستی ڕەش", en: "Note / blacklist", ar: "ملاحظة / القائمة السوداء", zh: "备注 / 黑名单" },
  caution: { ku: "ئاگاداری لەسەرە", en: "Under caution", ar: "عليه تنبيه", zh: "已警告" },
  blocked: { ku: "لە لیستی ڕەشە", en: "Blacklisted", ar: "في القائمة السوداء", zh: "已列入黑名单" },
};

const TONE: Record<Standing, string> = {
  ok: "text-muted-foreground hover:text-red-600 dark:hover:text-red-400",
  caution: "text-amber-600 dark:text-amber-400",
  blocked: "text-red-600 dark:text-red-400",
};

export function CustomerStandingButton({
  customerId,
  standing = "ok",
  withLabel = false,
}: {
  customerId: number;
  standing?: Standing;
  withLabel?: boolean;
}) {
  const { language } = useTranslation();
  const label = pickLang(language, WORDS[standing]);
  return (
    <Link
      href={standingHref(customerId)}
      title={label}
      aria-label={label}
      data-testid={`standing-${customerId}`}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors hover:bg-muted",
        withLabel ? "h-9 border px-3 text-sm font-medium" : "h-8 w-8",
        TONE[standing],
      )}
    >
      <Ban className="h-4 w-4" />
      {withLabel && <span>{label}</span>}
    </Link>
  );
}
