import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  isSafeAvatar,
  isSafeCustomerImage,
  MAX_AVATAR_STRING_LENGTH,
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

describe("a profile photo", () => {
  it("accepts an ordinary photo the portal produced", () => {
    expect(isSafeAvatar(png())).toBe(true);
    expect(isSafeAvatar(`data:image/jpeg;base64,${"A".repeat(50_000)}`)).toBe(true);
    expect(isSafeAvatar("/uploads/avatars/abc123.jpg")).toBe(true);
  });

  it("refuses anything that is not an image", () => {
    // The same trap the attachments have: this one is rendered on the
    // customer's own screen and on the office's customer page.
    expect(isSafeAvatar("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeAvatar("javascript:alert(1)")).toBe(false);
    expect(isSafeAvatar("/uploads/../../etc/passwd")).toBe(false);
  });

  it("is capped tighter than an attachment", () => {
    // It travels with the account on every screen that shows who is signed
    // in, so a 4 MB one would be paid for over and over.
    expect(MAX_AVATAR_STRING_LENGTH).toBeLessThan(MAX_IMAGE_STRING_LENGTH);
    const tooBig = `data:image/jpeg;base64,${"A".repeat(MAX_AVATAR_STRING_LENGTH)}`;
    expect(isSafeAvatar(tooBig)).toBe(false);
    // Still fine as an attachment — only the profile photo is held to this.
    expect(isSafeCustomerImage(tooBig)).toBe(true);
  });

  it("refuses an empty value rather than storing a blank photo", () => {
    // Removing a photo is its own action; it must not travel as "".
    expect(isSafeAvatar("")).toBe(false);
    expect(isSafeAvatar(null)).toBe(false);
    expect(isSafeAvatar(undefined)).toBe(false);
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

  it("the profile photo endpoint checks what it stores", () => {
    // It writes to the customer's own row and is rendered back on their
    // screen and on the office's customer page.
    expect(ROUTER).toContain("setMyPhoto: customerProcedure");
    expect(ROUTER).toMatch(/photo: z\.string\(\)\.refine\(isSafeAvatar/);
    // Removing is its own endpoint, so "no photo" never travels as a value
    // that has to be recognised as meaning nothing.
    expect(ROUTER).toContain("removeMyPhoto: customerProcedure");
  });

  it("every skin shows the photo through the same component", () => {
    // Three copies of shrink-check-upload would be three chances for one
    // skin to send a 6 MB photo straight from a camera roll.
    for (const skin of [
      "../client/src/pages/portal/PortalProfile.tsx",
      "../client/src/pages/portal/modern/ModernPortalProfile.tsx",
      "../client/src/pages/portal/skin3/Skin3PortalProfile.tsx",
    ]) {
      const src = fs.readFileSync(path.resolve(__dirname, skin), "utf8");
      expect(src, skin).toContain("PortalProfilePhoto");
    }
  });

  it("the cap matches what the widget offers", () => {
    const widget = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/portal/PortalUnclaimedPackages.tsx"), "utf8");
    // If the widget is ever raised, the server has to be raised with it — the
    // point is that they agree, not that either number is sacred.
    expect(widget).toContain(`maxImages={${MAX_CUSTOMER_IMAGES}}`);
  });
});
