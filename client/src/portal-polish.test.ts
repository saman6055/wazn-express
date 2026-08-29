import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Three things asked for at once: the portal should be faster, it should
 * make a sound where a sound helps, and it should not be rude about either.
 *
 * The performance work here is the one that measured: getting to a
 * customer's shipments was four network round trips in a line — the entry
 * chunk, then the locale it waits for, then React mounts and asks for the
 * route's chunk, then that chunk asks for the data. Two of those four have
 * nothing to say to each other.
 */

const HERE = __dirname;
const read = (p: string) => fs.readFileSync(path.join(HERE, p), "utf8").replace(/\r\n/g, "\n");

const main = read("main.tsx");
const sound = read("lib/soundManager.ts");
const boxes = read("components/portal/MyDeliveryBoxes.tsx");

describe("the page and the language load at the same time", () => {
  it("starts the route's chunk before awaiting the locale", () => {
    const localeAt = main.indexOf("await loadLocale(initial)");
    const preloadAt = main.indexOf("const preload =");
    expect(preloadAt, "the preload is missing").toBeGreaterThan(-1);
    expect(preloadAt, "the preload must start before the await, or it is not parallel")
      .toBeLessThan(localeAt);
  });

  it("covers the portal pages a customer actually lands on", () => {
    for (const page of ["PortalHome", "PortalShipments", "PortalFinancial"]) {
      expect(main, `${page} is not preloaded`).toContain(`portal/${page}`);
    }
  });

  it("never lets a speculative fetch break the boot", () => {
    // If the preload fails the router asks for the same module a moment
    // later and gets the real error then. A boot that dies because a guess
    // failed is a worse trade than the wait it was saving.
    expect(main).toContain("preload?.catch(() => {})");
  });
});

describe("the reader's choice about sound is remembered", () => {
  it("reads it back on load rather than defaulting on every visit", () => {
    // The flag existed and lived only in memory, so turning sound off lasted
    // until the next page load — the same as not having the setting.
    expect(sound).toContain('const MUTE_KEY = "wazn-sound-enabled"');
    expect(sound).toContain('localStorage.getItem(MUTE_KEY) !== "off"');
  });

  it("writes it when it changes", () => {
    const body = sound.slice(sound.indexOf("setEnabled(enabled: boolean)"), sound.indexOf("private getContext"));
    expect(body).toContain("localStorage.setItem(MUTE_KEY");
  });

  it("survives a browser that refuses storage", () => {
    // Private windows and blocked site data throw on access. Sound on, which
    // is the default everywhere else.
    const body = sound.slice(sound.indexOf("private _enabled"), sound.indexOf("get enabled"));
    expect(body).toContain("catch");
    expect(body).toContain("return true;");
  });
});

describe("the portal's sounds are a phone's sounds, not a warehouse's", () => {
  const portalTones = () =>
    sound.slice(sound.indexOf("playPortalDone()"), sound.indexOf("playDuplicate()"));

  it("has its own two, apart from the scanner's", () => {
    expect(sound).toContain("playPortalDone()");
    expect(sound).toContain("playPortalFailed()");
  });

  it("keeps them quiet — a tenth of the volume the siren uses", () => {
    const body = portalTones();
    const volumes = [...body.matchAll(/,\s*([0-9.]+)\s*\)/g)].map((m) => Number(m[1]));
    expect(volumes.length, "no volumes declared").toBeGreaterThan(0);
    for (const v of volumes) expect(v).toBeLessThanOrEqual(0.12);
  });

  it("uses sine waves, which have no harmonics to rasp", () => {
    const body = portalTones();
    expect(body).toContain("'sine'");
    expect(body, "a square wave belongs on a warehouse floor").not.toContain("'square'");
  });

  it("plays only on something the customer just pressed", () => {
    // Never on a page load, never on something arriving in the background.
    // The customer's phone may be in a meeting or somebody's hand at
    // midnight; they caused this, so they are expecting it.
    expect(boxes).toContain("soundManager.playPortalDone()");
    expect(boxes).toContain("soundManager.playPortalFailed()");
    const onSuccess = boxes.slice(boxes.indexOf("confirmBoxReceived.useMutation"), boxes.indexOf("onSettled"));
    expect(onSuccess).toContain("onSuccess");
  });

  it("does not sound on merely opening the portal", () => {
    const home = read("pages/portal/PortalHome.tsx");
    expect(home, "nothing should greet a customer with a noise")
      .not.toContain("soundManager.play");
  });
});

/**
 * The line a customer opens the portal for.
 *
 * Everything on the home screen said what had already happened — three in
 * transit, two delivered. Nothing said what happens next, which is the only
 * thing somebody checking their phone on the way to work wants.
 */
