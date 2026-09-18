import { describe, expect, it } from "vitest";
import {
  OVERVIEW_TARGET,
  isLowRating,
  portalCenterHref,
  readPortalCenterLink,
  tabBadges,
} from "./portalCenterNav";

describe("a figure at the top opens its own tab, filtered", () => {
  it("pending tracking and pending ownership open only what is pending", () => {
    expect(OVERVIEW_TARGET.pendingDeclares).toEqual({ tab: "declared", status: "pending" });
    expect(OVERVIEW_TARGET.pendingClaims).toEqual({ tab: "claims", status: "pending" });
  });

  it("active today and this week open the activity of that window", () => {
    expect(OVERVIEW_TARGET.activeToday).toEqual({ tab: "activity", sinceDays: 1 });
    expect(OVERVIEW_TARGET.activeWeek).toEqual({ tab: "activity", sinceDays: 7 });
  });

  it("customers and messages open their tabs", () => {
    expect(OVERVIEW_TARGET.totalCustomers.tab).toBe("customers");
    expect(OVERVIEW_TARGET.messagesWeek.tab).toBe("messages");
  });
});

describe("a link opens the page on a tab from anywhere", () => {
  it("reads what it writes", () => {
    for (const link of Object.values(OVERVIEW_TARGET)) {
      const href = portalCenterHref(link);
      expect(href.startsWith("/portal-center?")).toBe(true);
      expect(readPortalCenterLink(href.slice(href.indexOf("?")))).toEqual(link);
    }
  });

  it("drops what it does not know, and falls back to the customers tab", () => {
    expect(readPortalCenterLink("?tab=nope")).toEqual({ tab: "customers" });
    expect(readPortalCenterLink("?tab=declared&status=bogus")).toEqual({ tab: "declared" });
    expect(readPortalCenterLink("?tab=claims&status=matched")).toEqual({ tab: "claims" });
    expect(readPortalCenterLink("?tab=activity&since=3")).toEqual({ tab: "activity" });
    expect(readPortalCenterLink("")).toEqual({ tab: "customers" });
  });
});

describe("the red number on a tab", () => {
  it("is what waits there, and nothing when nothing does", () => {
    expect(
      tabBadges({ pendingDeclares: 1, pendingClaims: 0, unreadMessages: 2, prohibitedAwaiting: 1, lowRatingsWeek: 1 }, 1),
    ).toEqual({ declared: 1, messages: 2, prohibited: 1, ratings: 1, yuan: 1 });
    expect(tabBadges(null, null)).toEqual({});
  });
});

describe("a low rating", () => {
  it("is one to three stars", () => {
    expect([1, 2, 3].every(isLowRating)).toBe(true);
    expect(isLowRating(4)).toBe(false);
    expect(isLowRating(5)).toBe(false);
    expect(isLowRating(0)).toBe(false);
    expect(isLowRating(null)).toBe(false);
  });
});
