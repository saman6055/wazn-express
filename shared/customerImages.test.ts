import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  isSafeCustomerImage,
  MAX_CUSTOMER_IMAGES,
  MAX_IMAGE_STRING_LENGTH,
} from "./customerImages";

const png = (body = "iVBORw0KGgo=") => `data:image/png;base64,${body}`;

/**
 * A customer's attachment is shown to a member of staff.
 *
 * The claim-review screen renders each one as `<img src={...}>` and opens it
 * with `window.open(...)` on click. The endpoint accepted an unbounded array
 * of unbounded strings of any shape, so all three of the cases below were
 * storable by anyone willing to send a request without using our form.
 */
describe("what a customer may attach", () => {
  it("accepts the images the upload widget actually produces", () => {
    // CompressedImageUpload pushes base64 data URLs.
    expect(isSafeCustomerImage(png())).toBe(true);
    expect(isSafeCustomerImage("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    expect(isSafeCustomerImage("data:image/webp;base64,UklGRg==")).toBe(true);
    // And paths we served ourselves, plus ordinary https images.
    expect(isSafeCustomerImage("/uploads/claims/abc-123.jpg")).toBe(true);
    expect(isSafeCustomerImage("https://cdn.example.com/a.png")).toBe(true);
  });

  it("refuses a payload that is not an image at all", () => {
    // The one that mattered: window.open on the staff screen would render
    // this as a page written by whoever sent it.
    expect(isSafeCustomerImage("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeCustomerImage("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeCustomerImage("javascript:alert(1)")).toBe(false);
    expect(isSafeCustomerImage("data:application/pdf;base64,JVBERi0=")).toBe(false);
    expect(isSafeCustomerImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
  });

  it("refuses a path that climbs out of uploads", () => {
    expect(isSafeCustomerImage("/uploads/../../etc/passwd")).toBe(false);
    expect(isSafeCustomerImage("/etc/passwd")).toBe(false);
    expect(isSafeCustomerImage("file:///etc/passwd")).toBe(false);
    // Plain http, so a staff screen cannot be made to fetch over the wire.
    expect(isSafeCustomerImage("http://example.com/a.png")).toBe(false);
  });

  it("bounds the size of a single attachment", () => {
    expect(isSafeCustomerImage(png("A".repeat(100)))).toBe(true);
    expect(isSafeCustomerImage(png("A".repeat(MAX_IMAGE_STRING_LENGTH)))).toBe(false);
  });

  it("refuses nothing at all", () => {
    expect(isSafeCustomerImage("")).toBe(false);
    expect(isSafeCustomerImage(null)).toBe(false);
    expect(isSafeCustomerImage(undefined)).toBe(false);
    expect(isSafeCustomerImage(123)).toBe(false);
    expect(isSafeCustomerImage({})).toBe(false);
  });
});

describe("the endpoints agree with the upload widget", () => {
  const ROUTER = fs.readFileSync(
    path.resolve(__dirname, "../server/routers/portal.router.ts"), "utf8");

  it("every customer image input is capped and checked", () => {
    // A bare array of strings here is the shape of the bug.
    const bare = [...ROUTER.matchAll(/(proofImages|productImages): z\.array\(z\.string\(\)\)/g)];
    expect(
      bare.map(m => m[1]),
      "use customerImagesSchema — a bare string array is unbounded and unchecked",
    ).toEqual([]);
    expect(ROUTER).toContain("customerImagesSchema");
  });

  it("the cap matches what the widget offers", () => {
    const widget = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/portal/PortalUnclaimedPackages.tsx"), "utf8");
    // If the widget is ever raised, the server has to be raised with it — the
    // point is that they agree, not that either number is sacred.
    expect(widget).toContain(`maxImages={${MAX_CUSTOMER_IMAGES}}`);
  });
});
