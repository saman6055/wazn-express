import type { NextFunction, Request, Response } from "express";

/**
 * Which browser powers a page from this site may ask for.
 *
 * The camera (the scanners), the microphone (voice messages) and the location
 * stay with the site itself; nothing embedded in it — a video, a page from
 * another address — may ask for them, and nothing here may take payment or
 * reach USB, serial or Bluetooth devices. Helmet does not send this header
 * (security audit, 2026-11-05). Both server entries use this one middleware.
 */
export const PERMISSIONS_POLICY =
  "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), hid=()";

export function permissionsPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
  next();
}
