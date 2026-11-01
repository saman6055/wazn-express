import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A picture reaches the order forms three ways (the owner asked for the two
 * that were missing, Sep 2026): the file dialog, dragging the file in, and
 * pasting it after copying from a shop page or a chat.
 *
 * Dragging only ever worked on the big upload box. The two order forms use
 * the small one — which had no drop handlers at all — so the layout that
 * needed it most was the one without it. Pasting existed nowhere.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const COMPONENT = "components/CompressedImageUpload.tsx";
const FORMS = ["pages/CommissionForm.tsx", "pages/FullPackageForm.tsx"];

describe("dragging a file in", () => {
  const src = read(COMPONENT);

  it("works on the small layout, which is the one the order forms use", () => {
    const compact = src.slice(src.indexOf("if (compact) {"), src.indexOf("{/* Preview modal */}"));
    expect(compact).toContain("onDrop={handleDrop}");
    expect(compact).toContain("onDragOver={handleDragOver}");
    expect(compact).toContain("onDragLeave={handleDragLeave}");
  });

  it("says on screen that the file has been caught", () => {
    expect(src).toContain("const [dragOver, setDragOver] = useState(false);");
    expect(src).toContain("setDragOver(true)");
    expect(src).toContain("setDragOver(false)");
    // Both layouts light up, not just one.
    expect(src.split("dragOver &&").length - 1).toBeGreaterThanOrEqual(2);
  });
});

describe("pasting a picture", () => {
  const src = read(COMPONENT);

  it("both layouts take a paste landing on them", () => {
    expect(src.split("onPaste={handlePaste}").length - 1).toBe(2);
  });

  it("a clipboard with no image is left completely alone", () => {
    // This is what keeps pasting text into a text field working.
    expect(src).toContain('if (item.kind !== "file" || !item.type.startsWith("image/")) continue;');
    expect(src).toContain("if (files.length === 0) return false;");
    // preventDefault only when an image was actually taken.
    expect(src).toContain("if (takePastedImages(e.clipboardData)) e.preventDefault();");
  });

  it("a full, disabled or busy box refuses rather than queueing", () => {
    expect(src).toContain("if (disabled || uploading || images.length >= maxImages) return false;");
  });

  it("the page-wide listener is opt-in and cleans up after itself", () => {
    expect(src).toContain("pasteAnywhere?: boolean;");
    expect(src).toContain("pasteAnywhere = false,");
    expect(src).toContain('if (!pasteAnywhere) return;');
    expect(src).toContain('document.addEventListener("paste", onPaste);');
    expect(src).toContain('return () => document.removeEventListener("paste", onPaste);');
  });

  it("the two order forms turn it on, because each has exactly one box", () => {
    for (const rel of FORMS) {
      expect(read(rel), rel).toContain("pasteAnywhere");
    }
  });
});

describe("the ways in are named, not guessed at", () => {
  it("the small box says so in all four languages", () => {
    const src = read(COMPONENT);
    expect(src).toContain('ku: "ڕایبکێشە یان Ctrl+V"');
    expect(src).toContain('en: "Drag or Ctrl+V"');
    expect(src).toContain('ar: "اسحب أو Ctrl+V"');
    expect(src).toContain('zh: "拖入或 Ctrl+V"');
  });
});

describe("one path handles every file, however it arrived", () => {
  it("paste hands its files straight to the same compressor", () => {
    const src = read(COMPONENT);
    expect(src).toContain("async (files: FileList | File[] | null) => {");
    expect(src).toContain("handleFileSelect(files);");
    // No DataTransfer round-trip just to satisfy a type.
    expect(src).not.toContain("new DataTransfer()");
  });
});
