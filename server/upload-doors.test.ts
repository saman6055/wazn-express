import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Every file that reaches the server comes through one door.
 *
 * Five procedures took a file as base64; four of them asked nothing about it
 * and stored it under whatever extension the sender's name carried, in a
 * folder served to anyone with the link. The rule now lives in
 * shared/uploadRule, the server's door is lib/uploadGate.acceptUpload, and
 * this test holds every procedure that takes a file to it — including the
 * one written next year.
 */
const ROUTERS = path.join(__dirname, "routers");

/** A file arrives as one of these input fields. */
const FILE_FIELDS = /\b(base64Data|fileData|base64)\s*:\s*z\.string\(\)/g;

/** Doors with a rule of their own, named so adding to this list is an argument. */
const OWN_RULE: Record<string, string> = {
  // The staff chat's list is the rule itself (shared/staffChatAttachment),
  // applied in storeStaffAttachment() before anything is written.
  "staffChat.router.ts": "storeStaffAttachment(",
  // A font is checked by format and size (fontFormatFor, MAX_FONT_BYTES).
  "settings.router.ts": "fontFormatFor(",
};

function proceduresTakingFiles(): { file: string; at: number; body: string }[] {
  const out: { file: string; at: number; body: string }[] = [];
  for (const file of fs.readdirSync(ROUTERS).filter((f) => /\.router\.ts$/.test(f))) {
    const src = fs.readFileSync(path.join(ROUTERS, file), "utf8");
    for (const m of src.matchAll(FILE_FIELDS)) {
      // From the field to the end of that procedure's handler: the next
      // `Procedure` declaration, or the end of the file.
      const start = m.index ?? 0;
      const next = src.slice(start + 1).search(/\n\s+[a-zA-Z]+: [a-zA-Z]+Procedure\b/);
      const body = src.slice(start, next === -1 ? undefined : start + 1 + next);
      out.push({ file, at: start, body });
    }
  }
  return out;
}

describe("every file comes through the one door", () => {
  const doors = proceduresTakingFiles();

  it("finds the doors at all (the regex must still match the routers)", () => {
    expect(doors.length).toBeGreaterThanOrEqual(6);
  });

  for (const door of doors) {
    it(`${door.file} @${door.at} checks the file before storing it`, () => {
      const own = OWN_RULE[door.file];
      const passes = door.body.includes("acceptUpload(") || (own !== undefined && door.body.includes(own));
      expect(passes, `${door.file}: a file is taken without acceptUpload()`).toBe(true);
      // The stored name is never the sender's: no raw extension reaches disk.
      expect(door.body).not.toMatch(/fileName\.split\("\."\)\.pop\(\)/);
      expect(door.body).not.toMatch(/localUpload\(input\.fileName/);
    });
  }
});

describe("the disk never keeps the sender's extension", () => {
  it("localUpload derives it from the shared rule", () => {
    const src = fs.readFileSync(path.join(__dirname, "services/localUpload.ts"), "utf8");
    expect(src).toContain("safeUploadExtension(fileName)");
    expect(src).not.toContain("path.extname(fileName) ||");
  });
});

describe("a stored file is handed back inert, from both entries", () => {
  const serve = fs.readFileSync(path.join(__dirname, "_core/uploadsServe.ts"), "utf8");

  it("a page or an SVG may run nothing", () => {
    expect(serve).toContain("default-src 'none'");
    expect(serve).toContain("sandbox");
    expect(serve).toContain('res.setHeader("Content-Disposition", "attachment")');
    for (const ext of ['".html"', '".svg"', '".js"', '".xhtml"']) expect(serve).toContain(ext);
  });

  it("both servers serve /uploads with the same options", () => {
    for (const entry of ["_core/prod-entry.ts", "_core/index.ts"]) {
      const src = fs.readFileSync(path.join(__dirname, entry), "utf8");
      expect(src, entry).toContain("express.static(uploadsDir, uploadsStaticOptions)");
    }
  });
});
