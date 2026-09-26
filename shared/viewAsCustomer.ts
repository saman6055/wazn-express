import { withFix } from "./fixAdvice";

/**
 * Looking at the portal through a customer's eyes, and changing nothing.
 *
 * The owner, 2026-09-26: "I want to get into any customer's account from
 * Portal Center without a username and password, so I can find what the
 * portal is missing and notice a mistake early."
 *
 * The need is real and there is no other way to meet it. A customer's portal
 * is built entirely from that customer's own data — their parcels, their
 * balance, their box, their discounts — so a screen that is wrong for one
 * customer is usually right for every other, and asking a customer to send
 * screenshots is how a fault survives a month.
 *
 * Two rules make it safe enough to build:
 *
 *  1. **It cannot write.** Not "should not": every mutation is refused in the
 *     one place tRPC already refuses the auditor's (server/_core/trpc.ts,
 *     shared/readOnlyRole). So a look never leaves a pre-declaration, a
 *     claim, a rating or a WhatsApp request on somebody's real account, and
 *     a router written next year is covered before it is written.
 *  2. **It is short, named and recorded.** The session lasts two hours, the
 *     portal wears a bar saying whose account is open and who opened it, and
 *     the audit log holds the admin, the customer and the moment.
 *
 * What it is not is a way to act for a customer. If the office has to do
 * something on a customer's behalf, it is done from the office's own screens,
 * under the name of whoever did it.
 */

/** Two hours: long enough to look through the portal, short enough to forget. */
export const VIEW_AS_MINUTES = 120;

/** What the customer cookie carries while somebody is looking. */
export interface ViewAsClaims {
  /** True only in a look-only session. */
  viewAs?: boolean;
  /** The staff account looking, so the way back and the log both exist. */
  viewAsBy?: number;
  /** Their name, for the bar across the top of the portal. */
  viewAsName?: string;
}

/**
 * May this call run?
 *
 * Only mutations are refused — reading is the whole purpose. Written as a
 * question about the call rather than a list of endpoints, for the same
 * reason the auditor's rule is: a list is a thing somebody forgets to add to.
 */
/**
 * The one exception, named here so it is one and not a habit.
 *
 * Ending the look is itself a mutation — it writes the staff session back
 * into the cookie — so a rule that refuses every mutation would trap the
 * admin inside the customer's portal until the two hours ran out. This is
 * the only path allowed through, and the guard test asserts it stays the
 * only one.
 */
export const VIEW_AS_EXIT_PATH = "auth.exitViewAs";

export function viewAsMayPerform(
  viewAs: boolean | undefined,
  operation: "query" | "mutation" | "subscription",
  path?: string,
): boolean {
  if (!viewAs || operation !== "mutation") return true;
  return path === VIEW_AS_EXIT_PATH;
}

/**
 * What the refused caller is told.
 *
 * It names the state plainly and says how to leave it. Anything vaguer would
 * send the owner hunting for a bug in the portal that is not there.
 */
export const VIEW_AS_REFUSAL = withFix(
  "ئەمە دۆخی «بینین وەک کڕیار»ە — تەنها بۆ بینینە و هیچ شتێک ناگۆڕدرێت.",
  [
    "لە سەرەوەی لاپەڕەکە دوگمەی «دەرچوون لە بینین» دابگرە",
    "دواتر ئەم کارە لە شاشەکانی ئۆفیس بە ناوی خۆت ئەنجام بدە",
  ],
);

/** The bar across the top of the portal, in the four languages it speaks. */
export const VIEW_AS_WORDS = {
  banner: {
    ku: "بینین وەک کڕیار",
    en: "Viewing as a customer",
    ar: "عرض كزبون",
    zh: "以客户身份查看",
  },
  readOnly: {
    ku: "تەنها بینین — هیچ ناگۆڕدرێت",
    en: "Look only — nothing changes",
    ar: "عرض فقط — لا شيء يتغير",
    zh: "仅查看 — 不会更改任何内容",
  },
  leave: {
    ku: "دەرچوون لە بینین",
    en: "Leave",
    ar: "خروج",
    zh: "退出",
  },
  open: {
    ku: "بینین وەک ئەم کڕیارە",
    en: "View as this customer",
    ar: "العرض كهذا الزبون",
    zh: "以此客户身份查看",
  },
} as const;
