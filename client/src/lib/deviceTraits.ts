import { printFrom, type DeviceTraits } from "@shared/devicePlate";

/**
 * What this browser can say about the machine it runs on (shared/devicePlate).
 * Nothing here is a secret or an identity - the plate is the server's mark -
 * only the details the owner sees beside it, and the print compared with it.
 */

function osOf(ua: string, hint?: string): string | undefined {
  if (hint) return hint === "macOS" ? "Mac" : hint;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Mac OS/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return undefined;
}

function browserOf(ua: string): { browser?: string; browserVersion?: string } {
  const m =
    /Edg\/([\d.]+)/.exec(ua) ? ["Edge", /Edg\/([\d.]+)/.exec(ua)![1]] :
    /Chrome\/([\d.]+)/.exec(ua) ? ["Chrome", /Chrome\/([\d.]+)/.exec(ua)![1]] :
    /Firefox\/([\d.]+)/.exec(ua) ? ["Firefox", /Firefox\/([\d.]+)/.exec(ua)![1]] :
    /Version\/([\d.]+).*Safari/.exec(ua) ? ["Safari", /Version\/([\d.]+)/.exec(ua)![1]] :
    null;
  return m ? { browser: m[0], browserVersion: m[1] } : {};
}

/** The graphics chip, asked for the low-power one so a two-chip laptop always answers the same. */
function gpuOf(): string | undefined {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl", { powerPreference: "low-power" }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return undefined;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : undefined;
  } catch {
    return undefined;
  }
}

let quick: DeviceTraits | null = null;

/** Read at once, without waiting: enough for the print. */
export function quickTraits(): DeviceTraits {
  if (quick) return quick;
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  const ua = nav.userAgent || "";
  const w = Math.max(screen.width, screen.height);
  const h = Math.min(screen.width, screen.height);
  quick = {
    os: osOf(ua, nav.userAgentData?.platform || undefined),
    ...browserOf(ua),
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory || undefined,
    gpu: gpuOf(),
    screen: w && h ? `${w}×${h}` : undefined,
    dpr: window.devicePixelRatio || undefined,
    touch: nav.maxTouchPoints ?? 0,
    timeZone: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
    })(),
    language: nav.language || undefined,
  };
  return quick;
}

let print: string | null | undefined;

/** This machine's print, for the header every office request carries; null when it cannot be read. */
export function devicePrint(): string | null {
  if (print !== undefined) return print;
  try {
    print = printFrom(quickTraits());
  } catch {
    print = null;
  }
  return print;
}

/**
 * Everything, the slow parts too: the phone's model and the system's version,
 * where the browser tells them (Chrome and Edge). Never waits longer than a
 * moment - a sign-in is not held up for a detail.
 */
export async function fullTraits(): Promise<DeviceTraits> {
  const base = { ...quickTraits() };
  type UAData = { getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>> };
  const uad = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  if (!uad?.getHighEntropyValues) return base;
  try {
    const hi = await Promise.race([
      uad.getHighEntropyValues(["model", "platformVersion", "architecture", "bitness", "uaFullVersion"]),
      new Promise<null>((r) => setTimeout(() => r(null), 800)),
    ]);
    if (!hi) return base;
    const pv = typeof hi.platformVersion === "string" ? hi.platformVersion : "";
    let osVersion = pv || undefined;
    // Windows says 13 and above for 11, below for 10.
    if (base.os === "Windows" && pv) osVersion = Number(pv.split(".")[0]) >= 13 ? "11" : "10";
    return {
      ...base,
      osVersion,
      model: typeof hi.model === "string" && hi.model ? hi.model : undefined,
      arch: [hi.architecture, hi.bitness].filter((x) => typeof x === "string" && x).join("-") || undefined,
    };
  } catch {
    return base;
  }
}
