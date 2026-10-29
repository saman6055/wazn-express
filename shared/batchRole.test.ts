import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { batchRole } from "./batchRole";

/** Owner, 2026-10-29: the original must stand apart from the batches that hang on it. */
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("each batch's part in its carrier group", () => {
  const members = [
    { batchId: 116, twinOfBatchId: null, partial: false },
    { batchId: 127, twinOfBatchId: 116, partial: false },
    { batchId: 113, twinOfBatchId: null, partial: true },
    { batchId: 125, twinOfBatchId: null, partial: false },
  ];
  it("original, twin, part, shared", () => {
    expect(members.map((m) => batchRole(m, members))).toEqual(["original", "twin", "partial", "shared"]);
  });

  it("said on the group card, at the top of the edit form, and on the list rows", () => {
    expect(read("client/src/components/batches/CarrierGroupCard.tsx")).toContain('data-testid="carrier-group-role"');
    const page = read("client/src/pages/Batches.tsx");
    expect(page).toContain('data-testid="batch-edit-role"');
    expect(page).toContain("BATCH_ROLE_TONE.original)} data-testid=\"batch-original-chip\"");
  });
});
