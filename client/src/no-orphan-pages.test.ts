import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every page can be reached.
 *
 * Four could not: a whole second customer portal, a package register screen,
 * a package detail screen and a service-types manager — 2,872 lines with no
 * route and nothing importing them. One of them had a note in App.tsx saying
 * it had been merged into Settings; the file was left where it was.
 *
 * Dead screens are not harmless. They are read as current when somebody goes
 * looking, they get half-updated by sweeping changes, and they answer "does
 * the system do X?" with a yes that no user can reach.
 *
 * Reachability here means "something other than itself mentions it" —
 * App.tsx routes most pages, but Home.tsx lazy-loads the five landing
 * variants and DashboardWrapper picks between three dashboards, and neither
 * of those appears in App.tsx.
 */

const SRC = path.resolve(__dirname);
const PAGES = path.join(SRC, "pages");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "locales", "dist"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Every page file, as a path relative to pages/ without its extension. */
function pageNames(dir: string, prefix = "", out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pageNames(path.join(dir, entry.name), `${prefix}${entry.name}/`, out);
    else if (entry.name.endsWith(".tsx")) out.push(prefix + entry.name.replace(/\.tsx$/, ""));
  }
  return out;
}

const ALL_SOURCE = sourceFiles(SRC);
const PAGE_NAMES = pageNames(PAGES);

describe("the pages this is checking", () => {
  it("found them", () => {
    expect(PAGE_NAMES.length).toBeGreaterThan(80);
    expect(PAGE_NAMES).toContain("Dashboard");
  });
});

describe("no page is stranded", () => {
  it("every page file is imported by something", () => {
    // Read once: this walks every source file against every page name, and
    // re-reading the tree per page turns a fast test into a slow one.
    const contents = new Map(ALL_SOURCE.map((f) => [f, fs.readFileSync(f, "utf8")]));

    const orphans = PAGE_NAMES.filter((name) => {
      const own = path.join(PAGES, `${name}.tsx`);
      const base = name.split("/").pop()!;
      for (const [file, src] of contents) {
        if (file === own) continue;
        // How pages are actually referenced: "./pages/X", "@/pages/X",
        // "./modern/X" from a skin's parent, or "./X" from a sibling.
        if (
          src.includes(`/${base}"`) ||
          src.includes(`/${base}'`) ||
          src.includes(`"./${base}"`) ||
          src.includes(`'./${base}'`)
        ) {
          return false;
        }
      }
      return true;
    });

    expect(
      orphans,
      `nothing can reach these — route them or delete them:\n${orphans.join("\n")}`,
    ).toEqual([]);
  });
});
