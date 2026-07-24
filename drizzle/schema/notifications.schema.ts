import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, bigint, index } from "drizzle-orm/mysql-core";

export const notificationLogs = mysqlTable("notificationLogs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId"),
  channel: mysqlEnum("channel", ["email", "whatsapp", "sms"]).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }),
  content: text("content"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "delivered"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

// ============ SYSTEM SETTINGS ============


export const customerNotificationPrefs = mysqlTable("customerNotificationPrefs", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  
  // Notification channels
  emailEnabled: boolean("emailEnabled").default(true),
  smsEnabled: boolean("smsEnabled").default(true),
  whatsappEnabled: boolean("whatsappEnabled").default(false),
  
  // Notification types
  packageRegistered: boolean("packageRegistered").default(true),
  packageStatusChange: boolean("packageStatusChange").default(true),
  packageDelivered: boolean("packageDelivered").default(true),
  paymentReminder: boolean("paymentReminder").default(true),
  promotions: boolean("promotions").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerNotificationPref = typeof customerNotificationPrefs.$inferSelect;
export type InsertCustomerNotificationPref = typeof customerNotificationPrefs.$inferInsert;

// ============ VIP CUSTOMERS & SPECIAL PRICING ============


export const scheduledTasksLog = mysqlTable("scheduledTasksLog", {
  id: int("id").autoincrement().primaryKey(),
  taskName: varchar("taskName", { length: 100 }).notNull(),
  taskType: varchar("taskType", { length: 50 }).notNull(), // e.g., "overdue_check", "payment_reminder"
  
  // Execution details
  startedAt: timestamp("startedAt").notNull(),
  completedAt: timestamp("completedAt"),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  
  // Results
  itemsProcessed: int("itemsProcessed").default(0),
  itemsSucceeded: int("itemsSucceeded").default(0),
  itemsFailed: int("itemsFailed").default(0),
  
  // Error tracking
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledTaskLog = typeof scheduledTasksLog.$inferSelect;
export type InsertScheduledTaskLog = typeof scheduledTasksLog.$inferInsert;


// ============ BARCODE SCANNING SYSTEM ============

// Package Scans - tracks every scan event



// Customer Messages - پەیامەکانی کڕیار (Chat System)
export const customerMessages = mysqlTable("customerMessages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Conversation reference
  conversationId: varchar("conversationId", { length: 50 }).notNull(), // CONV-{customerId}
  
  // Customer
  customerId: int("customerId").notNull(),
  
  // Message details
  message: text("message").notNull(),
  
  // Sender type
  senderType: mysqlEnum("senderType", ["customer", "admin"]).notNull(),
  senderId: int("senderId").notNull(), // userId of sender
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  // Attachments (optional)
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  attachmentType: mysqlEnum("attachmentType", ["image", "document", "other"]),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Conversation list, unread counts, and thread fetches all filter by
  // customerId and sort by createdAt — indexed to avoid full scans on
  // the admin-inbox/portal-chat polling paths.
  customerCreatedIdx: index("idx_cust_msg_customer_created").on(table.customerId, table.createdAt),
}));
export type CustomerMessage = typeof customerMessages.$inferSelect;
export type InsertCustomerMessage = typeof customerMessages.$inferInsert;

// Customer Addresses - ناونیشانەکانی کڕیار


// Customer Notifications - ئاگادارکردنەوەکانی کڕیار
export const customerNotifications = mysqlTable("customerNotifications", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer
  customerId: int("customerId").notNull(),
  
  // Notification details
  title: varchar("title", { length: 255 }).notNull(),
  titleKu: varchar("titleKu", { length: 255 }), // Kurdish
  titleAr: varchar("titleAr", { length: 255 }), // Arabic
  
  message: text("message").notNull(),
  messageKu: text("messageKu"), // Kurdish
  messageAr: text("messageAr"), // Arabic
  
  // Type
  type: mysqlEnum("type", ["info", "success", "warning", "error", "package", "payment", "promotion"]).default("info").notNull(),
  
  // Related entity (optional)
  relatedType: mysqlEnum("relatedType", ["package", "batch", "payment", "invoice", "full_package"]),
  relatedId: int("relatedId"),
  
  // Link (optional)
  actionUrl: varchar("actionUrl", { length: 500 }),
  actionLabel: varchar("actionLabel", { length: 100 }),
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // The portal fetches "my notifications, newest first" on every load/poll.
  customerCreatedIdx: index("idx_cust_notif_customer_created").on(table.customerId, table.createdAt),
}));
export type CustomerNotification = typeof customerNotifications.$inferSelect;
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;


