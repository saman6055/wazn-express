import { createHash, randomBytes } from "crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import {
  DEVICE_COOKIE,
  OFFICE_DEVICES_SETTING,
  emptyOfficeDevices,
  parseOfficeDevices,
  type OfficeDevices,
} from "@shared/officeDevices";
import { getSessionCookieOptions } from "../_core/cookies";
import { appLogger } from "../utils/logger";

/**
 * Where the list of known office devices lives, and how a device is known
 * (shared/officeDevices says why).
 *
 * The list is one setting row, read on every staff request — so it is kept in
 * memory for a few seconds and dropped the moment it is written. If it cannot
 * be read at all the rule is not applied: with the database down nothing
 * works anyway, and a lock that fails closed would shut the owner out with it.
 */
const CACHE_MS = 10_000;
let cache: { state: OfficeDevices; at: number } | null = null;

/** The deployment's way back in, if every approved device is lost. */
export function officeDevicesKillSwitch(): boolean {
  return process.env.OFFICE_DEVICES_OFF?.trim() === "1";
}

export async function loadOfficeDevices(): Promise<OfficeDevices> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  try {
    const db = await import("../db");
    const state = parseOfficeDevices(await db.getSetting(OFFICE_DEVICES_SETTING));
    cache = { state, at: Date.now() };
    return state;
  } catch (err) {
    appLogger.warn("[devices] could not read the device list", { error: err instanceof Error ? err.message : String(err) });
    return cache?.state ?? emptyOfficeDevices();
  }
}

export async function saveOfficeDevices(state: OfficeDevices, byId?: number): Promise<void> {
  const db = await import("../db");
  await db.setSetting(OFFICE_DEVICES_SETTING, JSON.stringify(state), byId);
  cache = { state, at: Date.now() };
}

const fingerprint = (mark: string) => createHash("sha256").update(mark, "utf8").digest("hex");

/** This browser's device id (the fingerprint of its mark), or null if it has none. */
export function deviceIdFrom(req: Pick<Request, "headers">): string | null {
  const mark = parseCookieHeader(String(req.headers.cookie ?? ""))[DEVICE_COOKIE];
  return mark && /^[A-Za-z0-9_-]{40,60}$/.test(mark) ? fingerprint(mark) : null;
}

/** The device id, giving this browser a mark first if it has none. */
export function ensureDeviceMark(req: Request, res: Response): string {
  const existing = deviceIdFrom(req);
  if (existing) return existing;
  const mark = randomBytes(32).toString("base64url");
  res.cookie(DEVICE_COOKIE, mark, {
    ...getSessionCookieOptions(req),
    httpOnly: true,
    maxAge: 5 * 365 * 24 * 60 * 60 * 1000,
  });
  return fingerprint(mark);
}

/** Tests only. */
export function resetOfficeDevicesCache(): void {
  cache = null;
}
