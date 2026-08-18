import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, decodeJwt } from "jose";
import type { User, Customer } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getConfig } from "../config";
import { getSessionCookieOptions } from "./cookies";
import type { AppLogger } from "../utils/logger";
import { appLogger } from "../utils/logger";

// Common properties for both staff and customer
type CommonUserProps = {
  id: number;
  name?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
};

// Staff user type (admin, employee, accountant, auditor)
export type StaffUser = User & {
  role: "super_admin" | "admin" | "employee" | "accountant" | "auditor";
  isCustomer: false;
};

// Customer type (from customers table)
export type CustomerUser = Customer & {
  role: "customer";
  isCustomer: true;
  // Add name alias for compatibility
  name?: string | null;
};

// Context user can be either a staff user or a customer
export type ContextUser = (StaffUser | CustomerUser) & CommonUserProps;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: ContextUser | null;
  logger: AppLogger;
};

/**
 * A customer session renews itself on use.
 *
 * The owner's rule: a customer who opened the portal stays signed in until
 * they delete the app — no idle timeout, no weekly expiry. A token with any
 * fixed lifetime breaks that rule eventually, so once a week of the year-long
 * token has been spent, the next request quietly replaces it with a fresh
 * one. Only a device left untouched for a whole year ever sees the sign-in
 * page again.
 *
 * Renewal is a courtesy, not a gate: it runs only after the old token already
 * verified, and any failure here leaves that still-valid token in place.
 */
const RENEW_WHEN_REMAINING_MS = ONE_YEAR_MS - 7 * 24 * 60 * 60 * 1000;

async function renewCustomerSession(
  req: CreateExpressContextOptions["req"],
  res: CreateExpressContextOptions["res"],
  user: CustomerUser,
): Promise<void> {
  try {
    const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
    if (!token) return;
    // Decode without verifying: authenticateRequest just verified this exact
    // token, this only reads its expiry.
    const { exp } = decodeJwt(token);
    if (!exp || exp * 1000 - Date.now() > RENEW_WHEN_REMAINING_MS) return;
    const secret = new TextEncoder().encode(getConfig().jwtSecret);
    const fresh = await new SignJWT({
      customerId: user.id,
      customerCode: user.customerCode,
      role: "customer",
      isCustomer: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("365d")
      .sign(secret);
    res.cookie(COOKIE_NAME, fresh, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  } catch {
    // The old cookie still works; a missed renewal costs nothing today.
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: ContextUser | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req) as ContextUser;
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (user?.isCustomer) {
    await renewCustomerSession(opts.req, opts.res, user);
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    logger: appLogger,
  };
}
