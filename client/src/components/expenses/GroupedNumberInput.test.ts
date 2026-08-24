import { describe, expect, it } from "vitest";

/**
 * The formatting rules, tested as arithmetic on strings.
 *
 * The component itself needs a DOM and this repo's tests run without one, so
 * the two functions that decide what is shown and what is reported are
 * mirrored here exactly as the component applies them. If the component's
 * expressions change, these have to change with them — which is the point:
 * they are short enough to keep honest, and the behaviour they describe is
 * the part that goes wrong.
 */

/** What the field shows, given what has been typed. */
const display = (value: string) => {
  if (value === "") return "";
  const [whole = "", ...rest] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length > 0 ? `${grouped}.${rest.join("")}` : grouped;
};

/** What the caller receives, given what is in the box. */
const clean = (typed: string) => {
  const cleaned = typed.replace(/[^\d.]/g, "");
  const firstPoint = cleaned.indexOf(".");
  return firstPoint === -1
    ? cleaned
    : cleaned.slice(0, firstPoint + 1) + cleaned.slice(firstPoint + 1).replace(/\./g, "");
};

describe("the mirror above still matches the component", () => {
  it("uses the same two expressions the component does", async () => {
    // A mirrored test is worth nothing the moment the original moves. These
    // are the two lines that decide everything above.
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.join(__dirname, "GroupedNumberInput.tsx"), "utf8");
    expect(src, "the grouping expression changed").toContain(
      String.raw`whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")`,
    );
    expect(src, "the cleaning expression changed").toContain(
      String.raw`e.target.value.replace(/[^\d.]/g, "")`,
    );
    expect(src, "the trailing-point rule changed").toContain("rest.length > 0");
  });
});

describe("a dinar figure is shown in threes", () => {
  it("marks thousands", () => {
    expect(display("15000")).toBe("15,000");
    expect(display("1520")).toBe("1,520");
    expect(display("150000")).toBe("150,000");
    expect(display("1000000")).toBe("1,000,000");
  });

  it("leaves short numbers alone", () => {
    expect(display("0")).toBe("0");
    expect(display("999")).toBe("999");
    expect(display("")).toBe("");
  });

  it("groups only the whole part", () => {
    expect(display("15000.75")).toBe("15,000.75");
  });

  it("keeps a trailing point while it is being typed", () => {
    // Reformatting "15." to "15" moves the caret and eats the next keystroke.
    expect(display("15.")).toBe("15.");
    expect(display("1500.")).toBe("1,500.");
  });
});

describe("what the field reports back is a plain number", () => {
  it("strips the separators it just added", () => {
    expect(clean("15,000")).toBe("15000");
    expect(clean("1,000,000")).toBe("1000000");
  });

  it("ignores anything that is not a digit", () => {
    // Pasting "15,000 IQD" off a receipt should not produce a broken number.
    expect(clean("15,000 IQD")).toBe("15000");
    expect(clean("$1,520")).toBe("1520");
    expect(clean("abc")).toBe("");
  });

  it("allows one decimal point and no more", () => {
    expect(clean("15.75")).toBe("15.75");
    expect(clean("15.7.5")).toBe("15.75");
  });

  it("survives a round trip", () => {
    for (const raw of ["0", "999", "15000", "1520", "1000000", "15000.75"]) {
      expect(clean(display(raw)), `round trip broke on ${raw}`).toBe(raw);
    }
  });
});
