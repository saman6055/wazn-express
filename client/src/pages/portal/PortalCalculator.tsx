import { PortalLayout } from "@/components/portal/PortalLayout";
import { PriceListSection } from "@/components/portal/PriceListSection";

/**
 * "How much will mine cost?"
 *
 * The question customers telephone the office about more than any other, and
 * the answer used to be behind a tab, inside a section well below the fold on
 * the home page. Two levels of hunting for the one thing somebody wants
 * before they decide to ship at all.
 *
 * So it has its own address, and the home screen a button that opens it —
 * the price list no longer sits on the home page at all. It is the same
 * section and the same calculator, no second copy of the arithmetic, which
 * on a price would be the worst possible thing to duplicate.
 */
export default function PortalCalculator() {
  return (
    <PortalLayout>
      <PriceListSection defaultTab="calculator" />
    </PortalLayout>
  );
}
