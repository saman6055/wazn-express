import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOptionUsage,
  rankOptions,
  readOptionUsage,
  recordOptionUse,
  TOP_COUNT,
  type OptionUsage,
} from "./optionUsage";

/** A minimal localStorage, since these tests run without a DOM. */
function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  (globalThis as any).localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  return data;
}

const opt = (value: string) => ({ value });
const valueOf = (o: { value: string }) => o.value;

beforeEach(() => {
  installStorage();
});

describe("remembering a pick", () => {
  it("counts picks and keeps the time of the last one", () => {
    recordOptionUse("productType", "clothes", 1000);
    recordOptionUse("productType", "clothes", 2000);
    expect(readOptionUsage("productType")).toEqual({ clothes: { count: 2, last: 2000 } });
  });

  it("keeps each list apart", () => {
    recordOptionUse("productType", "clothes", 1000);
    recordOptionUse("color", "clothes", 1000);
    recordOptionUse("color", "red", 1000);
    expect(Object.keys(readOptionUsage("productType"))).toEqual(["clothes"]);
    expect(Object.keys(readOptionUsage("color")).sort()).toEqual(["clothes", "red"]);
  });

  it("ignores an empty pick", () => {
    recordOptionUse("productType", "", 1000);
    expect(readOptionUsage("productType")).toEqual({});
  });

  it("forgets on request", () => {
    recordOptionUse("productType", "clothes", 1000);
    clearOptionUsage("productType");
    expect(readOptionUsage("productType")).toEqual({});
  });
});

describe("a browser that refuses storage", () => {
  it("reads as empty rather than throwing", () => {
    (globalThis as any).localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => readOptionUsage("productType")).not.toThrow();
    expect(readOptionUsage("productType")).toEqual({});
    expect(() => recordOptionUse("productType", "clothes")).not.toThrow();
    expect(() => clearOptionUsage("productType")).not.toThrow();
  });

  it("survives rubbish in storage", () => {
    installStorage({ "wazn-option-usage:productType": "not json" });
    expect(readOptionUsage("productType")).toEqual({});
    installStorage({ "wazn-option-usage:productType": '{"a":{"count":"x"},"b":{"count":2}}' });
    expect(readOptionUsage("productType")).toEqual({ b: { count: 2, last: 0 } });
  });
});

describe("ranking a list", () => {
  const options = ["Shoes", "clothes", "Jewellery", "Accessories", "Electronic", "Home"].map(opt);

  it("leaves an untouched list exactly as it came", () => {
    const { top, rest } = rankOptions(options, {}, valueOf);
    expect(top).toEqual([]);
    expect(rest.map(valueOf)).toEqual(["Shoes", "clothes", "Jewellery", "Accessories", "Electronic", "Home"]);
  });

  it("puts the most used first", () => {
    const usage: OptionUsage = {
      clothes: { count: 9, last: 100 },
      Accessories: { count: 4, last: 900 },
      Shoes: { count: 1, last: 950 },
    };
    const { top } = rankOptions(options, usage, valueOf);
    expect(top.map(valueOf)).toEqual(["clothes", "Accessories", "Shoes"]);
  });

  it("one stray pick never outranks a habit", () => {
    const usage: OptionUsage = {
      clothes: { count: 20, last: 1 },       // old but constant
      Electronic: { count: 1, last: 999999 }, // picked a moment ago, once
    };
    const { top } = rankOptions(options, usage, valueOf);
    expect(top.map(valueOf)[0]).toBe("clothes");
  });

  it("the most recent wins among equals", () => {
    const usage: OptionUsage = {
      Home: { count: 3, last: 500 },
      Jewellery: { count: 3, last: 700 },
    };
    const { top } = rankOptions(options, usage, valueOf);
    expect(top.map(valueOf)).toEqual(["Jewellery", "Home"]);
  });

  it("promotes only a handful, and the rest keep their own order", () => {
    const usage: OptionUsage = Object.fromEntries(
      options.map((o, i) => [o.value, { count: 10 - i, last: i }]),
    );
    const { top, rest } = rankOptions(options, usage, valueOf);
    expect(top).toHaveLength(TOP_COUNT);
    expect(rest.map(valueOf)).toEqual(["Home"]);
  });

  it("nothing is ever both promoted and left below", () => {
    const usage: OptionUsage = { clothes: { count: 2, last: 5 }, Home: { count: 1, last: 6 } };
    const { top, rest } = rankOptions(options, usage, valueOf);
    const overlap = top.map(valueOf).filter((v) => rest.map(valueOf).includes(v));
    expect(overlap).toEqual([]);
    expect(top.length + rest.length).toBe(options.length);
  });

  it("a remembered value that has left the list is simply gone", () => {
    const usage: OptionUsage = { Deleted: { count: 50, last: 999 }, Home: { count: 1, last: 1 } };
    const { top, rest } = rankOptions(options, usage, valueOf);
    expect(top.map(valueOf)).toEqual(["Home"]);
    expect(top.length + rest.length).toBe(options.length);
  });
});
