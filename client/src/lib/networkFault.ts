import { errorLang, NETWORK_FAULT_TEXT } from "@shared/errorMessages";

/**
 * A request that never reached the server.
 *
 * The browser describes a dropped connection in its own English — "Failed to
 * fetch", or "Load failed" on an iPhone — and that sentence went straight into
 * the toasts of every screen, Kurdish and Arabic ones included. The API link
 * turns it into this: the same kind of error (a TypeError, so nothing that
 * catches it changes), with a sentence the reader can act on.
 */
export class NetworkFault extends TypeError {
  override name = "NetworkFault";
}

const LANGUAGE_STORAGE_KEY = "wazn-express-language";

export function storedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "ku";
  } catch {
    return "ku";
  }
}

export function networkFault(cause: unknown): NetworkFault {
  const fault = new NetworkFault(NETWORK_FAULT_TEXT[errorLang(storedLanguage())]);
  (fault as { cause?: unknown }).cause = cause;
  return fault;
}

/** True for a NetworkFault anywhere in the cause chain (tRPC wraps it). */
export function isNetworkFault(error: unknown): boolean {
  let e: unknown = error;
  for (let depth = 0; depth < 4 && e; depth++) {
    if ((e as { name?: string }).name === "NetworkFault") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
