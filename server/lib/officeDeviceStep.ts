import type { Request, Response } from "express";
import {
  approveDevice,
  describeAgent,
  isApproved,
  noteMismatch,
  noteSeen,
  openBeforeRule,
  printMismatch,
  recordDetails,
  type OfficeDevices,
} from "@shared/officeDevices";
import { DEVICE_PRINT_HEADER, isPrint, plateOf, type DeviceTraits } from "@shared/devicePlate";
import {
  deviceIdFrom,
  ensureDeviceMark,
  loadOfficeDevices,
  officeDevicesKillSwitch,
  updateOfficeDevices,
} from "./officeDevicesStore";
import { appLogger } from "../utils/logger";

/**
 * What every office request adds to the device list (shared/officeDevices,
 * shared/devicePlate). A courtesy that never stands in the way: any failure
 * here leaves the request exactly as it was.
 */

/** The print the page sent, if it is one. */
export function printFrom(req: Pick<Request, "headers">): string | null {
  const v = req.headers[DEVICE_PRINT_HEADER];
  const s = Array.isArray(v) ? v[0] : v;
  return isPrint(s) ? s : null;
}

const ipOf = (req: Request) => String(req.ip ?? "").slice(0, 64);
const agentOf = (req: Pick<Request, "headers">) => String(req.headers["user-agent"] ?? "").slice(0, 300);

type Staff = { id: number; name?: string | null; username?: string | null };
const nameOf = (u: Staff) => u.name || u.username || `#${u.id}`;

/**
 * After a staff request is let in:
 *  - a session from before the rule went on, on a device not yet approved,
 *    approves that device - what was open stays open, after its session
 *    ends too (owner, 2026-11-05);
 *  - a device with no mark gets one, and a device not on the list joins it,
 *    so every phone and computer already in use shows on the owner's page;
 *  - the machine's print is kept the first time it is seen.
 */
export async function officeDeviceStep(req: Request, res: Response, user: Staff, sessionIssuedAt: number | undefined): Promise<void> {
  try {
    const state = await loadOfficeDevices();
    const print = printFrom(req);
    let id = deviceIdFrom(req);
    const listed = (s: OfficeDevices, d: string | null) => !!d && (s.seen.some((x) => x.id === d) || s.approved.some((x) => x.id === d));
    const keep = state.enforced && !officeDevicesKillSwitch() && !isApproved(state, id) && openBeforeRule(state, sessionIssuedAt);
    const known = listed(state, id);
    const needsPrint = !!print && known && !(state.approved.find((d) => d.id === id)?.print ?? state.seen.find((d) => d.id === id)?.print);
    if (!keep && known && !needsPrint) return;

    if (!id) id = ensureDeviceMark(req, res);
    const deviceId = id;
    const now = new Date();
    await updateOfficeDevices((s) => {
      let next = s;
      if (!listed(next, deviceId)) {
        next = noteSeen(next, { id: deviceId, user: nameOf(user), userId: user.id, ip: ipOf(req), agent: agentOf(req) }, now);
      }
      next = recordDetails(next, deviceId, { print, ip: ipOf(req) });
      if (keep && !isApproved(next, deviceId)) {
        const label = `${nameOf(user)} — ${describeAgent(agentOf(req))} (لە پێش ڕێساکەوە)`;
        next = approveDevice(next, deviceId, label, user.id, now);
      }
      return next;
    });
  } catch (err) {
    appLogger.warn("[devices] could not note the device", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** One note per device and print every ten minutes: a copied mark is told once, not on every click. */
const told = new Map<string, number>();
const TELL_EVERY_MS = 10 * 60_000;

/**
 * The device's mark came from a machine with another print. The owner is
 * told on his page and in the bell; while the rule is on, the request has
 * already been refused (sdk).
 */
export async function reportPrintMismatch(req: Request, deviceId: string, print: string, user: Staff): Promise<void> {
  const key = `${deviceId}|${print}`;
  const last = told.get(key) ?? 0;
  if (Date.now() - last < TELL_EVERY_MS) return;
  told.set(key, Date.now());
  if (told.size > 500) told.clear();
  try {
    const before = await loadOfficeDevices();
    const already = [...before.approved, ...before.seen].some((d) => d.id === deviceId && d.mismatch?.print === print);
    await updateOfficeDevices((s) =>
      noteMismatch(s, deviceId, { at: new Date().toISOString(), print, ip: ipOf(req), agent: agentOf(req), user: nameOf(user) }),
    );
    if (already) return;
    appLogger.warn("Office device mark seen on another machine", { deviceId: deviceId.slice(0, 8), userId: user.id, ip: req.ip });
    const db = await import("../db");
    await db.createActivityAlert({
      action: "office_device_print_mismatch",
      category: "security",
      entityType: "setting",
      entityId: user.id,
      customTitle: "پلێتی ئامێرێک لەسەر ئامێرێکی تر دەرکەوت",
      customMessage: `پلێتی ${plateOf(deviceId)} (${nameOf(user)}) لە ئامێرێکی جیاوازەوە بەکارهات — IP ${ipOf(req)}. لە «پاراستنی سیستەم» ببینە.`,
      severity: "critical",
    });
  } catch (err) {
    appLogger.warn("[devices] could not note a mismatch", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** What the page says about its machine, once per load (auth.reportDevice). */
export async function reportDetails(req: Request, res: Response, user: Staff, traits: DeviceTraits | undefined): Promise<void> {
  const deviceId = ensureDeviceMark(req, res);
  const print = printFrom(req);
  const now = new Date();
  await updateOfficeDevices((s) => {
    // A copied mark does not get to rewrite the real machine's details.
    if (printMismatch(s, deviceId, print)) return null;
    let next = noteSeen(s, { id: deviceId, user: nameOf(user), userId: user.id, ip: ipOf(req), agent: agentOf(req) }, now);
    next = recordDetails(next, deviceId, { traits, print, ip: ipOf(req) });
    return next;
  });
}
