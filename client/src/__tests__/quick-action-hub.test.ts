import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { PATH_TO_MODULE } from "../../shared/permissions";

/**
 * The quick action hub (Ctrl+K) — the owner's operations brief, 2026-09-16.
 *
 * It opens pages and runs commands by name. These keep every command pointed
 * at a page that exists, offered only to people who may open it, and the
 * hub itself free of anything that writes.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf8").replace(/\r\n/g, "\n");
const HUB = read("components/CommandPalette.tsx");

const ROUTES = [...read("App.tsx").matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => {
  const pattern = m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z]+/g, "[^/]+");
  return new RegExp(`^${pattern}$`);
});

const actionsBlock = HUB.slice(HUB.indexOf("export const HUB_ACTIONS"), HUB.indexOf("interface Destination"));

describe("every command lands on a page", () => {
  it("found the command list", () => {
    expect(actionsBlock.length).toBeGreaterThan(1000);
    expect([...actionsBlock.matchAll(/id: "/g)].length).toBeGreaterThanOrEqual(10);
  });

  it("each address is a route the app has", () => {
    const targets = [...actionsBlock.matchAll(/to: "([^"]+)"/g)].map((m) => m[1].split("?")[0]);
    expect(targets.length).toBeGreaterThan(5);
    const dead = targets.filter((t) => !ROUTES.some((r) => r.test(t)));
    expect(dead).toEqual([]);
  });

  it("each command is offered by the permission of a real page, asked without a query string", () => {
    const requires = [...actionsBlock.matchAll(/requires: "([^"]+)"/g)].map((m) => m[1]);
    expect(requires.length).toBe([...actionsBlock.matchAll(/id: "/g)].length);
    for (const r of requires) {
      expect(r, r).not.toContain("?");
      expect(ROUTES.some((route) => route.test(r)), r).toBe(true);
      expect(PATH_TO_MODULE[r], `${r} is governed by no permission`).toBeTruthy();
    }
  });
});

describe("the hub is wired the way it promises", () => {
  it("searches the sidebar the layout already narrowed to this person", () => {
    expect(read("components/DashboardLayout.tsx")).toContain(
      "<CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} destinations={menuGroups} />",
    );
    expect(HUB).toContain("HUB_ACTIONS.filter((a) => canViewPath(a.requires))");
  });

  it("does its own ranking, and learns what each person runs most", () => {
    expect(HUB).toContain("shouldFilter={false}");
    expect(HUB).toContain("recordOptionUse(USAGE_LIST");
    expect(HUB).toContain("rankOptions(all, usage");
  });

  it("opens the print window inside the key press, before the fetch", () => {
    const print = HUB.slice(HUB.indexOf("const printManifest"), HUB.indexOf("const actionItems"));
    expect(print.indexOf("openManifestWindow(")).toBeGreaterThan(-1);
    expect(print.indexOf("openManifestWindow(")).toBeLessThan(print.indexOf("batchManifest"));
    expect(print).toContain("showErrorToast(");
  });

  it("writes nothing", () => {
    expect(HUB).not.toMatch(/useMutation|\.mutate\(/);
  });

  it("new batch from the hub opens the page's own create dialog", () => {
    const batches = read("pages/Batches.tsx");
    expect(batches).toContain('if (new URLSearchParams(search).get("new") !== "1") return;');
    expect(batches).toContain("setIsCreateOpen(true);");
  });
});
