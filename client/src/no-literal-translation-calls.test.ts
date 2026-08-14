import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Nothing shows the reader the source of a translation call.
 *
 * Somewhere in the history a tool wrapped strings in `t("…")` and, in a few
 * places, wrapped the quotes too. The result is a string literal whose
 * contents are `{t("common.customer")}`, which React renders exactly as
 * written. Four of them were live: a debtor with no name on file was listed
 * as `{t("common.customer")}`, two PDF buttons said `{t("auto.text_8d68fe")}…`
 * while exporting, and the balance sheet's Excel export was a spreadsheet of
 * them.
 *
 * They typecheck, they never throw, and they look like every other label in
 * the file. Only a reader notices — which is the worst way to find out.
 */

const ROOTS = [
  path.resolve(__dirname),
  path.resolve(__dirname, "../../server"),
  path.resolve(__dirname, "../../shared"),
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "locales", "dist"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => sourceFiles(r));

/** `'{t("x")}'`, `"{t('x')}"` or a template literal wrapping the same. */
const LITERAL_CALL = /['"`]\s*\{\s*t\s*\(/;

describe("the files this is checking", () => {
  it("found them", () => {
    expect(FILES.length).toBeGreaterThan(200);
  });
});

describe("a label is a label, not the code that would produce one", () => {
  it("no string literal contains a translation call", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        // A comment quoting the bug is how it gets explained, not committed.
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        if (LITERAL_CALL.test(code)) {
          const rel = path.relative(path.resolve(__dirname, "../.."), file).replace(/\\/g, "/");
          offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(
      offenders,
      `these render the call itself to the reader — drop the quotes:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
