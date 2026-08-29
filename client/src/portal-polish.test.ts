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
