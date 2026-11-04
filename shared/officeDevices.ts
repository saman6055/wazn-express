/**
 * The office system opens on known devices only.
 *
 * The owner, 2026-11-05: «بۆ کردنەوەی سیستەم لاپتۆپی من و هی دکتۆر و 2
 * کۆمپیوتەرەکەی کۆمپانیا بناسە؛ لەوانە زیاتر هەوڵی کردنەوەی سیستەم درا،
 * ئەبێ تاکید بیتەوە کەوا بە ئیجازەی منە یان نا».
 *
 * Every browser that signs in to the office gets its own long random mark (a
 * cookie only the server can read). The server keeps a fingerprint of each
 * mark the main admin has approved. While the rule is on, a member of staff
 * on any other device is stopped — at the sign-in and on every request — and
 * the main admin sees who, from where, on what, with a code to approve or
 * refuse. Customers and their portal are never touched by any of this.
 *
 * It starts OFF. Until it is switched on it only records which devices sign
 * in, so the owner can approve the ones he knows first; and switching it on
 * approves the device he does it from, so he can never lock himself out by
 * turning it on. OFFICE_DEVICES_OFF=1 in the deployment is the way back in
 * if every approved device is lost.
 */

export const OFFICE_DEVICES_SETTING = "office_devices";
export const DEVICE_COOKIE = "wazn_device";
/** A pending request waits half an hour; a device not seen for a year is forgotten from "seen". */
export const PENDING_MINUTES = 30;
const MAX_SEEN = 60;
const MAX_PENDING = 20;

export interface ApprovedDevice {
  /** sha256 of the device's mark. */
  id: string;
  label: string;
  approvedAt: string;
  approvedBy: number;
  lastSeenAt?: string;
  lastUser?: string;
  agent?: string;
}

/** A device that signed in, approved or not: what the owner chooses from. */
export interface SeenDevice {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUser: string;
  lastUserId: number;
  ip: string;
  agent: string;
  /** Set while a request to approve it is waiting. */
  code?: string;
  requestedAt?: string;
}

export interface OfficeDevices {
  enforced: boolean;
  approved: ApprovedDevice[];
  seen: SeenDevice[];
}

export function emptyOfficeDevices(): OfficeDevices {
  return { enforced: false, approved: [], seen: [] };
}

export function parseOfficeDevices(raw: string | null | undefined): OfficeDevices {
  if (!raw) return emptyOfficeDevices();
  try {
    const v = JSON.parse(raw) as Partial<OfficeDevices>;
    return {
      enforced: v.enforced === true,
      approved: Array.isArray(v.approved) ? v.approved.filter((d) => d && /^[0-9a-f]{64}$/.test(String(d.id))) : [],
      seen: Array.isArray(v.seen) ? v.seen.filter((d) => d && /^[0-9a-f]{64}$/.test(String(d.id))) : [],
    };
  } catch {
    return emptyOfficeDevices();
  }
}

export function isApproved(state: OfficeDevices, deviceId: string | null): boolean {
  return !!deviceId && state.approved.some((d) => d.id === deviceId);
}

/** May this staff session go on? Customers never reach this question. */
export function deviceAllowed(state: OfficeDevices, deviceId: string | null, killSwitch: boolean): boolean {
  if (killSwitch || !state.enforced) return true;
  return isApproved(state, deviceId);
}

/** Note a sign-in from a device; returns the new state. */
export function noteSeen(
  state: OfficeDevices,
  device: { id: string; user: string; userId: number; ip: string; agent: string },
  now: Date,
): OfficeDevices {
  const at = now.toISOString();
  const others = state.seen.filter((d) => d.id !== device.id);
  const before = state.seen.find((d) => d.id === device.id);
  const seen: SeenDevice = {
    id: device.id,
    firstSeenAt: before?.firstSeenAt ?? at,
    lastSeenAt: at,
    lastUser: device.user.slice(0, 80),
    lastUserId: device.userId,
    ip: device.ip.slice(0, 64),
    agent: device.agent.slice(0, 300),
    code: before?.code,
    requestedAt: before?.requestedAt,
  };
  const approved = state.approved.map((d) =>
    d.id === device.id ? { ...d, lastSeenAt: at, lastUser: seen.lastUser } : d,
  );
  return { ...state, approved, seen: [seen, ...others].slice(0, MAX_SEEN) };
}

/** Ask the owner about this device: a six-digit code to match. */
export function requestApproval(state: OfficeDevices, deviceId: string, code: string, now: Date): OfficeDevices {
  const at = now.toISOString();
  const waiting = state.seen.filter((d) => d.code && pendingLive(d, now)).length;
  const seen = state.seen.map((d) =>
    d.id === deviceId ? { ...d, code: pendingLive(d, now) ? d.code : code, requestedAt: pendingLive(d, now) ? d.requestedAt : at } : d,
  );
  // A flood of devices asking cannot crowd out the list.
  return waiting >= MAX_PENDING ? state : { ...state, seen };
}

export function pendingLive(d: SeenDevice, now: Date): boolean {
  if (!d.code || !d.requestedAt) return false;
  const age = now.getTime() - new Date(d.requestedAt).getTime();
  return age >= 0 && age <= PENDING_MINUTES * 60_000;
}

export function approveDevice(
  state: OfficeDevices,
  deviceId: string,
  label: string,
  by: number,
  now: Date,
): OfficeDevices {
  const seen = state.seen.find((d) => d.id === deviceId);
  const entry: ApprovedDevice = {
    id: deviceId,
    label: label.trim().slice(0, 80) || "ئامێر",
    approvedAt: now.toISOString(),
    approvedBy: by,
    lastSeenAt: seen?.lastSeenAt,
    lastUser: seen?.lastUser,
    agent: seen?.agent,
  };
  return {
    ...state,
    approved: [entry, ...state.approved.filter((d) => d.id !== deviceId)],
    seen: state.seen.map((d) => (d.id === deviceId ? { ...d, code: undefined, requestedAt: undefined } : d)),
  };
}

export function removeDevice(state: OfficeDevices, deviceId: string): OfficeDevices {
  return { ...state, approved: state.approved.filter((d) => d.id !== deviceId) };
}

/** A device name a person can recognise, from what its browser says it is. */
export function describeAgent(agent: string): string {
  const a = agent || "";
  const os = /Windows/i.test(a) ? "Windows" : /Android/i.test(a) ? "Android" : /iPhone|iPad/i.test(a) ? "iPhone/iPad" : /Mac OS/i.test(a) ? "Mac" : /Linux/i.test(a) ? "Linux" : "؟";
  const browser = /Edg\//.test(a) ? "Edge" : /Chrome\//.test(a) ? "Chrome" : /Firefox\//.test(a) ? "Firefox" : /Safari\//.test(a) ? "Safari" : "؟";
  return `${os} · ${browser}`;
}