// ============ CUSTOMER WEB PUSH SUBSCRIPTIONS ============

export const customerPushSubscriptions = mysqlTable("customer_push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),

  endpoint: varchar("endpoint", { length: 500 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),

  userAgent: varchar("userAgent", { length: 500 }),
  platform: varchar("platform", { length: 50 }),
  language: varchar("language", { length: 10 }),

  isActive: boolean("isActive").default(true).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  lastFailedAt: timestamp("lastFailedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  customerIdx: index("customerPushSubscriptions_customerId_idx").on(table.customerId),
  activeIdx: index("customerPushSubscriptions_active_idx").on(table.isActive),
}));

export type CustomerPushSubscription = typeof customerPushSubscriptions.$inferSelect;
export type InsertCustomerPushSubscription = typeof customerPushSubscriptions.$inferInsert;

// ============ PUSH NOTIFICATION CAMPAIGNS ============

export const pushNotificationCampaigns = mysqlTable("push_notification_campaigns", {
  id: int("id").autoincrement().primaryKey(),

  // Multilingual content (one of these MUST be present; UI shows the right language client-side)
  titleKu: varchar("titleKu", { length: 200 }),
  titleEn: varchar("titleEn", { length: 200 }),
  titleAr: varchar("titleAr", { length: 200 }),
  titleZh: varchar("titleZh", { length: 200 }),
  bodyKu: text("bodyKu"),
  bodyEn: text("bodyEn"),
  bodyAr: text("bodyAr"),
  bodyZh: text("bodyZh"),

  // Click destination (deep link inside portal)
  url: varchar("url", { length: 500 }),

  // Targeting
  targetType: mysqlEnum("targetType", ["all", "customer", "batch", "segment"]).notNull(),
  targetCustomerId: int("targetCustomerId"),
  targetBatchId: int("targetBatchId"),
  targetSegment: mysqlEnum("targetSegment", [
    "active_customers",
    "with_pending_packages",
    "with_unpaid_invoices",
    "vip_customers",
    "inactive_30d",
  ]),

  // Scheduling & status
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "completed", "failed", "cancelled"])
    .default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),

  // Delivery counters
  totalRecipients: int("totalRecipients").default(0).notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  expiredRemovedCount: int("expiredRemovedCount").default(0).notNull(),

  // Audit
  createdById: int("createdById").notNull(),
  errorMessage: text("errorMessage"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("pushCampaigns_status_idx").on(table.status),
  scheduledIdx: index("pushCampaigns_scheduled_idx").on(table.scheduledAt),
  createdIdx: index("pushCampaigns_created_idx").on(table.createdAt),
}));

export type PushNotificationCampaign = typeof pushNotificationCampaigns.$inferSelect;
export type InsertPushNotificationCampaign = typeof pushNotificationCampaigns.$inferInsert;

// ============ INVOICE TEMPLATES ============





