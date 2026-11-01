/**
 * Print a freshly written window once its images and fonts have arrived.
 *
 * Several reports called print() the instant their HTML was written, or a
 * quarter-second later. That was harmless while they were text only; with the
 * logo in the header, the print dialog could capture the page before the
 * image landed and put a blank where the mark should be. This waits for every
 * image to load or fail, and for the page's web fonts — a Kurdish page
 * printed before its typeface arrived comes out in the fallback font — or for
 * `maxWaitMs`, so a slow network never leaves the dialog unopened.
 *
 * Call it from the page that opened the window. A `<script>` written into the
 * window never runs in production: the security policy runs scripts from
 * this site's files only, and an inline one is not a file.
 */
export function printWhenReady(
  w: Window,
  maxWaitMs = 1500,
  /**
   * One last look at the finished page, before the dialog opens.
   *
   * It runs here rather than at the call site because here is the only
   * moment that is both after the images and fonts have arrived and before
   * anything is paginated — and a receipt is measured with its stamp on it
   * (lib/printFit). Runs exactly once, on whichever path gets there first.
   */
  beforePrint?: (w: Window) => void,
): void {
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    try {
      beforePrint?.(w);
    } catch {
      // A last touch that fails must never cost the print itself.
    }
    const asked = Date.now();
    w.print();
    // Chrome holds here until the dialog is shut, and afterprint does not
    // always follow, which left the window standing (owner, 2026-11-01). A
    // browser that does not wait returns at once and closes it by afterprint.
    if (Date.now() - asked > 200) w.setTimeout(() => w.close(), 300);
  };

  const images = Array.from(w.document.images)
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    );

  let fonts: Promise<unknown> = Promise.resolve();
  try {
    fonts = (w.document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? fonts;
  } catch {
    // An old engine without the font API: images are enough.
  }

  // The new window's own timers: the page behind it is in the background
  // now, and a background page's timers run late.
  Promise.all([...images, fonts.catch(() => undefined)]).then(() => w.setTimeout(print, 50));
  w.setTimeout(print, maxWaitMs);
}
