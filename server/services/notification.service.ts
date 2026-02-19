import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { appLogger } from "../utils/logger";
import { notificationLogs, customers, packages, batches, type Batch } from "../../drizzle/schema";
import { Resend } from "resend";

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Notification types for package status changes
export type NotificationEventType =
  | "package_registered"
  | "package_in_batch"
  | "package_in_transit"
  | "package_customs"
  | "package_ready_delivery"
  | "package_out_delivery"
  | "package_delivered"
  | "batch_departed"
  | "batch_arrived"
  | "invoice_created"
  | "payment_received"
  | "account_created"
  | "purchase_request_created"
  | "purchase_request_quoted"
  | "purchase_request_accepted"
  | "purchase_request_ordered"
  | "purchase_request_shipped"
  | "purchase_request_delivered";

// Status to event type mapping
export const statusToEventType: Record<string, NotificationEventType> = {
  "registered": "package_registered",
  "in_batch": "package_in_batch",
  "in_transit": "package_in_transit",
  "customs_processing": "package_customs",
  "ready_for_delivery": "package_ready_delivery",
  "out_for_delivery": "package_out_delivery",
  "delivered": "package_delivered",
};

// Notification templates
const notificationTemplates: Record<NotificationEventType, { subject: string; body: string }> = {
  package_registered: {
    subject: "📦 Package Registered - {{packageCode}}",
    body: `Dear {{customerName}},

Your package ({{packageCode}}) has been registered at our warehouse.

Tracking Number: {{trackingNumber}}
Weight: {{weight}} kg
Shipping Type: {{shippingType}}

You can track your package status in your customer portal.

Best regards,
Wazn Express Team`,
  },
  package_in_batch: {
    subject: "📦 Package Added to Batch - {{packageCode}}",
    body: `Dear {{customerName}},

Your package ({{packageCode}}) has been added to batch {{batchCode}} and is being prepared for shipment.

Estimated Departure: {{departureDate}}
Destination: {{destination}}

Best regards,
Wazn Express Team`,
  },
  package_in_transit: {
    subject: "✈️ Package In Transit - {{packageCode}}",
    body: `Dear {{customerName}},

Great news! Your package ({{packageCode}}) is now in transit.

Batch: {{batchCode}}
Estimated Arrival: {{estimatedArrival}}

You can track your package status in your customer portal.

Best regards,
Wazn Express Team`,
  },
  package_customs: {
    subject: "🛃 Package at Customs - {{packageCode}}",
    body: `Dear {{customerName}},

Your package ({{packageCode}}) has arrived and is currently being processed at customs.

We will notify you once it clears customs and is ready for delivery.

Best regards,
Wazn Express Team`,
  },
  package_ready_delivery: {
    subject: "📬 Package Ready for Delivery - {{packageCode}}",
    body: `Dear {{customerName}},

Your package ({{packageCode}}) has cleared customs and is ready for delivery!

Please ensure someone is available to receive the package.

Best regards,
Wazn Express Team`,
  },
  package_out_delivery: {
    subject: "🚚 Package Out for Delivery - {{packageCode}}",
    body: `Dear {{customerName}},

Your package ({{packageCode}}) is out for delivery today!

Please be available to receive your package.

Best regards,
Wazn Express Team`,
  },
  package_delivered: {
    subject: "✅ Package Delivered - {{packageCode}}",
    body: `Dear {{customerName}},

Your package ({{packageCode}}) has been successfully delivered!

Thank you for choosing Wazn Express.

Best regards,
Wazn Express Team`,
  },
  batch_departed: {
    subject: "✈️ Batch Departed - {{batchCode}}",
    body: `Dear {{customerName}},

Batch {{batchCode}} containing your package(s) has departed.

Estimated Arrival: {{estimatedArrival}}

Best regards,
Wazn Express Team`,
  },
  batch_arrived: {
    subject: "📍 Batch Arrived - {{batchCode}}",
    body: `Dear {{customerName}},

Batch {{batchCode}} containing your package(s) has arrived at the destination.

Your packages will be processed for customs clearance shortly.

Best regards,
Wazn Express Team`,
  },
  invoice_created: {
    subject: "🧾 Invoice Created - {{invoiceNumber}}",
    body: `Dear {{customerName}},

A new invoice ({{invoiceNumber}}) has been created for your account.

Amount: $[[amount]]
Due Date: {{dueDate}}

Please log in to your customer portal to view and pay the invoice.

Best regards,
Wazn Express Team`,
  },
  payment_received: {
    subject: "💰 Payment Received - Thank You!",
    body: `Dear {{customerName}},

We have received your payment of $[[amount]].

Your new balance: $[[balance]]

Thank you for your payment!

Best regards,
Wazn Express Team`,
  },
  account_created: {
    subject: "🎉 Welcome to Wazn Express!",
    body: `Dear {{customerName}},

Your Wazn Express account has been created!

Customer Code: {{customerCode}}
Mobile: {{mobile}}

You can now track your packages and manage your account through our customer portal.

Best regards,
Wazn Express Team`,
  },
  purchase_request_created: {
    subject: "🛒 داواکاری کڕین تۆمارکرا - {{requestCode}}",
    body: `{{customerName}} بەڕێز،

داواکاری کڕینت بە کۆدی {{requestCode}} تۆمارکرا.

بەرهەم: {{productName}}
ژمارە: {{quantity}}

ئێمە زوو نرخەکەت بۆ دەنێرین.

سوپاس بۆ متمانەت بە Wazn Express`,
  },
  purchase_request_quoted: {
    subject: "💰 نرخی داواکاری کڕین ئامادەیە - {{requestCode}}",
    body: "{{customerName}} بەڕێز،\n\nنرخی داواکاری کڕینت بە کۆدی {{requestCode}} ئامادەیە.\n\nبەرهەم: {{productName}}\nنرخی بەرهەم: [[productPrice]]$\nکرێی گواستنەوە: [[shippingCost]]$\nکۆی گشتی: [[totalPrice]]$\n\nتکایە بچۆ بۆ پۆرتالی کڕیار بۆ قبوڵکردن یان ڕەتکردنەوە.\n\nسوپاس بۆ متمانەت بە Wazn Express",
  },
  purchase_request_accepted: {
    subject: "✅ داواکاری کڕین قبوڵکرا - {{requestCode}}",
    body: `{{customerName}} بەڕێز،

داواکاری کڕینت بە کۆدی {{requestCode}} قبوڵکرا.

ئێمە ئێستا بەرهەمەکەت دەکڕین.

سوپاس بۆ متمانەت بە Wazn Express`,
  },
  purchase_request_ordered: {
    subject: "🛍️ بەرهەم کڕدرا - {{requestCode}}",
    body: `{{customerName}} بەڕێز،

بەرهەمەکەت بە کۆدی {{requestCode}} کڕدرا.

ژمارەی تراکینگ: {{trackingNumber}}

کاتێک بەرهەمەکە گەیشتە کۆگای چین، ئاگادارت دەکەینەوە.

سوپاس بۆ متمانەت بە Wazn Express`,
  },
  purchase_request_shipped: {
    subject: "✈️ بەرهەم نێردرا - {{requestCode}}",
    body: `{{customerName}} بەڕێز،

بەرهەمەکەت بە کۆدی {{requestCode}} نێردرا.

باچ: {{batchCode}}
کاتی گەیشتنی چاوەڕوانکراو: {{estimatedArrival}}

سوپاس بۆ متمانەت بە Wazn Express`,
  },
  purchase_request_delivered: {
    subject: "📦 بەرهەم گەیەندرا - {{requestCode}}",
    body: `{{customerName}} بەڕێز،

بەرهەمەکەت بە کۆدی {{requestCode}} گەیەندرا.

سوپاس بۆ بەکارهێنانی Wazn Express!`,
  },
};

