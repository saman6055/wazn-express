import { useEffect, useState } from "react";

/**
 * How wide the portal should be on this screen.
 *
 * Every portal layout was `max-w-lg` — 512 pixels, centred. That is right on a
 * phone, where nearly all of the traffic is, and it is what everything inside
 * was designed against. On a desktop monitor it left the customer reading a
 * narrow strip down the middle of an empty screen.
 *
 * So the cap now grows with the screen, and the reader can override it. The
 * override exists because the office wants to see the customer's phone view
 * while sitting at a desk, and because some people genuinely prefer the narrow
 * column on a wide monitor — it is one setting, kept on their own device, and
 * it changes nothing but the width.
 */

export type PortalWidth = "auto" | "phone" | "tablet" | "desktop";

const STORAGE_KEY = "portal:width";

/** The container cap for each choice. `auto` widens with the breakpoint. */
export const PORTAL_WIDTH_CLASS: Record<PortalWidth, string> = {
  // Phone first, then a tablet-sized column, then the desktop one — which
  // arrives at 1024px rather than 1280, so an ordinary laptop gets the
  // desktop layout rather than the tablet one. Deliberately not full-bleed:
  // a line of text 1,900 pixels wide is not readable, whatever the monitor
  // can do.
  auto: "max-w-lg md:max-w-3xl lg:max-w-5xl",
  phone: "max-w-lg",
  tablet: "max-w-3xl",
  desktop: "max-w-5xl",
};

/**
 * The width at which the desktop layout takes over, and therefore the width
 * at which it is worth offering the choice at all. Matches Tailwind's `lg`.
 */
export const DESKTOP_MIN_PX = 1024;

function read(): PortalWidth {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "phone" || stored === "tablet" || stored === "desktop" ? stored : "auto";
}

/**
 * The chosen width, and a setter that remembers it.
 *
 * The event is dispatched so every layout on the page agrees at once — the
 * header, the main column and the bottom bar are separate elements and would
 * otherwise disagree until the next render.
 */
export function usePortalWidth(): [PortalWidth, (next: PortalWidth) => void] {
  const [width, setWidthState] = useState<PortalWidth>(read);

  useEffect(() => {
    const onChange = () => setWidthState(read());
    window.addEventListener("portal-width-change", onChange);
    // Another tab changing it counts too.
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("portal-width-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setWidth = (next: PortalWidth) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event("portal-width-change"));
    }
    setWidthState(next);
  };

  return [width, setWidth];
}

/** The class to put on a portal container. */
export function usePortalWidthClass(): string {
  const [width] = usePortalWidth();
  return PORTAL_WIDTH_CLASS[width];
}
