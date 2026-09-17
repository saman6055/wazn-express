import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * No hook after an early return.
 *
 * 2026-09-17: the box receipt's dinar window put a useState under
 * `if (!box) return …` in BoxDetailPanel. The render that waits for the box
 * called one hook fewer than the render that has it, React threw, and a box
 * that was not already loaded could not be opened. The types were right and
 * every test passed, so nothing said so.
 *
 * This reads each component and custom hook the way the rule of hooks does,
 * roughly: a top-level body is indented two spaces; an early return is a
 * two-space `if (…)` whose line or block holds a `return`; a two-space
 * statement calling `useX(` or `trpc.….useX(` after it is the bug.
 */

const SRC = __dirname;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const START = /^(export\s+(default\s+)?)?(function\s+(?:[A-Z]\w*|use[A-Z]\w*)\b|const\s+(?:[A-Z]\w*|use[A-Z]\w*)\s*=)/;
const HOOK = /^ {2}(?! )(?!\/\/)[^/]*?\b(?:use[A-Z]\w*|trpc(?:\.\w+)+\.use[A-Z]\w*)\s*[(<]/;

function hooksAfterEarlyReturn(source: string): Array<{ line: number; earlyReturn: number; text: string }> {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const found: Array<{ line: number; earlyReturn: number; text: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!START.test(lines[i])) continue;
    let early: number | null = null;
    let j = i + 1;
    for (; j < lines.length && !/^\}/.test(lines[j]); j++) {
      const line = lines[j];
      if (early === null && /^ {2}if \(/.test(line)) {
        if (/\breturn\b/.test(line)) early = j;
        else {
          for (let k = j + 1; k < lines.length && !/^ {2}\}/.test(lines[k]); k++) {
            if (/^ {4}return\b/.test(lines[k])) {
              early = j;
              break;
            }
          }
        }
      } else if (early !== null && HOOK.test(line)) {
        found.push({ line: j + 1, earlyReturn: early + 1, text: line.trim() });
      }
    }
    i = j;
  }
  return found;
}

describe("the rule of hooks", () => {
  it("the reader finds the mistake it was written for", () => {
    const broken = [
      "export function Panel({ id }: { id: number }) {",
      "  const { data } = trpc.box.getById.useQuery({ id });",
      "  if (!data) {",
      "    return <Spinner />;",
      "  }",
      "  const [open, setOpen] = useState(false);",
      "  return <div />;",
      "}",
    ].join("\n");
    expect(hooksAfterEarlyReturn(broken)).toEqual([{ line: 6, earlyReturn: 3, text: "const [open, setOpen] = useState(false);" }]);
    expect(hooksAfterEarlyReturn(broken.replace("  if (!data) {\n    return <Spinner />;\n  }\n", "") + "\n")).toEqual([]);
  });

  it("the box panel asks for every hook before it waits for the box", () => {
    const panel = fs.readFileSync(path.join(SRC, "components/delivery/BoxDetailPanel.tsx"), "utf8").replace(/\r\n/g, "\n");
    const early = panel.indexOf("  if (!box) {");
    const hook = panel.indexOf("const [receiptRequest, setReceiptRequest] = useState");
    expect(early).toBeGreaterThan(-1);
    expect(hook).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(early);
  });

  it("no component or hook in the app calls a hook after an early return", () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(300);
    const offenders = files.flatMap((file) =>
      hooksAfterEarlyReturn(fs.readFileSync(file, "utf8")).map(
        (f) => `${path.relative(SRC, file).replace(/\\/g, "/")}:${f.line} (early return at ${f.earlyReturn}): ${f.text}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