describe("the portal says what happens next, not only what happened", () => {
  const home = read("pages/portal/PortalHome.tsx");

  it("puts it above the counts", () => {
    const card = home.indexOf("<NextStepCard");
    const stats = home.indexOf("{/* Stats Cards */}");
    expect(card).toBeGreaterThan(-1);
    expect(card, "the answer must come before the tally").toBeLessThan(stats);
  });

  it("shows one shipment — the one closest to reaching them", () => {
    expect(home).toContain("mostRelevantShipment(batches ?? [])");
  });

  it("names every stage of the ladder in all four languages", () => {
    const block = home.slice(home.indexOf("const HEADLINE"), home.indexOf("const ready ="));
    for (const key of ["leaving_china", "arriving_iraq", "clearing_customs", "reaching_depot", "ready_to_collect"]) {
      expect(block, `${key} has no wording`).toContain(key);
    }
    const starts = [...block.matchAll(/\bku:\s/g)].map((m) => m.index!);
    expect(starts.length).toBeGreaterThan(4);
    for (let i = 0; i < starts.length; i++) {
      const next = i + 1 < starts.length ? starts[i + 1]! : block.length;
      const text = block.slice(starts[i]!, next);
      for (const lang of ["en:", "ar:", "zh:"]) {
        expect(text.includes(lang), `a stage is missing ${lang}`).toBe(true);
      }
    }
  });

  it("never prints a date nobody recorded", () => {
    // An invented date becomes a promise the customer holds you to.
    expect(home).toContain("const date = step.expectedAt");
    expect(home).toContain("{date && (");
  });

  it("says 'expected', not a commitment", () => {
    const block = home.slice(home.indexOf("{date && ("), home.indexOf("batchCode"));
    expect(block).toContain('ku: "چاوەڕوانە"');
    expect(block).toContain('ku: "چاوەڕوان بوو"');
  });

  it("marks a late shipment without shouting about it", () => {
    // Amber, and a change of tense. Not red, and no alarm: late is common
    // and the customer can do nothing about it.
    const block = home.slice(home.indexOf("{date && ("), home.indexOf("batchCode"));
    expect(block).toContain("step.overdue");
    expect(block).toContain("text-amber");
    expect(block, "lateness is not an error").not.toContain("text-red");
  });

  it("says nothing at all when nothing is moving", () => {
    // A customer with everything delivered gets no card, not an empty one.
    expect(home).toContain("if (loading || !best) return null;");
  });

  it("leads somewhere — the shipment itself", () => {
    expect(home).toContain("/portal/shipments/${(shipment as any).id}");
  });
});

/**
 * Greetings, and where they are allowed to appear.
 *
 * The owner's rule, and the right one: the cards must not tire the customer.
 * Not on top of the screen, not a popup — a card found part-way down while
 * scrolling, the way the rating card is.
 */
describe("a greeting is found, not announced", () => {
  const card = read("components/portal/GreetingCard.tsx");
  const home = read("pages/portal/PortalHome.tsx");

  it("sits low on the page, beside the rating card", () => {
    const greeting = home.indexOf("<GreetingCard");
    const rating = home.indexOf("<DeliveryRatingCard");
    const stats = home.indexOf("{/* Stats Cards */}");
    expect(greeting).toBeGreaterThan(-1);
    expect(greeting, "a greeting must not sit above the page's own content").toBeGreaterThan(stats);
    expect(Math.abs(greeting - rating), "it belongs beside the rating card").toBeLessThan(600);
  });

  it("is never a notification", () => {
    // The channel that carries "your goods are in Erbil" is the one thing a
    // customer must not learn to ignore.
    expect(card, "greetings must not push").not.toContain("push");
    expect(card).not.toContain("createCustomerNotification");
  });

  it("takes no space at all on an ordinary day", () => {
    expect(card).toContain("if (!data) return null;");
  });

  it("asks once, not on every focus", () => {
    expect(card).toContain("refetchOnWindowFocus: false");
    expect(card).toContain("staleTime:");
  });

  it("never breaks the page it sits on", () => {
    // A greeting is the least important thing on this screen.
    expect(card).toContain("retry: false");
  });

  it("is written in the reader's own language", () => {
    expect(card).toContain('import { pickLang } from "@/lib/lang"');
    expect(card).toContain("L(data.title)");
    expect(card).toContain("L(data.message)");
  });

  it("pairs every colour for dark mode", () => {
    // The project's own guard checks this too; this one names the file so a
    // failure points at the card rather than at a list of line numbers.
    for (const light of ["bg-amber-50", "bg-violet-50"]) {
      const line = card.split("\n").find((l) => l.includes(light));
      expect(line, `${light} not found`).toBeTruthy();
      expect(line, `${light} has no dark counterpart`).toContain("dark:bg-");
    }
  });
});
