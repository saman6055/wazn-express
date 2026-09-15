import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Tell the operator about the order number while they are typing it, not
 * after they have filled in the whole form.
 *
 * The owner's note (Sep 2026): the "this order number is already used"
 * refusal arrived at save — after the customer, the photo, the prices and
 * the shipping method had all been entered. Every one of them then had to
 * be retyped, because the very first field was wrong. A warning is worth
 * almost nothing at the end of the work and almost everything at the start.
 *
 * Debounced, because this runs on a keystroke: a pasted number fires one
 * query, not eighteen. Skipped entirely while the field is blank, and while
 * it still holds whatever the order being edited already had — nobody needs
 * to be told their own number is theirs.
 */

/** Long enough that typing a number by hand does not query on every letter. */
const DEBOUNCE_MS = 450;

export interface OrderNumberCheck {
  /** True once the server has answered that another order holds this number. */
  taken: boolean;
  /** The order that holds it, for the message. */
  orderCode?: string;
  /** True while the answer is in flight — for a quiet spinner, not a blocker. */
  checking: boolean;
}

export function useOrderNumberCheck(
  orderNumber: string,
  options?: { excludeId?: number; enabled?: boolean },
): OrderNumberCheck {
  const [settled, setSettled] = useState("");

  const value = orderNumber.trim();
  const enabled = (options?.enabled ?? true) && settled.length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  const query = trpc.fullPackage.checkOrderNumber.useQuery(
    { orderNumber: settled, excludeId: options?.excludeId },
    {
      enabled,
      // The answer is about a number, not about a moment — asking again on
      // every window focus would put a spinner under the field for nothing.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: false,
    },
  );

  // Say nothing while the field has moved on from what was asked about: a
  // stale "already used" under a number that has since been corrected is
  // worse than a blank space.
  const answerIsCurrent = settled === value;

  return {
    taken: Boolean(answerIsCurrent && query.data?.taken),
    orderCode: answerIsCurrent && query.data?.taken ? query.data.orderCode : undefined,
    checking: enabled && answerIsCurrent && query.isFetching,
  };
}
