import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A failed request must never read as "you have nothing".
 *
 * React Query sets `isLoading` false on failure and leaves `data` undefined,
 * so a list that only checks loading-then-empty tells a customer whose phone
 * dropped signal that they own no shipments, no transactions, no orders — the
 * most alarming thing this app can say, delivered confidently, for a timeout.
 * Not one portal screen checked `isError`.
 *
 * These are the screens where being wrong costs the most. The list grows as
 * the rest are converted; it must never shrink.
 */

const PORTAL = path.resolve(__dirname, "pages/portal");

const MUST_HANDLE_ERRORS = [
  "PortalShipments.tsx",
  "PortalFinancial.tsx",
  "PortalFullPackage.tsx",
  "PortalNotifications.tsx",
  "PortalAddresses.tsx",
  "PortalHome.tsx",
  "PortalProhibitedPackages.tsx",
  "PortalUnclaimedPackages.tsx",
];

describe("a dropped request is not an empty account", () => {
  for (const file of MUST_HANDLE_ERRORS) {
    it(`${file} shows an error with a retry`, () => {
      const src = fs.readFileSync(path.join(PORTAL, file), "utf8");
      expect(src, "must read isError from its query").toMatch(/isError/);
      expect(src, "must render the shared error state").toContain("PortalErrorState");
      expect(src, "must offer a retry").toMatch(/onRetry=/);
    });
  }

  it("the error state itself offers a way out", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "components/portal/PortalErrorState.tsx"),
      "utf8",
    );
    // Offline is something the customer can act on; a server error is not.
    // Saying which is the difference between a dead end and a next step.
    expect(src).toContain("navigator.onLine");
    expect(src).toContain("onRetry");
    // Four languages, like the rest of the portal.
    expect(src).toMatch(/ku:.*en:.*ar:.*zh:/s);
  });
});
