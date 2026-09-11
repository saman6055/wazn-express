import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's list, item 5 (2026-09-11): weight is written `kg`, in every
 * language — not KG in one place, کگ or کیلۆ in another, كغ or 公斤 in a third.
 *
 * What is allowed to stay: کیلۆ / كيلو / 公斤 as words in a sentence with no
 * figure in front of them ("پێنج کیلۆیە", "五公斤" — somebody's own words).
 */
const SRC = path.resolve(__dirname);
const LETTER = "\\u0620-\\u065F\\u0670-\\u06D3\\u06D5\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF";

const OTHER_SPELLINGS: [string, RegExp][] = [
  ["KG / Kg", /\bK[Gg]\b/],
  ["کگ / کگم", new RegExp(`(?<![${LETTER}])کگم?(?![${LETTER}])`)],
  ["كغ / كغم", new RegExp(`(?<![${LETTER}])كغم?(?![${LETTER}])`)],
  ["公斤 after a figure", /[0-9]\s*公斤/],
  ["کیلۆ after a figure", /[0-9}]\s*کیلۆ/],
];

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (/\.(ts|tsx|json)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("weight is written kg", () => {
  const all = files(SRC).map((file) => ({ rel: path.relative(SRC, file), lines: fs.readFileSync(file, "utf8").split("\n") }));

  it.each(OTHER_SPELLINGS)("no screen or translation writes %s", (_name, spelling) => {
    const hits: string[] = [];
    for (const { rel, lines } of all) {
      lines.forEach((line, i) => {
        if (spelling.test(line)) hits.push(`${rel}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
