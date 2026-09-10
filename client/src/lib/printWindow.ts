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
export function printWhenReady(w: Window, maxWaitMs = 1500): void {
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    w.print();
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

  Promise.all([...images, fonts.catch(() => undefined)]).then(() => setTimeout(print, 50));
  setTimeout(print, maxWaitMs);
}
