/**
 * What to do when an image will not load.
 *
 * Nearly every picture in the portal comes from somewhere that can fail: a
 * product photo the customer uploaded months ago, a blog cover the office
 * replaced, an attachment on a support message, a delivery photo. When the URL
 * is dead the browser draws its broken-image icon — a torn page glyph, usually
 * grey, sitting in the middle of an otherwise finished card. It looks like the
 * app is broken rather than like one picture is missing.
 *
 * Hiding the image is better than that: the container keeps its size and its
 * background, and the card reads as "no photo" instead of "something went
 * wrong". `data-img-failed` is left on the parent so a caller that wants to
 * put something in the gap can style for it.
 *
 * Deliberately not a placeholder image — that would be another request that
 * can itself fail, and a second thing to keep in the build.
 */
export function onImageError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  // React can fire this again on re-render; do the work once.
  if (img.dataset.failed === "1") return;
  img.dataset.failed = "1";
  img.style.display = "none";
  img.parentElement?.setAttribute("data-img-failed", "true");
}
