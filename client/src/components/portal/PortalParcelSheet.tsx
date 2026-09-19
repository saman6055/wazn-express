import { lazy, Suspense, useCallback, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PORTAL_LIVE_QUERY } from "@/lib/portalQuery";
import { hasFeature } from "@shared/customerFeatures";
import { usePortalTheme } from "@/contexts/PortalThemeContext";
import { buildSearchIndex, type ParcelRow, type SearchItem } from "@/lib/portalSearch";
import { originCountriesOf } from "@/lib/packageStatus";
import { pathOf } from "@/lib/historySteps";
import { useBackCloses } from "@/hooks/useBackCloses";
import { searchStatusTone, searchStatusWords } from "@/components/portal/portalSearchChip";

const PortalSearchDetail = lazy(() => import("@/components/portal/PortalSearchDetail"));

type ExtraActions = ComponentProps<typeof PortalSearchDetail>["extraActions"];
type Extras = { actions?: ExtraActions; content?: ReactNode };

/**
 * One parcel's sheet, opened from any list of parcels — the search's own, a
 * shipment's, the China depot's. The owner's brief (2026-09-19): a compact
 * card, and the weight, the shipment, where it is and its journey one tap
 * away, the same everywhere.
 *
 * The sheet is one step in the phone's history (hooks/useBackCloses): Back
 * closes it and leaves the list where it was.
 *
 * `origins` is what lets a chip say "China" only when that is known
 * (lib/packageStatus); the lists it is built from are the ones the portal
 * already keeps, so opening a sheet costs no request of its own.
 */
export function usePortalParcelSheet() {
  const [, navigate] = useLocation();
  const [openItem, setOpenItem] = useState<SearchItem | null>(null);
  // Kept a moment after closing so the sheet can slide away.
  const [shownItem, setShownItem] = useState<SearchItem | null>(null);
  const [extras, setExtras] = useState<Extras>({});

  const parcelsQ = trpc.customerPortal.getMyPackages.useQuery(undefined, PORTAL_LIVE_QUERY);
  const ordersQ = trpc.customerPortal.getMyFullPackageOrders.useQuery({}, PORTAL_LIVE_QUERY);
  const batchesQ = trpc.customerPortal.getMyBatches.useQuery(undefined, PORTAL_LIVE_QUERY);
  const boxesQ = trpc.customerPortal.getMyDeliveryBoxes.useQuery(undefined, PORTAL_LIVE_QUERY);
  const { data: features } = trpc.customerPortal.getMyFeatures.useQuery();
  const { portalTheme } = usePortalTheme();
  // Box receipts live on the classic money page, for customers given them.
  const boxReceipts =
    hasFeature(features, "finance_detail") && portalTheme !== "modern" && portalTheme !== "skin3";
  const origins = useMemo(() => originCountriesOf(parcelsQ.data as any), [parcelsQ.data]);

  /** The card for a parcel, joined to its shipment, order and box. */
  const itemFor = useCallback(
    (parcel: ParcelRow): SearchItem | null =>
      buildSearchIndex({
        parcels: [parcel],
        orders: ordersQ.data as any,
        batches: batchesQ.data as any,
        boxes: boxesQ.data as any,
      }).find((i) => i.kind === "parcel") ?? null,
    [ordersQ.data, batchesQ.data, boxesQ.data],
  );

  const openParcel = useCallback(
    (parcel: ParcelRow, more: Extras = {}) => {
      const item = itemFor(parcel);
      if (!item) return;
      setExtras(more);
      setOpenItem(item);
      setShownItem(item);
    },
    [itemFor],
  );

  const close = useCallback(() => setOpenItem(null), []);
  useBackCloses(openItem != null, close);

  // Leaving for another page from the sheet: its step is taken back first,
  // then the page opens on top of the list, so Back from that page returns
  // to the list. The shipment's own page, opened from its own parcel, just
  // closes the sheet.
  const leaving = useRef<number>(0);
  const leave = useCallback(
    (href: string) => {
      if (pathOf(href) === window.location.pathname) {
        setOpenItem(null);
        return;
      }
      const go = () => {
        window.removeEventListener("popstate", go);
        window.clearTimeout(leaving.current);
        navigate(href);
      };
      window.addEventListener("popstate", go);
      // Should the step already be gone, go anyway.
      leaving.current = window.setTimeout(go, 400);
      setOpenItem(null);
    },
    [navigate],
  );

  // On the shipment's own page, "open shipment" would open this page again.
  const onItsShipment =
    shownItem?.batchId != null &&
    typeof window !== "undefined" &&
    pathOf(window.location.pathname) === `/portal/shipments/${shownItem.batchId}`;

  const sheet = shownItem ? (
    <Suspense fallback={null}>
      <PortalSearchDetail
        item={onItsShipment ? { ...shownItem, batchId: null } : shownItem}
        open={openItem != null}
        chip={{ tone: searchStatusTone(shownItem), words: searchStatusWords(shownItem, origins) }}
        boxReceipts={boxReceipts}
        onRequestClose={close}
        onClosed={() => setShownItem(null)}
        onNavigate={leave}
        extraActions={extras.actions}
        extraContent={extras.content}
      />
    </Suspense>
  ) : null;

  return { openParcel, itemFor, origins, sheet };
}
