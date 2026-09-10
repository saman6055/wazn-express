/**
 * Print a freshly written window once its images have arrived.
 *
 * Several reports called print() the instant their HTML was written, or a
 * quarter-second later. That was harmless while they were text only; with the
 * logo in the header, the print dialog could capture the page before the
 * image landed and put a blank where the mark should be. This waits for every
 * image to load or fail — or for `maxWaitMs`, so a slow network never leaves
 * the dialog unopened.
 */
export function printWhenReady(w: Window, maxWaitMs = 1500): void {
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    w.print();
  };
  const pending = Array.from(w.document.images).filter((img) => !img.complete);
  if (pending.length === 0) {
    setTimeout(print, 50);
    return;
  }
  let left = pending.length;
  const settle = () => {
    left -= 1;
    if (left === 0) print();
  };
  for (const img of pending) {
    img.addEventListener("load", settle, { once: true });
    img.addEventListener("error", settle, { once: true });
  }
  setTimeout(print, maxWaitMs);
}
