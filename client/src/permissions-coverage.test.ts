import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { PERMISSION_GROUPS, PATH_TO_MODULE } from "../../shared/permissions";

/**
 * The permission list has to keep up with the sidebar, and nothing was making
 * it.
 *
 * `canViewPath` ends with `if (!moduleName) return true` — a page nobody
 * mapped is shown to everybody. That is a sensible fallback and a terrible
 * silent default: thirteen sidebar pages had drifted past it and were visible
 * to every staff member no matter what their permissions said. Two more
 * mappings pointed at paths that had been renamed months earlier, so those
 * permissions governed nothing while still appearing to work in the admin UI.
 *
 * None of it could be noticed by reading either file alone, which is why it
 * is checked here rather than left to review.
 */

const REPO = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(REPO, p), "utf8");

/** Every `path:` on a sidebar entry in DashboardLayout. */
function sidebarPaths(): string[] {
  const src = read("client/src/components/DashboardLayout.tsx");
  const found = [...src.matchAll(/path:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  return [...new Set(found)].filter((p) => p.startsWith("/"));
}

/** Every route the app actually declares. */
function appRoutes(): Set<string> {
  const src = read("client/src/App.tsx");
  return new Set([...src.matchAll(/<Route path=["']([^"']+)["']/g)].map((m) => m[1]));
}

const allModules = PERMISSION_GROUPS.flatMap((g) => g.modules);

describe("permission coverage", () => {
  it("reads a plausible sidebar and route list", () => {
    // Guard the guard: if either regex stops matching, every test below would
    // pass against an empty set instead of failing.
    expect(sidebarPaths().length).toBeGreaterThan(40);
    expect(appRoutes().size).toBeGreaterThan(40);
    expect(allModules.length).toBeGreaterThan(40);
  });

  it("every sidebar page is governed by a permission", () => {
    // Unmapped means visible to everyone — see canViewPath in usePermissions.
    const ungoverned = sidebarPaths().filter((p) => !PATH_TO_MODULE[p]);
    expect(ungoverned, "add these to PATH_TO_MODULE or they are open to all staff").toEqual([]);
  });

  it("no permission points at a page that no longer exists", () => {
    const routes = appRoutes();
    const dead = Object.keys(PATH_TO_MODULE).filter((p) => !routes.has(p));
    expect(dead, "these paths were renamed; their permissions govern nothing").toEqual([]);
  });

  it("every mapped module is actually defined", () => {
    const defined = new Set(allModules.map((m) => m.module));
    const missing = [...new Set(Object.values(PATH_TO_MODULE))].filter((m) => !defined.has(m));
    expect(missing, "mapped to a module that no group declares").toEqual([]);
  });

  it("every module the admin can toggle controls a real page", () => {
    // A switch that governs nothing is worse than no switch: it reads as
    // having taken access away when it has not.
    const reachable = new Set(Object.values(PATH_TO_MODULE));
    const orphans = allModules.map((m) => m.module).filter((m) => !reachable.has(m));
    expect(orphans, "these switches do nothing — map or remove them").toEqual([]);
  });

  it("no module is declared twice", () => {
    // A duplicate shows the admin the same row twice, in two groups, with
    // two switches writing to one record.
    const seen = new Set<string>();
    const dupes = allModules.map((m) => m.module).filter((m) => !seen.add(m) && true);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it("every module and group is named in both languages", () => {
    const unnamed: string[] = [];
    for (const group of PERMISSION_GROUPS) {
      if (!group.label.trim() || !group.labelKu.trim()) unnamed.push(`group ${group.id}`);
      for (const m of group.modules) {
        if (!m.label.trim() || !m.labelKu.trim()) unnamed.push(m.module);
        for (const sp of m.subPermissions) {
          if (!sp.label.trim() || !sp.labelKu.trim()) unnamed.push(`${m.module}::${sp.key}`);
        }
      }
    }
    expect(unnamed, "an unnamed row cannot be found by search").toEqual([]);
  });
});
