import { PortalLayout } from "@/components/portal/PortalLayout";
import { PriceListSection } from "@/components/portal/PriceListSection";

/**
 * "How much will mine cost?"
 *
 * The question customers telephone the office about more than any other, and
 * the answer already existed — behind a tab, inside a section that sits well
 * below the fold on the home page. Two levels of hunting for the one thing
 * somebody wants before they decide to ship at all.
 *
 * So it gets its own address. It is the same section and the same
 * calculator — no second copy of the arithmetic, which on a price would be
 * the worst possible thing to duplicate — opened on the tab that answers the
 * question.
 */
export default function PortalCalculator() {
  return (
    <PortalLayout>
      <PriceListSection defaultTab="calculator" />
    </PortalLayout>
  );
}
