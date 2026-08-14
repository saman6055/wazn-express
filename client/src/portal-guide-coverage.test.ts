import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { guideSections } from "./constants/portalGuide";

/**
 * The guide explains the portal. When the portal grows and the guide does
 * not, the guide quietly becomes a list of the parts we happened to have
 * finished first — and a customer reading it concludes the missing pages are
 * not for them.
 *
 * Eight sections were missing when this was written: our services, delivery
 * boxes, invoice reports, account security, held parcels, tutorials, FAQ and
 * announcements. Every one of them a page a customer can already open.
 */

const APP = fs.readFileSync(path.resolve(__dirname, "App.tsx"), "utf8");

/**
 * Every /portal route the app actually serves.
 *
 * `/portal` itself or something beneath it — not /portal-center, which is the
 * office's screen for watching the portal and has no business in a guide
 * written for customers.
 */
const routes = [...APP.matchAll(/<Route\s+path="(\/portal(?:\/[^"]*)?)"/g)].map((m) => m[1]);

/**
 * Pages that are deliberately not sections of their own.
 *
 * Kept short and reasoned. Anything added here without a reason is the guide
 * falling behind again, one exemption at a time.
 */
const NOT_SECTIONS = new Map<string, string>([
  ["/portal/guide", "this is the guide"],
  ["/portal/shipments/:id", "one shipment — covered by the shipments section"],
  ["/portal/blog/:id", "one post — covered by the news section"],
  ["/portal/news", "the same page as /portal/blog"],
  ["/portal/contact", "explained inside the FAQ and contact section"],
  ["/portal/about", "explained inside the FAQ and contact section"],
]);

describe("the routes this is checking", () => {
  it("found them", () => {
    // A changed route syntax would make every check below pass on nothing.
    expect(routes.length).toBeGreaterThan(20);
    expect(routes).toContain("/portal");
    expect(routes).toContain("/portal/profile");
  });
});

describe("the guide keeps up with the portal", () => {
  const covered = new Set(guideSections.map((s) => s.path));

  it("every page a customer can open is explained", () => {
    const missing = routes.filter((r) => !covered.has(r) && !NOT_SECTIONS.has(r));
    expect(
      missing,
      `add a section to constants/portalGuide.ts, or say why not:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("no section points at a page that no longer exists", () => {
    // A dead link in the guide is worse than a missing one: it looks like
    // the customer did something wrong.
    const dead = guideSections.map((s) => s.path).filter((p) => !routes.includes(p));
    expect(dead, `these sections link nowhere:\n${dead.join("\n")}`).toEqual([]);
  });

  it("every exemption still names a real route", () => {
    const stale = [...NOT_SECTIONS.keys()].filter((p) => !routes.includes(p));
    expect(stale, `these exemptions are for routes that are gone:\n${stale.join("\n")}`).toEqual([]);
  });
});

describe("every section is usable", () => {
  it("has a unique anchor", () => {
    // The anchor is the deep link — /portal/guide#yuan — so a duplicate
    // silently sends the customer to the wrong explanation.
    const ids = guideSections.map((s) => s.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("says something in all four languages", () => {
    for (const section of guideSections) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(section.title[lang]?.trim(), `${section.id}.title.${lang}`).toBeTruthy();
        expect(section.what[lang]?.trim(), `${section.id}.what.${lang}`).toBeTruthy();
        expect(section.example[lang]?.trim(), `${section.id}.example.${lang}`).toBeTruthy();
        for (const [i, point] of section.points.entries()) {
          expect(point[lang]?.trim(), `${section.id}.points[${i}].${lang}`).toBeTruthy();
        }
      }
    }
  });

  it("gives the customer something to do, not just a description", () => {
    for (const section of guideSections) {
      expect(section.points.length, `${section.id} has no points`).toBeGreaterThan(0);
    }
  });
});
