import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DIRS = [
  path.resolve(__dirname, "pages/portal"),
  path.resolve(__dirname, "components/portal"),
  path.resolve(__dirname, "components"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const FILES = [...new Set(DIRS.flatMap((d) => walk(d)))];

describe("one control, announced once", () => {
  it("covers the portal and its layouts", () => {
    expect(FILES.length).toBeGreaterThan(40);
  });

  /**
   * `<Link><button>…</button></Link>` renders `<a href><button>`. That is
   * invalid HTML, and in practice both elements take tab focus and both
   * compute their name from the same text — so a keyboard user stops twice on
   * one control and a screen reader reads it twice. The five tabs across the
   * bottom of every portal page did this, and seventeen other places.
   *
   * The anchor is what navigates, so it is the only interactive element; what
   * was inside is a span carrying the same classes.
   */
  it("no link wraps a button", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/<Link\b[^>]*>\s*\n?\s*<button\b/g)) {
        offenders.push(`${path.basename(file)}:${src.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(
      offenders,
      offenders.length ? `put the classes on the Link instead:\n  ${offenders.join("\n  ")}` : "",
    ).toEqual([]);
  });

  /**
   * The current tab has to be announced as such, not just coloured. Colour is
   * the only thing that said "you are here" before.
   */
  it("the bottom navigation marks the current page", () => {
    const layout = fs.readFileSync(
      path.resolve(__dirname, "components/CustomerPortalLayout.tsx"), "utf8");
    expect(layout).toMatch(/aria-current=\{isActive \? "page" : undefined\}/);
    expect(layout).toMatch(/aria-current=\{isHomeActive \? "page" : undefined\}/);
  });
});

describe("unnesting a button did not flatten it", () => {
  /**
   * A <button> is inline-block; a <span> is inline. Four of the eighteen
   * spans that replaced a button set no display of their own, so their
   * padding stopped pushing their neighbours and their rounded backgrounds
   * sat wrong — the notification bell on the home page among them.
   */
  const SETS_DISPLAY = /\b(inline-flex|inline-grid|inline-block|flex|grid|block|hidden|table)\b/;

  it("every span standing in for a button sets a display", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/<Link\b[^>]*>\s*\n?\s*<span\b/g)) {
        const start = src.indexOf("<span", m.index);
        // Walk to the end of the opening tag, respecting braces and strings.
        let k = start, inStr: string | null = null, braces = 0, end = -1;
        while (k < src.length) {
          const c = src[k];
          if (inStr) { if (c === inStr) inStr = null; }
          else if (c === '"' || c === "'" || c === "`") inStr = c;
          else if (c === "{") braces++;
          else if (c === "}") braces--;
          else if (c === ">" && braces === 0) { end = k; break; }
          k++;
        }
        const tag = src.slice(start, end + 1);
        if (!SETS_DISPLAY.test(tag)) {
          offenders.push(`${path.basename(file)}:${src.slice(0, start).split("\n").length}`);
        }
      }
    }

    expect(
      offenders,
      offenders.length ? `an inline span cannot carry padding:\n  ${offenders.join("\n  ")}` : "",
    ).toEqual([]);
  });
});
