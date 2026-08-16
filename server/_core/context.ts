import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User, Customer } from "../../drizzle/schema";
import { sdk } from "./sdk";
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

  return {
    req: opts.req,
    res: opts.res,
    user,
    logger: appLogger,
  };
}
