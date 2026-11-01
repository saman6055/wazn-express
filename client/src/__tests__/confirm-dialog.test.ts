import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { confirmAction, confirmDanger } from "./components/ConfirmDialog";

/**
 * The owner's list, item 4 (2026-09-11): no screen asks "are you sure?" with
 * the browser's own box. It spoke the phone's language instead of the one
 * chosen in the app, showed the site's address as a heading, and offered to
 * stop asking altogether — after which deletes went through unasked.
 */
const SRC = path.resolve(__dirname);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("asking before something is done", () => {
  it("never uses the browser's confirm box", () => {
    const own = path.join(SRC, "components", "ConfirmDialog.tsx");
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file === own) continue; // its fallback, before the dialog is mounted
      fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/(?<![\w.])confirm\(|window\.confirm\(/.test(line)) {
          hits.push(`${path.relative(SRC, file)}:${i + 1}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it("the dialog is mounted once, for every screen", () => {
    const app = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
    expect(app.match(/<ConfirmHost \/>/g)?.length).toBe(1);
  });

  it("restoring a backup still asks twice", () => {
    const page = fs.readFileSync(path.join(SRC, "pages", "BackupManagement.tsx"), "utf8");
    expect(page.match(/await confirmDanger\(/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("before the dialog is mounted", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the browser's box answers, rather than a question nobody can see", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("window", { confirm });
    await expect(confirmDanger("Delete this?")).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith("Delete this?");
  });

  it("and without a browser at all, the answer is No", async () => {
    vi.stubGlobal("window", undefined);
    await expect(confirmAction({ message: "Send to everyone?" })).resolves.toBe(false);
  });
});
