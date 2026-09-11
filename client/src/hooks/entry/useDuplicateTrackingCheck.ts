import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cleanTrackingPaste } from "@/lib/entry/cleanPaste";

/**
 * While a tracking number is typed, find out whether it is already in the
 * system — before the form is sent, not after.
 *
 * It asks the read the registration screens already use
 * (packages.lookupTracking), 400 ms after the typing stops and from six
 * characters. It only warns: saving is still checked by the server exactly
 * as before.
 */
export function useDuplicateTrackingCheck(tracking: string, enabled = true) {
  const clean = cleanTrackingPaste(tracking);
  const settled = useDebouncedValue(clean, 400);
  const asked = enabled && settled.length >= 6;
  const query = trpc.packages.lookupTracking.useQuery(
    { trackingNumber: settled },
    { enabled: asked, staleTime: 30_000, retry: false },
  );
  // An answer about an earlier spelling of the number is no answer at all.
  const answer = asked && settled === clean ? query.data : undefined;

  return {
    checking: enabled && clean.length >= 6 && (settled !== clean || query.isFetching),
    /** A parcel with this tracking number is already registered. */
    duplicate: answer?.type === "duplicate" ? { packageCode: answer.existingPackageCode } : null,
    /** It belongs to a full-package or commission order that is waiting for it. */
    order: answer?.found ? answer : null,
  };
}
