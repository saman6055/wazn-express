import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LAYER_KEY,
  STEP_FROM_KEY,
  backStep,
  isLayerEntry,
  isPortalAddress,
  pathOf,
  readStepFrom,
  withLayer,
  withStepFrom,
} from "./historySteps";

describe("where a step came from", () => {
  it("is read back as it was written, and leaves the entry's other memories alone", () => {
    const state = withStepFrom({ portalSearchView: { q: "YT12" } }, "/portal/profile");
    expect(readStepFrom(state)).toBe("/portal/profile");
    expect(state.portalSearchView).toEqual({ q: "YT12" });
  });

  it("is nothing on a fresh entry, or on one some other code wrote", () => {
    expect(readStepFrom(null)).toBeNull();
    expect(readStepFrom({})).toBeNull();
    expect(readStepFrom({ [STEP_FROM_KEY]: 42 })).toBeNull();
    expect(readStepFrom("x")).toBeNull();
  });
});

describe("a portal page", () => {
  it("is /portal and what is under it, with or without a query", () => {
    expect(isPortalAddress("/portal")).toBe(true);
    expect(isPortalAddress("/portal/")).toBe(true);
    expect(isPortalAddress("/portal/search?q=YT12")).toBe(true);
    expect(isPortalAddress("/portal/financial?tab=boxes&box=4#top")).toBe(true);
  });

  it("is not the office's Portal Center, the sign-in page, or nothing", () => {
    expect(isPortalAddress("/portal-center")).toBe(false);
    expect(isPortalAddress("/customer-login")).toBe(false);
    expect(isPortalAddress("/")).toBe(false);
    expect(isPortalAddress(null)).toBe(false);
    expect(isPortalAddress("")).toBe(false);
  });

  it("is compared by its path alone", () => {
    expect(pathOf("/portal/blog?page=2")).toBe("/portal/blog");
    expect(pathOf("/portal/blog/")).toBe("/portal/blog");
    expect(pathOf("/")).toBe("/");
  });
});

describe("what a back arrow does", () => {
  it("takes the step when the page behind is the portal's", () => {
    expect(backStep("/portal/search?q=YT12")).toBe("back");
    expect(backStep("/portal")).toBe("back");
  });

  it("opens the fallback on the first page of a visit — from WhatsApp, a new tab, after signing in", () => {
    expect(backStep(null)).toBe("open");
    expect(backStep("/customer-login")).toBe("open");
    expect(backStep("/portal-center")).toBe("open");
  });

  it("with a named page, steps back only onto that page", () => {
    expect(backStep("/portal/blog", "/portal/blog")).toBe("back");
    expect(backStep("/portal/blog?page=2", "/portal/blog")).toBe("back");
    expect(backStep("/portal", "/portal/blog")).toBe("open");
    expect(backStep(null, "/portal/blog")).toBe("open");
  });
});

describe("a layer's step", () => {
  it("is marked with its owner, over whatever the entry already carried", () => {
    const state = withLayer(withStepFrom(null, "/portal"), "r1");
    expect(isLayerEntry(state, "r1")).toBe(true);
    expect(isLayerEntry(state, "r2")).toBe(false);
    expect(readStepFrom(state)).toBe("/portal");
    expect(state[LAYER_KEY]).toBe("r1");
    expect(isLayerEntry(null, "r1")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The listener, against a small stand-in for the browser's history: entries,
// a place among them, and the events wouter's patch announces.
// ---------------------------------------------------------------------------

class FakeBrowser extends EventTarget {
  entries: Array<{ url: string; state: unknown }>;
  index = 0;
  history: {
    readonly state: unknown;
    pushState: (state: unknown, title: string, url?: string) => void;
    replaceState: (state: unknown, title: string, url?: string) => void;
    back: () => void;
  };

  constructor(url: string, state: unknown) {
    super();
    this.entries = [{ url, state }];
    const self = this;
    this.history = {
      get state() {
        return self.entries[self.index].state;
      },
      pushState(next, _title, to) {
        self.entries = [...self.entries.slice(0, self.index + 1), { url: to ?? self.entries[self.index].url, state: next }];
        self.index += 1;
        self.dispatchEvent(new Event("pushState"));
      },
      replaceState(next, _title, to) {
        self.entries[self.index] = { url: to ?? self.entries[self.index].url, state: next };
        self.dispatchEvent(new Event("replaceState"));
      },
      back() {
        if (self.index === 0) return;
        self.index -= 1;
        self.dispatchEvent(new Event("popstate"));
      },
    };
  }

  get location() {
    const u = new URL(this.entries[this.index].url, "https://wazn.test");
    return { pathname: u.pathname, search: u.search, hash: u.hash };
  }
}

let browser: FakeBrowser;

async function visit(url: string, state: unknown = null) {
  browser = new FakeBrowser(url, state);
  vi.stubGlobal("window", browser);
  vi.resetModules();
  const steps = await import("./historySteps");
  steps.installHistorySteps();
  return steps;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the listener", () => {
  it("stamps every step with the page it was taken from", async () => {
    const steps = await visit("/customer-login");
    browser.history.pushState(null, "", "/portal");
    browser.history.pushState(null, "", "/portal/profile");
    browser.history.pushState(null, "", "/portal/about");
    expect(steps.currentStepFrom()).toBe("/portal/profile");
    expect(steps.backStep(steps.currentStepFrom())).toBe("back");

    browser.history.back();
    expect(steps.currentStepFrom()).toBe("/portal");
    browser.history.back();
    // Home, stepped to from the sign-in page: nothing of the portal behind.
    expect(steps.currentStepFrom()).toBe("/customer-login");
    expect(steps.backStep(steps.currentStepFrom())).toBe("open");
  });

  it("starts a visit with nothing behind it", async () => {
    const steps = await visit("/portal/messages");
    expect(steps.currentStepFrom()).toBeNull();
    expect(steps.backStep(steps.currentStepFrom())).toBe("open");
  });

  it("keeps the stamp when a page replaces its own address and wipes the state", async () => {
    const steps = await visit("/portal");
    browser.history.pushState(null, "", "/portal/financial");
    browser.history.replaceState(null, "", "/portal/financial?tab=boxes");
    expect(steps.readStepFrom(browser.history.state)).toBe("/portal");
    expect(steps.currentStepFrom()).toBe("/portal");
  });

  it("stamps a layer opened over a page with that page, and keeps the layer's mark", async () => {
    const steps = await visit("/portal");
    browser.history.pushState(null, "", "/portal/full-package");
    browser.history.pushState(steps.withLayer(browser.history.state, "order"), "");
    expect(steps.isLayerEntry(browser.history.state, "order")).toBe(true);
    expect(steps.currentStepFrom()).toBe("/portal/full-package");
  });

  it("reads the stamp a reload kept", async () => {
    const steps = await visit("/portal/about", { [STEP_FROM_KEY]: "/portal/profile" });
    expect(steps.currentStepFrom()).toBe("/portal/profile");
  });
});
