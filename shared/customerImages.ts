/**
 * What a customer is allowed to attach.
 *
 * The portal uploads photos as base64 data URLs — proof of ownership on a
 * claim, product photos on a pre-declaration — and the value travels straight
 * into a JSON column and out again onto a staff screen, where it is rendered
 * as `<img src={...}>` and opened with `window.open(...)` when clicked.
 *
 * Nothing checked it. The upload widget caps the count at five and compresses
 * to 1200px, but that is the widget being polite; the endpoint behind it took
 * an unbounded array of unbounded strings of any shape at all. Three things
 * followed from that, and none of them need a clever attacker — only somebody
 * willing to send a request without using our form:
 *
 *  - thousands of entries in one claim, stored, and then all rendered at once
 *    the next time a member of staff opens the review screen;
 *  - megabytes per entry, repeated, straight into the database;
 *  - `data:text/html,...` instead of an image, which `window.open` on the
 *    staff screen would happily render as a page of somebody else's making.
 *
 * So the shape is stated here, once, and both entry points check it.
 */

/** Five is what the upload widget offers; the server agrees rather than assumes. */
export const MAX_CUSTOMER_IMAGES = 5;

/**
 * Roughly 4 MB of base64, so about 3 MB of image.
 *
 * The compressor targets 1200px at quality 0.8, which lands far below this.
 * The cap is here to bound the worst case, not to second-guess the widget.
 */
export const MAX_IMAGE_STRING_LENGTH = 4_000_000;

/** Only actual image types. `data:text/html` is the one that mattered. */
const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * A path we served ourselves.
 *
 * `..` is excluded rather than allowed and stripped later: `/uploads/` plus
 * dots and slashes is `/uploads/../../etc/passwd`, which is a path that starts
 * where we meant and ends anywhere.
 */
const UPLOAD_PATH = /^\/uploads\/(?!.*\.\.)[A-Za-z0-9._\-/]+$/;

/** An ordinary https image URL, for anything already stored off-box. */
const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/;

/**
 * Is this something we are willing to store and later show to a staff member?
 *
 * Allow-listed rather than sanitised: the question "which of these is
 * dangerous" has a long tail, and "which of these is an image we produced"
 * does not.
 */
export function isSafeCustomerImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_IMAGE_STRING_LENGTH) return false;
  return DATA_IMAGE.test(value) || UPLOAD_PATH.test(value) || HTTPS_URL.test(value);
}
