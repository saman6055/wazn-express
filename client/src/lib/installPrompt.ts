import { useSyncExternalStore } from "react";

/**
 * The browser's own "install this app" offer, caught the moment it arrives.
 *
 * Chrome makes the offer once, early — usually before React has drawn
 * anything. The portal's install dialog listened for it from inside a
 * component, so by the time it was listening the offer had come and gone,
 * and the customer was handed a list of menu steps to do it by hand.
 *
 * The listener now sits in main.tsx, before the first paint. The offer is
 * kept here, and any screen can spend it with `installApp()`: one tap, the
 * browser's own install box, no instructions.
 *
 * iOS is the one place with no button — Safari makes no such offer and Apple
 * provides no way to ask — so there the steps stay.
 */
export interface InstallOffer extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let offer: InstallOffer | null = null;
const listeners = new Set<() => void>();

function tell(): void {
  listeners.forEach((listener) => listener());
}

/** Registered once, from main.tsx, before anything is drawn. */
export function captureInstallOffer(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event: Event) => {
    // Without preventDefault the browser spends the offer on its own bar and
    // keeps nothing for our button.
    event.preventDefault();
    offer = event as InstallOffer;
    tell();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    tell();
  });
}

export function getInstallOffer(): InstallOffer | null {
  return offer;
}

export function subscribeInstallOffer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Opens the browser's install box and says what the person chose.
 * "unavailable" means this browser never made the offer (iOS, or one of the
 * in-app browsers) — there the screen shows another way in.
 */
export async function installApp(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const current = offer;
  if (!current) return "unavailable";
  await current.prompt();
  const { outcome } = await current.userChoice;
  // An offer can be spent once; the browser makes a fresh one if it was refused.
  offer = null;
  tell();
  return outcome;
}

/** React: the screen redraws the moment the offer arrives or is spent. */
export function useInstallOffer(): InstallOffer | null {
  return useSyncExternalStore(subscribeInstallOffer, getInstallOffer, () => null);
}