// ============ NOTIFICATION TEMPLATES ============
export const notificationTemplates = mysqlTable("notificationTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template identification
  eventType: mysqlEnum("eventType", [
    "package_received", 
    "package_shipped", 
    "package_arrived", 
    "package_delivered",
    "payment_received",
    "invoice_created",
    "batch_shipped",
    "batch_arrived",
    "custom"
  ]).notNull(),
  
  name: varchar("name", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  
  // Message templates (with placeholders like {customerName}, {trackingNumber}, etc.)
  smsTemplate: text("smsTemplate"),
  smsTemplateAr: text("smsTemplateAr"),
  smsTemplateKu: text("smsTemplateKu"),
  
  whatsappTemplate: text("whatsappTemplate"),
  whatsappTemplateAr: text("whatsappTemplateAr"),
  whatsappTemplateKu: text("whatsappTemplateKu"),
  
  emailSubject: varchar("emailSubject", { length: 255 }),
  emailSubjectAr: varchar("emailSubjectAr", { length: 255 }),
  emailSubjectKu: varchar("emailSubjectKu", { length: 255 }),
  emailTemplate: text("emailTemplate"),
  emailTemplateAr: text("emailTemplateAr"),
  emailTemplateKu: text("emailTemplateKu"),
  
  pushTitle: varchar("pushTitle", { length: 100 }),
  pushTitleAr: varchar("pushTitleAr", { length: 100 }),
  pushTitleKu: varchar("pushTitleKu", { length: 100 }),
  pushTemplate: text("pushTemplate"),
  pushTemplateAr: text("pushTemplateAr"),
  pushTemplateKu: text("pushTemplateKu"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

// ============ LABEL TEMPLATES ============

export const activityAlerts = mysqlTable("activity_alerts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Alert details
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  category: mysqlEnum("category", ["customer", "package", "batch", "full_package", "purchase_request", "commission", "finance", "settings", "user", "system", "security"]).notNull(),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info").notNull(),
  
  // Related entity
  entityType: varchar("entityType", { length: 100 }),
  entityId: int("entityId"),
  entityCode: varchar("entityCode", { length: 100 }),
  
  // Related audit log
  auditLogId: int("auditLogId"),
  
  // Action that triggered the alert
  action: varchar("action", { length: 100 }).notNull(),
  
  // User who performed the action
  triggeredById: int("triggeredById"),
  triggeredByName: varchar("triggeredByName", { length: 255 }),
  
  // Read status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  readById: int("readById"),
  
  // Notification status
  notificationSent: boolean("notificationSent").default(false).notNull(),
  notificationSentAt: timestamp("notificationSentAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityAlert = typeof activityAlerts.$inferSelect;
export type InsertActivityAlert = typeof activityAlerts.$inferInsert;


// ============ SUPPORT CHATS ============


export const supportChats = mysqlTable("support_chats", {
  id: int("id").autoincrement().primaryKey(),
  
  // Customer info
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }),
  customerCode: varchar("customerCode", { length: 100 }),
  
  // Chat info
  subject: varchar("subject", { length: 255 }),
  category: mysqlEnum("category", ["order_status", "pricing", "payment", "general", "complaint", "other"]).default("general").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "urgent"]).default("normal").notNull(),
  
  // Status
  status: mysqlEnum("status", ["open", "pending", "resolved", "closed"]).default("open").notNull(),
  
  // Assignment
  assignedToId: int("assignedToId"),
  assignedToName: varchar("assignedToName", { length: 255 }),
  
  // Timestamps
  lastMessageAt: timestamp("lastMessageAt"),
  resolvedAt: timestamp("resolvedAt"),
  closedAt: timestamp("closedAt"),
  
  // Metadata
  unreadByCustomer: int("unreadByCustomer").default(0).notNull(),
  unreadByStaff: int("unreadByStaff").default(0).notNull(),
  totalMessages: int("totalMessages").default(0).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupportChat = typeof supportChats.$inferSelect;
export type InsertSupportChat = typeof supportChats.$inferInsert;

// ============ CHAT MESSAGES ============


export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  
  // Chat reference
  chatId: int("chatId").notNull(),
  
  // Sender info
  senderType: mysqlEnum("senderType", ["customer", "staff", "system", "bot"]).notNull(),
  senderId: int("senderId"),
  senderName: varchar("senderName", { length: 255 }),
  
  // Message content
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "file", "system", "voice"]).default("text").notNull(),
  
  // Attachments
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  attachmentName: varchar("attachmentName", { length: 255 }),
  attachmentType: varchar("attachmentType", { length: 100 }),
  
  // Status
  isRead: boolean("isRead").default(false).notNull(),
  readAt: timestamp("readAt"),
  
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ============ CUSTOMER CODE PREFIXES ============
