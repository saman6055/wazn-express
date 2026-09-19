import { PACKAGE_STATUS_LABEL, packageStatusTone, parcelStatusWords } from "@/lib/packageStatus";
import { orderStatusLabel } from "@/lib/shipmentFilters";
import { DECLARED_PENDING_LABEL, ORDER_NOT_SHIPPED_LABEL, SEARCH_TAB_TONE, type SearchItem } from "@/lib/portalSearch";
import { BOX_STATUS_LABEL } from "@/components/portal/MyDeliveryBoxes";

type Words = { ku: string; en: string; ar: string; zh: string };

/**
 * What the chip on an answer says — on a search card, in the sheet that opens
 * from it, and on a shipment's parcel list, which opens the same sheet.
 *
 * A parcel says where it is in the owner's three phrases
 * (lib/packageStatus parcelStatusWords); `originCountries` is what lets it
 * say "China" only when that is known.
 */
export function searchStatusWords(item: SearchItem, originCountries: ReadonlySet<number>): Words | null {
  switch (item.kind) {
    case "parcel":
      return parcelStatusWords(item.parcel ?? { status: item.status }, originCountries);
    case "order":
      if (item.status === "returned") return PACKAGE_STATUS_LABEL.returned ?? null;
      return orderStatusLabel(item.status) ?? ORDER_NOT_SHIPPED_LABEL;
    case "box":
      return BOX_STATUS_LABEL[item.status] ?? null;
    case "declared":
      return DECLARED_PENDING_LABEL;
  }
}

/**
 * The chip's colour: the tab's own — green in Erbil, blue on the way, grey in
 * China. Something under no tab keeps the shared parcel colour: green for
 * delivered, red for returned and cancelled.
 */
export function searchStatusTone(item: SearchItem): string {
  if (item.tab) return SEARCH_TAB_TONE[item.tab];
  if (item.kind === "box") return item.status === "delivered" ? SEARCH_TAB_TONE.arrived : SEARCH_TAB_TONE.onTheWay;
  if (item.kind === "parcel" || item.status === "returned" || item.status === "delivered") return packageStatusTone(item.status);
  return SEARCH_TAB_TONE.registered;
}
