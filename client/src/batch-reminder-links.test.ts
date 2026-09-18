import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The batches waiting for their number: each one copies its code, and a click
 * shows it in the batches list, wherever it is (owner, 2026-09-18: "I want to
 * copy the batch's name to search for it in the list, and I can't; or when I
 * click it, take me to it in the list").
 *
 * When a sea batch is worth asking about is unit-tested with the rest of the
 * rule in shared/batchReminders.test.ts.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), "utf8").replace(/\r\n/g, "\n");
const batches = read("pages/Batches.tsx");
const dashboard = read("pages/Dashboard.tsx");

describe("on the batches page", () => {
  it("each batch in the reminder copies its code and shows it in the list", () => {
    expect(batches).toContain("onClick={() => showInList(batch.batchCode)}");
    const start = batches.indexOf("{awaitingNumber.slice(0, 8).map((batch: any) => (");
    expect(start).toBeGreaterThan(-1);
    const chips = batches.slice(start, batches.indexOf("{awaitingNumber.length > 8 && (", start));
    expect(chips).toContain("<CopyButton value={batch.batchCode}");
    expect(chips).not.toContain("openEditDialog(batch)");
  });

  it("showing it goes through the search, so a batch on another page or in the archive is found too", () => {
    const start = batches.indexOf("const showInList = (code: string) => {");
    expect(start).toBeGreaterThan(-1);
    const fn = batches.slice(start, batches.indexOf("\n  };\n", start));
    expect(fn).toContain("setSearchText(code);");
    expect(fn).toContain("setFocusCode(code);");
  });

  it("the row is marked and brought into view", () => {
    expect(batches).toContain("data-batch-code={batch.batchCode}");
    expect(batches).toContain('focusCode === batch.batchCode && "bg-amber-50 ring-2 ring-inset ring-amber-500 dark:bg-amber-950/30"');
    expect(batches).toContain('scrollPageTo(row, "center");');
    // Up and down only: the page must not slide sideways to reach it.
    expect(batches).toContain('window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });');
    expect(batches).not.toMatch(/listTopRef\.current\?\.scrollIntoView|row\.scrollIntoView/);
  });

  it("and /batches?find=<code> arrives the same way", () => {
    expect(batches).toContain('const asked = new URLSearchParams(search).get("find");');
  });
});

describe("on the dashboard", () => {
  it("the same reminder copies each code, and a click opens it in the batches list", () => {
    expect(dashboard).toContain("onClick={() => setLocation(`/batches?find=${encodeURIComponent(batch.batchCode)}`)}");
    const start = dashboard.indexOf("{awaitingNumber.slice(0, 6).map((batch: any) => (");
    expect(start).toBeGreaterThan(-1);
    const chips = dashboard.slice(start, dashboard.indexOf("{awaitingNumber.length > 6 && (", start));
    expect(chips).toContain("<CopyButton value={batch.batchCode}");
  });
});

describe("the words under the title", () => {
  it("say what a click does now, in every language", () => {
    const locales = path.join(__dirname, "locales");
    const desc = (lang: string) =>
      JSON.parse(fs.readFileSync(path.join(locales, `${lang}.json`), "utf8").replace(/^﻿/, "")).batches.awaitingNumberDesc as string;
    expect(desc("ku")).toContain("لە لیستەکەدا نیشانت بدات");
    expect(desc("en")).toContain("Click a batch to see it in the list");
    expect(desc("ar")).toContain("لعرضها في القائمة");
    expect(desc("zh")).toContain("在列表中查看");
  });
});
