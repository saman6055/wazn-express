import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { batchTypeMark, journeyStep } from "./batchJourney";

/** The batches list redesign (owner, 2026-10-27). */
const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the journey line", () => {
  it("one step per status", () => {
    expect(journeyStep("preparing")).toBe(0);
    expect(journeyStep("in_transit")).toBe(1);
    for (const s of ["arrived", "customs", "at_depot"]) expect(journeyStep(s)).toBe(2);
    for (const s of ["delivered", "closed"]) expect(journeyStep(s)).toBe(3);
  });

  it("ship for sea, plane for air, the red plane for irregular", () => {
    expect(batchTypeMark("sea")).toBe("sea");
    expect(batchTypeMark("air_regular")).toBe("air");
    expect(batchTypeMark("air_irregular")).toBe("air_irregular");
    expect(root("client/src/components/batches/BatchListBits.tsx")).toContain('mark === "air_irregular" && "bg-rose-500/15 text-rose-600 dark:text-rose-300"');
  });
});

describe("the page", () => {
  const page = root("client/src/pages/Batches.tsx");
  it("each row: type icon, CN / IQ, journey, quiet missing dots", () => {
    expect(page).toContain("<BatchTypeIcon shippingType={batch.shippingType} language={language} />");
    expect(page).toContain("<BatchOriginChip china={isChinaBatch(batch as never)} language={language} />");
    expect(page).toContain("<BatchJourney stage={stageOf(batch)} china={isChinaBatch(batch as never)} language={language} />");
    expect(page).toContain("<MissingDots");
  });

  it("the waybill notice folds to one line", () => {
    expect(page).toContain("{awaitingNumber.length > 0 && showAwaiting && (");
    expect(page).toContain('data-testid="batch-awaiting-toggle"');
  });

  it("motion only where the viewer has not asked for less", () => {
    const bits = root("client/src/components/batches/BatchListBits.tsx");
    expect(bits).not.toMatch(/[^:]animate-(ping|pulse)/);
    expect(bits).toContain("motion-safe:animate-ping");
  });

  it("the depot status has words in every language", () => {
    for (const l of ["ku", "en", "ar", "zh"]) {
      const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", `client/src/locales/${l}.json`), "utf8").replace(/^\uFEFF/, ""));
      expect(j.status.at_depot, l).toBeTruthy();
    }
  });
});
