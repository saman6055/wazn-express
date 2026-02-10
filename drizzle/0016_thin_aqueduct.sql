ALTER TABLE `auditLogs` ADD `userName` varchar(255);--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `actionLabel` varchar(255);--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `category` enum('customer','package','batch','full_package','purchase_request','commission','finance','settings','user','system') DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `entityCode` varchar(100);--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `changedFields` json;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `description` text;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `metadata` json;--> statement-breakpoint
CREATE INDEX `idx_audit_category` ON `auditLogs` (`category`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity_type` ON `auditLogs` (`entityType`);--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_created_at` ON `auditLogs` (`createdAt`);