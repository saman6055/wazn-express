import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The table is chat_messages; a patch on `chatMessages` failed on every boot
 * and kept autoMigrate.success false, hiding real failures (audit 2026-11-05).
 */
const src = readFileSync(resolve(__dirname, "../_core/migrations.ts"), "utf8");

describe("chat message patches name the real table", () => {
  it("no ALTER on chatMessages", () => {
    expect(src).toContain("CREATE TABLE IF NOT EXISTS chat_messages");
    expect(src).not.toMatch(/ALTER TABLE chatMessages\b/);
  });
});
