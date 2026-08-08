/**
 * Copy to the clipboard without assuming there is one.
 *
 * `navigator.clipboard` is undefined on an insecure origin and inside some
 * in-app browsers — the Facebook and Instagram webviews among them, which is
 * exactly how a customer arrives from an advert. Calling `.writeText` on it
 * throws a TypeError inside the tap handler, so the button appears to do
 * nothing at all; several call sites also fired their "Copied!" toast
 * unconditionally, so it claimed success while copying nothing.
 *
 * Returns whether it worked, so the caller can tell the truth.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the old-fashioned way.
  }

  // execCommand is deprecated but still the only thing that works in a
  // webview with no clipboard API.
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
