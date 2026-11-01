/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// User roles
// Kept in step with the role column in drizzle/schema/users.schema.ts.
export type UserRole = "super_admin" | "admin" | "employee" | "accountant" | "auditor";

// Package statuses
export type PackageStatus =
  | "registered"
  | "in_batch"
  | "in_transit"
  | "customs_processing"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "cancelled";

// Shipping types
export type ShippingType = "air_regular" | "air_irregular" | "sea";

// Warehouse types
export type WarehouseType = "air" | "sea" | "custom";

// Pricing units
export type PricingUnit = "kg" | "cbm";

// Ledger entry types
export type LedgerEntryType = "charge" | "payment" | "refund" | "adjustment";

// Invoice statuses
export type InvoiceStatus = "draft" | "issued" | "paid" | "partially_paid" | "cancelled" | "refunded";

// Batch statuses
export type BatchStatus = "preparing" | "in_transit" | "arrived" | "customs" | "delivered" | "closed";

// Notification channels
export type NotificationChannel = "email" | "whatsapp" | "sms";

// Notification statuses
export type NotificationStatus = "pending" | "sent" | "failed" | "delivered";

// Supported languages
export type Language = "en" | "ar" | "ku" | "zh" | "tr" | "fa";

// Currency codes
export type Currency = "USD" | "IQD" | "RMB" | "CNY";

// Gender types
export type Gender = "male" | "female";

// Customer code prefix options
export const CUSTOMER_CODE_PREFIXES = [
  { value: "AZ", label: "AZ - Default" },
  { value: "WZ", label: "WZ - Wazn" },
  { value: "VIP", label: "VIP - VIP Customers" },
  { value: "EX", label: "EX - Express" },
  { value: "PRO", label: "PRO - Professional" },
] as const;

export type CustomerCodePrefix = typeof CUSTOMER_CODE_PREFIXES[number]["value"];

// Generate customer code in format {PREFIX}{number}({Name})
// Uses 3-digit padding: AZ001, QI002, etc.
export function generateCustomerCode(sequenceNumber: number, name: string, prefix: string = "AZ"): string {
  const paddedNumber = sequenceNumber.toString().padStart(3, "0");
  return `${prefix}${paddedNumber}(${name})`;
}

// Format currency
export function formatCurrency(amount: number, currency: Currency = "USD"): string {
  const formatters: Record<Currency, Intl.NumberFormat> = {
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    IQD: new Intl.NumberFormat("en-US", { style: "currency", currency: "IQD", maximumFractionDigits: 0 }),
    RMB: new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }),
    CNY: new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }),
  };
  return formatters[currency].format(amount);
}
