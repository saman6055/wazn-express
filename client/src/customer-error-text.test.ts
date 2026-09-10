import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { isNetworkFault, networkFault, NetworkFault } from "./lib/networkFault";
import { NETWORK_FAULT_TEXT } from "@shared/errorMessages";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("a dropped connection is described in the reader's language", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("in Kurdish by default, in the stored language otherwise", () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    expect(networkFault(new TypeError("Failed to fetch")).message).toBe(NETWORK_FAULT_TEXT.ku);
    vi.stubGlobal("localStorage", { getItem: () => "ar" });
    expect(networkFault(new TypeError("Load failed")).message).toBe(NETWORK_FAULT_TEXT.ar);
  });

  it("stays a TypeError, keeps the browser's error as its cause, and is found through tRPC's wrapper", () => {
    vi.stubGlobal("localStorage", { getItem: () => "en" });
    const original = new TypeError("Failed to fetch");
    const fault = networkFault(original);
    expect(fault).toBeInstanceOf(TypeError);
    expect(fault).toBeInstanceOf(NetworkFault);
    expect((fault as { cause?: unknown }).cause).toBe(original);
    const wrapped = Object.assign(new Error(fault.message), { cause: fault });
    expect(isNetworkFault(wrapped)).toBe(true);
    expect(isNetworkFault(new Error("Duplicate entry"))).toBe(false);
    expect(isNetworkFault(null)).toBe(false);
  });
});

describe("the wiring", () => {
  it("every API call carries the reader's language and names its own network failures", () => {
    const main = read("main.tsx");
    expect(main).toContain("[LANG_HEADER]: storedLanguage()");
    expect(main).toContain("throw networkFault(err)");
    // react-query cancels by aborting; an abort must stay an abort.
    expect(main).toMatch(/AbortError[\s\S]{0,40}throw err/);
  });

  it("both network detectors recognise the renamed error", () => {
    expect(read("contexts/OfflineContext.tsx")).toContain("isNetworkFault(error)");
    expect(read("components/QueryErrorBoundary.tsx")).toContain("isNetworkFault(error)");
  });

  it("page-view tracking never toasts a customer", () => {
    const layout = read("components/CustomerPortalLayout.tsx");
    const start = layout.indexOf("trackActivity.useMutation(");
    expect(start).toBeGreaterThan(-1);
    expect(layout.slice(start, start + 120)).toContain("skipGlobalToast: true");
  });
});
