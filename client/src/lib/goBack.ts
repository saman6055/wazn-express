/**
 * Back — when this tab has somewhere to go back to.
 *
 * On the first page of a visit (a link opened from WhatsApp, a bookmark, a
 * new tab) the browser has nothing behind it, and a Back button that does
 * nothing reads as a broken app. There it goes to the reader's home instead.
 */
export function goBackOr(fallback: string, navigate: (to: string) => void): void {
  if (typeof window !== "undefined" && window.history.length > 1) {
    window.history.back();
  } else {
    navigate(fallback);
  }
}
