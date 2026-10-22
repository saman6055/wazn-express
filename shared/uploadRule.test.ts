import { describe, expect, it } from "vitest";
import {
  base64Bytes,
  isStoredFileUrl,
  safeUploadExtension,
  uploadRefusal,
  UPLOAD_MAX_BYTES,
} from "./uploadRule";

/**
 * What a file sent to the server may be — the one rule every door uses.
 *
 * A customer could send `notes.html` through the portal's messenger and the
 * office would open it on the company's own address, script and all. These
 * tests write the line down.
 */
const kb = 1024;

describe("the stored extension is ours", () => {
  it("keeps an ordinary one, lower-cased", () => {
    expect(safeUploadExtension("Photo.JPG")).toBe("jpg");
    expect(safeUploadExtension("scan.png")).toBe("png");
    expect(safeUploadExtension("invoice.pdf")).toBe("pdf");
  });

  it("gives nothing for a name without one, so the caller picks a default", () => {
    expect(safeUploadExtension("no-extension")).toBe("");
    expect(safeUploadExtension("trailing.")).toBe("");
    expect(safeUploadExtension(undefined)).toBe("");
  });

  it("never lets a browser-runnable one through, whatever the name", () => {
    for (const name of ["page.html", "page.HTM", "x.xhtml", "mark.svg", "code.js", "m.mjs", "s.php", "d.xml"]) {
      expect(safeUploadExtension(name), name).toBe("");
    }
  });

  it("refuses an extension that is really a path", () => {
    expect(safeUploadExtension("a.x/../../y")).toBe("");
    expect(safeUploadExtension("a.b c")).toBe("");
  });
});

describe("what a door accepts", () => {
  const ok = (fileName: string, contentType: string, purpose: "image" | "file" = "file") =>
    uploadRefusal({ fileName, contentType, bytes: 50 * kb, purpose });

  it("pictures and documents pass the file door", () => {
    expect(ok("photo.jpg", "image/jpeg")).toBeNull();
    expect(ok("photo.heic", "image/heic")).toBeNull();
    expect(ok("receipt.pdf", "application/pdf")).toBeNull();
    expect(ok("list.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBeNull();
    expect(ok("bundle.zip", "application/zip")).toBeNull();
  });

  it("only pictures pass the image door", () => {
    expect(ok("photo.png", "image/png", "image")).toBeNull();
    expect(ok("receipt.pdf", "application/pdf", "image")).toBe("not_an_image");
    expect(ok("photo.png", "application/octet-stream", "image")).toBe("not_an_image");
  });

  it("refuses what a browser would run, at either door", () => {
    expect(ok("page.html", "text/html")).toBe("not_allowed");
    expect(ok("page.html", "text/html", "image")).toBe("not_allowed");
    expect(ok("mark.svg", "image/svg+xml", "image")).toBe("not_allowed");
    expect(ok("photo.jpg", "image/svg+xml", "image")).toBe("not_allowed");
    expect(ok("run.js", "text/javascript")).toBe("not_allowed");
    expect(ok("run.exe", "application/octet-stream")).toBe("not_allowed");
  });

  it("refuses an empty file and one past the ceiling", () => {
    expect(uploadRefusal({ fileName: "a.jpg", contentType: "image/jpeg", bytes: 0, purpose: "file" })).toBe("empty");
    expect(uploadRefusal({ fileName: "a.jpg", contentType: "image/jpeg", bytes: UPLOAD_MAX_BYTES + 1, purpose: "file" })).toBe("too_large");
    expect(uploadRefusal({ fileName: "a.jpg", contentType: "image/jpeg", bytes: UPLOAD_MAX_BYTES, purpose: "file" })).toBeNull();
  });
});

describe("measuring base64 without decoding it", () => {
  it("counts the decoded bytes, padding and data prefix aside", () => {
    const bytes = Buffer.from("hello world");
    expect(base64Bytes(bytes.toString("base64"))).toBe(bytes.length);
    expect(base64Bytes(`data:image/png;base64,${bytes.toString("base64")}`)).toBe(bytes.length);
    expect(base64Bytes(Buffer.from("ab").toString("base64"))).toBe(2);
    expect(base64Bytes("")).toBe(0);
    expect(base64Bytes(undefined)).toBe(0);
  });
});

describe("a link to a file we stored", () => {
  it("is a path into our uploads folder or an https address with a real host", () => {
    expect(isStoredFileUrl("/uploads/abc123XYZ_-.jpg")).toBe(true);
    expect(isStoredFileUrl("https://storage.example.com/uploads/x.png")).toBe(true);
  });

  it("is never a script, a plain http address or a machine on our own network", () => {
    expect(isStoredFileUrl("javascript:alert(1)")).toBe(false);
    expect(isStoredFileUrl("http://example.com/x.png")).toBe(false);
    expect(isStoredFileUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isStoredFileUrl("https://localhost/x")).toBe(false);
    expect(isStoredFileUrl("https://db.internal/x")).toBe(false);
    expect(isStoredFileUrl("/uploads/../.env")).toBe(false);
    expect(isStoredFileUrl("/etc/passwd")).toBe(false);
  });
});
