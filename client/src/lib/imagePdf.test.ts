import { describe, expect, it } from "vitest";
import { buildImagePdf, dataUrlToBytes } from "./imagePdf";

/**
 * The receipt's file for WhatsApp is a PDF written by hand, so it is checked
 * by hand: a reader opens a PDF by reading the cross-reference table and
 * jumping to the byte each entry names. One wrong offset and the file does
 * not open at all — which the customer, not the office, would discover.
 */

const decode = (bytes: Uint8Array): string => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

// A minimal JPEG-looking run of bytes: the wrapper never decodes it, it only
// has to carry it through untouched.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);

describe("a PDF holding one picture", () => {
  const pdf = buildImagePdf(jpeg, 1000, 1400, { title: "BOX-1042" });
  const text = decode(pdf);

  it("is a PDF, with one page the shape of the picture", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Count 1");
    // A4 wide, and 1.4 times as tall as it is wide, like the picture.
    expect(text).toContain("/MediaBox [0 0 595.28 833.39]");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("carries the picture's bytes exactly as they came", () => {
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain(`/Length ${jpeg.length}`);
    const start = text.indexOf("stream\n", text.indexOf("4 0 obj")) + "stream\n".length;
    expect(Array.from(pdf.slice(start, start + jpeg.length))).toEqual(Array.from(jpeg));
  });

  it("every cross-reference offset lands on the object it names", () => {
    const xrefAt = Number(text.slice(text.lastIndexOf("startxref") + "startxref\n".length).split("\n")[0]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = text
      .slice(xrefAt)
      .split("\n")
      .filter((line) => /^\d{10} \d{5} [nf] $/.test(line));
    expect(entries.length).toBe(6);
    expect(entries[0]).toContain("65535 f");
    entries.slice(1).forEach((entry, index) => {
      const at = Number(entry.slice(0, 10));
      const marker = `${index + 1} 0 obj`;
      expect(text.slice(at, at + marker.length), `object ${index + 1}`).toBe(marker);
    });
  });

  it("draws the picture over the whole page, once", () => {
    expect(text).toContain("/XObject << /Im0 4 0 R >>");
    expect(text).toContain("595.28 0 0 833.39 0 0 cm");
    expect(text.split("/Im0 Do").length - 1).toBe(1);
  });

  it("does not let a box code close the title string early", () => {
    expect(decode(buildImagePdf(jpeg, 10, 10, { title: "BOX (2026) \\ 1" }))).toContain("/Title (BOX \\(2026\\) \\\\ 1)");
  });

  it("survives a picture of no size rather than writing a broken page", () => {
    const tiny = decode(buildImagePdf(jpeg, 0, 0));
    expect(tiny).toContain("/MediaBox [0 0 595.28 595.28]");
    expect(tiny).toContain("/Width 1 /Height 1");
  });
});

describe("the picture from the canvas", () => {
  it("is read out of its data URL byte for byte", () => {
    const dataUrl = `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
    expect(Array.from(dataUrlToBytes(dataUrl))).toEqual(Array.from(jpeg));
  });
});
