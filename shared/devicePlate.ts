/**
 * A device's plate and its details (owner, 2026-11-05: «خودی ئامێر و ئەیپی
 * و مۆدێل و وردەکارییەکانی ئامێر وەربگرێت کە لە ئامێرێکی تردا نییە، وەکو
 * ژمارەی پلێتی ئۆتۆمبێل»).
 *
 * The plate is read off the device's own mark (shared/officeDevices): a long
 * random value only that browser holds, so no two devices share one. A web
 * page cannot read a serial number, a MAC address or an IMEI - browsers keep
 * those from every site - so the plate is the mark, and the details are what
 * the browser does say about the machine under it.
 *
 * The print is the part of those details that does not change on the same
 * machine: its operating system, graphics chip, processor cores, memory and
 * touch screen. A plate seen with a different print is the mark copied to
 * another machine - the way a stolen session travels - and the main admin is
 * told.
 */

/** Sent on every office request: the print of the machine the page runs on. */
export const DEVICE_PRINT_HEADER = "x-wazn-hw";

export interface DeviceTraits {
  os?: string;
  osVersion?: string;
  model?: string;
  browser?: string;
  browserVersion?: string;
  arch?: string;
  cores?: number;
  memoryGb?: number;
  gpu?: string;
  screen?: string;
  dpr?: number;
  touch?: number;
  timeZone?: string;
  language?: string;
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return s || undefined;
};
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : undefined;

/** What a client says about itself, kept to sane sizes. Never trusted for a decision. */
export function cleanTraits(raw: unknown): DeviceTraits | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const t: DeviceTraits = {
    os: str(r.os, 40),
    osVersion: str(r.osVersion, 40),
    model: str(r.model, 60),
    browser: str(r.browser, 40),
    browserVersion: str(r.browserVersion, 40),
    arch: str(r.arch, 20),
    cores: num(r.cores, 1, 512),
    memoryGb: num(r.memoryGb, 0.1, 4096),
    gpu: str(r.gpu, 120),
    screen: str(r.screen, 20),
    dpr: num(r.dpr, 0.1, 10),
    touch: num(r.touch, 0, 64),
    timeZone: str(r.timeZone, 60),
    language: str(r.language, 20),
  };
  const kept = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as DeviceTraits;
  return Object.keys(kept).length ? kept : undefined;
}

/** The plate shown to the owner: from the mark's fingerprint, so one per device. */
export function plateOf(deviceId: string): string {
  const id = deviceId.toUpperCase();
  return `WZN·${id.slice(0, 4)}·${id.slice(4, 8)}`;
}

/**
 * A graphics chip's name without what changes with a browser update: the
 * wrapper, the API, the shader model, the device ids.
 */
export function gpuCore(gpu: string): string {
  return gpu
    .toLowerCase()
    .replace(/\(0x[0-9a-f]+\)/g, " ")
    .replace(/direct3d\S*|d3d\d+\S*|vs_\d_\d|ps_\d_\d|opengl\S*|vulkan\S*|metal\S*|angle|\(r\)|\(tm\)|graphics|series/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w, i, all) => w && all.indexOf(w) === i)
    .join(" ");
}

/** Two 32-bit FNV-1a runs: a short, stable digest. Not a secret, only a comparison. */
function fnv(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * The machine's print, or null when the graphics chip cannot be read (then
 * nothing is compared - a print made without it would differ from the same
 * machine's next one).
 */
export function printFrom(t: Pick<DeviceTraits, "os" | "gpu" | "cores" | "memoryGb" | "touch">): string | null {
  // A software stand-in is what the browser falls back to when the real chip
  // fails for a moment - the same machine, so nothing to compare.
  if (!t.gpu || /swiftshader|llvmpipe|softpipe|basic render|software/i.test(t.gpu)) return null;
  const gpu = gpuCore(t.gpu);
  if (!gpu) return null;
  const basis = [t.os ?? "", gpu, String(t.cores ?? ""), String(t.memoryGb ?? ""), (t.touch ?? 0) > 0 ? "touch" : "no-touch"].join("|");
  return fnv(basis, 0x811c9dc5) + fnv(basis, 0x01234567);
}

export function isPrint(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{16}$/.test(v);
}

/** "ANGLE (AMD, AMD Radeon(TM) Graphics (0x1638) Direct3D11 ...)" -> "AMD Radeon(TM) Graphics". */
export function gpuName(gpu: string): string {
  const angle = /^ANGLE \((?:[^,]*),\s*(.+?)\s*(?:\(0x[0-9a-fA-F]+\))?\s*(?:Direct3D|OpenGL|Vulkan|Metal|D3D)/.exec(gpu);
  const name = angle ? angle[1] : gpu.replace(/^ANGLE \(/, "").replace(/\)$/, "");
  return name.replace(/\s*\(0x[0-9a-fA-F]+\)/g, "").trim().slice(0, 80) || gpu.slice(0, 80);
}

/** Lines a person can read, for the device's card. */
export function describeTraits(t: DeviceTraits | undefined): string[] {
  if (!t) return [];
  const lines: string[] = [];
  const sys = [t.os, t.osVersion].filter(Boolean).join(" ");
  const br = [t.browser, t.browserVersion?.split(".")[0]].filter(Boolean).join(" ");
  if (sys || br) lines.push([sys, br].filter(Boolean).join(" · "));
  if (t.model) lines.push(`مۆدێل: ${t.model}`);
  const hw = [t.cores ? `${t.cores} ناوک` : "", t.memoryGb ? `${t.memoryGb} GB بیرگە` : "", t.arch ?? ""].filter(Boolean).join(" · ");
  if (hw) lines.push(hw);
  if (t.gpu) lines.push(`کارتی وێنە: ${gpuName(t.gpu)}`);
  const scr = [t.screen ? `شاشە ${t.screen}` : "", t.touch ? "دەستلێدان" : ""].filter(Boolean).join(" · ");
  if (scr) lines.push(scr);
  if (t.timeZone) lines.push(`کات: ${t.timeZone}`);
  return lines;
}
