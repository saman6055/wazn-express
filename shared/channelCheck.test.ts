import { describe, it, expect } from "vitest";
import { makeChannelCheck } from "./channelCheck";

describe("weekly FIB / Qi check (owner, 2026-11-05)", () => {
  it("the first check is the starting point; nothing went out yet", () => {
    const c = makeChannelCheck({ at: "2026-11-01T00:00:00Z", rate: 1680, fibIqd: 1_680_000, qiIqd: 168_000 }, null, null);
    expect([c.fibUsd, c.qiUsd, c.fibOutUsd, c.qiOutUsd]).toEqual([1000, 100, null, null]);
  });
  it("went out = before + received there − now", () => {
    const before = makeChannelCheck({ at: "2026-11-01T00:00:00Z", rate: 1680, fibIqd: 1_680_000, qiIqd: 168_000 }, null, null);
    const c = makeChannelCheck({ at: "2026-11-08T00:00:00Z", rate: 1680, fibIqd: 1_512_000, qiIqd: 336_000 }, before, { fibUsd: 3410, qiUsd: 200 });
    expect([c.fibUsd, c.fibInUsd, c.fibOutUsd]).toEqual([900, 3410, 3510]);
    expect([c.qiUsd, c.qiInUsd, c.qiOutUsd]).toEqual([200, 200, 100]);
  });
});
