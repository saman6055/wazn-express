import { describe, it, expect, vi, beforeEach } from "vitest";

const { error } = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../utils/logger", () => ({ appLogger: { error, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { installProcessGuards, onUnhandledRejection, onUncaughtException } from "./processGuards";

describe("a forgotten promise is a log line, not a dead server", () => {
  beforeEach(() => error.mockClear());

  it("writes the reason of an unhandled rejection and does not throw", () => {
    expect(() => onUnhandledRejection(new Error("pool is closed"))).not.toThrow();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][1]).toMatchObject({ error: "pool is closed" });
  });

  it("writes a non-Error reason as text", () => {
    onUnhandledRejection("gone");
    expect(error.mock.calls[0][1]).toMatchObject({ error: "gone" });
  });

  it("writes an uncaught exception the same way", () => {
    onUncaughtException(new Error("timer threw"));
    expect(error.mock.calls[0][1]).toMatchObject({ error: "timer threw" });
  });

  it("registers each listener once, however many times it is installed", () => {
    const before = process.listenerCount("unhandledRejection");
    installProcessGuards();
    installProcessGuards();
    expect(process.listenerCount("unhandledRejection")).toBe(before + 1);
    expect(process.listeners("uncaughtException")).toContain(onUncaughtException);
    process.off("unhandledRejection", onUnhandledRejection);
    process.off("uncaughtException", onUncaughtException);
  });
});