// Replace template variables
function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Handle both {{var}} and [[var]] patterns
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "N/A");
    result = result.replace(new RegExp(`\\[\\[${key}\\]\\]`, "g"), value || "N/A");
  }
  return result;
}

// Send email notification using Resend
async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!resend) {
    appLogger.error("[Notification] Resend API key not configured. Set RESEND_API_KEY environment variable.");
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Wazn Express <onboarding@resend.dev>",
      to: [to],
      subject,
      text: body,
    });

    if (error) {
      appLogger.error("[Notification] Resend email failed", { error: error instanceof Error ? error.message : String(error) });
      return false;
    }

    appLogger.info("[Notification] Email sent successfully", { id: data?.id });
    return true;
  } catch (error) {
    appLogger.error("[Notification] Email error", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// Send SMS notification (placeholder - requires SMS provider integration)
async function sendSms(to: string, message: string): Promise<boolean> {
  try {
    // SMS integration placeholder
    // You would integrate with a provider like Twilio, Nexmo, or local SMS gateway here
    appLogger.info("[SMS] Would send to", { to, message });

    // For now, we'll log it as a notification but mark it as pending
    // In production, integrate with actual SMS provider
    return true;
  } catch (error) {
    appLogger.error("[Notification] SMS error", { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

// Main notification function
export async function sendNotification(params: {
  customerId: number;
  eventType: NotificationEventType;
  variables: Record<string, string>;
  channels?: ("email" | "sms")[];
}): Promise<{ email?: boolean; sms?: boolean }> {
  const { customerId, eventType, variables, channels = ["email"] } = params;
  const db = await getDb();
  if (!db) return {};

  // Get customer info
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    appLogger.error("[Notification] Customer not found", { customerId });
    return {};
  }

  const template = notificationTemplates[eventType];
  if (!template) {
    appLogger.error("[Notification] Template not found for event type", { eventType });
    return {};
  }

  // Add customer info to variables
  const allVars = {
    ...variables,
    customerName: customer.fullName,
    customerCode: customer.customerCode,
    mobile: customer.mobileNumber,
  };

  const subject = replaceTemplateVars(template.subject, allVars);
  const body = replaceTemplateVars(template.body, allVars);

  const results: { email?: boolean; sms?: boolean } = {};

  // Send email if customer has email and email channel is requested
  if (channels.includes("email") && customer.email) {
    const emailSent = await sendEmail(customer.email, subject, body);
    results.email = emailSent;

    // Log the notification
    await db.insert(notificationLogs).values({
      customerId,
      channel: "email",
      eventType,
      recipient: customer.email,
      subject,
      content: body,
      status: emailSent ? "sent" : "failed",
      sentAt: emailSent ? new Date() : null,
    });
  }

  // Send SMS if requested
  if (channels.includes("sms") && customer.mobileNumber) {
    // Create a shorter SMS version
    const smsMessage = `Wazn Express: ${subject.replace(/[📦✈️🛃📬🚚✅📍🧾💰🎉]/g, "").trim()}`;
    const smsSent = await sendSms(customer.mobileNumber, smsMessage);
    results.sms = smsSent;

    // Log the notification
    await db.insert(notificationLogs).values({
      customerId,
      channel: "sms",
      eventType,
      recipient: customer.mobileNumber,
      subject: null,
      content: smsMessage,
      status: smsSent ? "sent" : "pending", // SMS might be queued
      sentAt: smsSent ? new Date() : null,
    });
  }

  return results;
}

// Helper function to send package status notification
export async function notifyPackageStatusChange(
  packageId: number,
  newStatus: string,
  additionalVars?: Record<string, string>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get package with customer info
  const [pkg] = await db
    .select()
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!pkg) return;

  const eventType = statusToEventType[newStatus];
  if (!eventType) return;

  // Get batch info if available
  let batchInfo: Batch | null = null;
  if (pkg.batchId) {
    const [batch] = await db
      .select()
      .from(batches)
      .where(eq(batches.id, pkg.batchId))
      .limit(1);
    batchInfo = batch;
  }

  const variables: Record<string, string> = {
    packageCode: pkg.packageCode,
    trackingNumber: pkg.trackingNumber || "",
    weight: pkg.weightKg?.toString() || "0",
    shippingType: pkg.shippingType,
    batchCode: batchInfo?.batchCode || "",
    departureDate: batchInfo?.departureDate ? new Date(batchInfo.departureDate).toLocaleDateString() : "",
    estimatedArrival: batchInfo?.estimatedArrival ? new Date(batchInfo.estimatedArrival).toLocaleDateString() : "",
    destination: "Iraq", // Default destination
    ...additionalVars,
  };

  // Only send notification if package has a customer
  if (pkg.customerId) {
    await sendNotification({
      customerId: pkg.customerId,
      eventType,
      variables,
      channels: ["email", "sms"],
    });
  }
}

// Helper function to send batch status notification to all customers
export async function notifyBatchStatusChange(
  batchId: number,
  eventType: "batch_departed" | "batch_arrived"
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get batch info
  const [batch] = await db
    .select()
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  if (!batch) return;

  // Get all packages in this batch
  const batchPackages = await db
    .select()
    .from(packages)
    .where(eq(packages.batchId, batchId));

  // Get unique customer IDs (filter out null/unclaimed)
  const customerIds = Array.from(new Set(batchPackages.map(p => p.customerId).filter((id): id is number => id !== null)));

  const variables: Record<string, string> = {
    batchCode: batch.batchCode,
    estimatedArrival: batch.estimatedArrival ? new Date(batch.estimatedArrival).toLocaleDateString() : "",
  };

  // Send notification to each customer
  for (const customerId of customerIds) {
    await sendNotification({
      customerId,
      eventType,
      variables,
      channels: ["email", "sms"],
    });
  }
}

// Get notification history for a customer
export async function getCustomerNotifications(customerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.customerId, customerId))
    .orderBy(notificationLogs.createdAt)
    .limit(limit);
}
