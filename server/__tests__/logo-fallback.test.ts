import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { localUploadIsMissing } from "./services/localUpload";

/**
 * The company logo pointed at /uploads/P6kwp1Fivzn4.PNG after a redeploy had
 * taken the file itself: the URL answered with the app's own HTML, and every
 * logo on every screen fell back to a generic box. settings.getCompanyInfo now
 * answers such a logo as "no logo", so the mark built into the deploy shows
 * instead — and the rule deciding "gone" must never call anything gone except
 * our own file, missing from our own folder.
 */

let tmpDir: string;
const previous = process.env.UPLOADS_DIR;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wazn-logo-"));
  process.env.UPLOADS_DIR = tmpDir;
  fs.writeFileSync(path.join(tmpDir, "present.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterAll(() => {
  if (previous === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = previous;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("localUploadIsMissing", () => {
  it("reports our own upload whose file is gone", () => {
    expect(localUploadIsMissing("/uploads/P6kwp1Fivzn4.PNG")).toBe(true);
  });

  it("does not report an upload that is on disk", () => {
    expect(localUploadIsMissing("/uploads/present.png")).toBe(false);
    expect(localUploadIsMissing("/uploads/present.png?v=2")).toBe(false);
  });

  it("never judges what is not ours to judge", () => {
    for (const url of [
      "",
      null,
      undefined,
      "https://cdn.example.com/logo.png",
      "data:image/png;base64,AAAA",
      "/brand/wazn-logo.png",
      "/uploads/../secret.png",
    ]) {
      expect(localUploadIsMissing(url), String(url)).toBe(false);
    }
  });
});
