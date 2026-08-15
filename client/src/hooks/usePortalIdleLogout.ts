import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Sign a customer out after half an hour of doing nothing.
 *
 * The session cookie lasts a week, which is right for a phone in somebody's
 * pocket and wrong for the other cases: a shared computer at an internet
 * café, a laptop left open on a desk, a phone handed to a friend. The cookie
 * cannot tell those apart. Idleness can.
 *
 * Thirty minutes of no touch, no key, no scroll — then out, and back to the
 * sign-in page. Any of those resets the clock, so somebody reading a long
 * invoice is not thrown out mid-sentence.
 *
 * Staff are left alone: they are on their own machines all day, and a
 * warehouse screen that logs itself out between scans is a screen somebody
 * props open with a book on the keyboard.
 *
 * The timer is client-side, which is the honest description of what it is: a
 * courtesy for the person at the desk, not a defence against somebody who
 * already has the cookie. The lock on the account is what defends the
 * account.
 */

/** Half an hour, as the owner asked. */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** Written on the way out, read by the sign-in page to explain itself. */
export const IDLE_LOGOUT_FLAG = "portal:idle-logout";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "visibilitychange"] as const;

export function usePortalIdleLogout(enabled: boolean) {
  const { user, logout } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The customer check lives here rather than at the call site so no screen
  // can mount this and accidentally log a staff member out.
  const isCustomer = Boolean((user as { isCustomer?: boolean } | null)?.isCustomer);

  useEffect(() => {
    if (!enabled || !isCustomer || typeof window === "undefined") return;

    const signOut = () => {
      try {
        window.sessionStorage.setItem(IDLE_LOGOUT_FLAG, "1");
      } catch {
        // A browser refusing storage is not a reason to stay signed in.
      }
      void Promise.resolve(logout()).finally(() => {
        window.location.href = "/customer-login";
      });
    };

    const restart = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(signOut, IDLE_LIMIT_MS);
    };

    restart();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, restart, { passive: true });
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, restart);
    };
  }, [enabled, isCustomer, logout]);
}

/** Did this visit start because the last one timed out? Reads once. */
export function consumeIdleLogoutFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const flag = window.sessionStorage.getItem(IDLE_LOGOUT_FLAG);
    if (flag) window.sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
    return Boolean(flag);
  } catch {
    return false;
  }
}
