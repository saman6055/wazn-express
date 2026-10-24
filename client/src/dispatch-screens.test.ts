import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-24: the dispatch check in China, told to Erbil, read on arrival. */
describe("the dispatch check, on screen", () => {
  it("its page and its report, in the menu, under the batch scanner's permission", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('<Route path="/dispatch-check" component={DispatchCheck} />');
    expect(app).toContain('<Route path="/dispatch-check/:id/report" component={DispatchReport} />');
    expect(read("shared/permissions.ts")).toContain('"/dispatch-check": "batch_assignment_scanner",');
    expect(read("client/src/components/DashboardLayout.tsx")).toContain('path: "/dispatch-check" }');
  });

  it("the batch's code big, every scan answered, a reason when finishing short", () => {
    const page = read("client/src/pages/DispatchCheck.tsx");
    expect(page).toContain('data-testid="dispatch-batch-code"');
    expect(page).toContain('data-testid="dispatch-move-here"');
    expect(page).toContain("(left > 0 && (!s.mayFinishShort || note.trim().length < 3))");
  });

  it("every member of staff's bell, opening the newest report", () => {
    const bell = read("shared/riskBell.ts");
    expect(bell).toContain('"batch-dispatched": "/dispatch-check/latest/report",');
    expect(read("server/db/reports.db.ts")).toContain("countRecentDispatches(48)");
    expect(read("client/src/pages/DispatchReport.tsx")).toContain('params.id === "latest"');
  });

  it("Erbil's arrival check reads which carton each parcel was in", () => {
    const page = read("client/src/pages/ArrivalVerificationScanner.tsx");
    expect(page).toContain("trpc.dispatch.cartonsFor.useQuery({ batchIds: selectedBatchIds }");
    expect(page).toContain('data-testid="arrival-cartons"');
  });

  it("Quick Register in China: today's batch confirmed before the first registration", () => {
    const qr = read("client/src/pages/QuickRegister.tsx");
    expect(qr).toContain('if (inChina && batchId && batchId !== "none" && confirmedBatch !== batchId) {');
    expect(qr).toContain("<ChinaBatchBanner");
  });
});
