CREATE TABLE `expenseAlertLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	`totalExpenses` decimal(12,2) NOT NULL,
	`thresholdAmount` decimal(12,2) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`expenseCount` int NOT NULL DEFAULT 0,
	`notificationSent` boolean NOT NULL DEFAULT false,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenseAlertLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenseAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` enum('daily','weekly','monthly','per_transaction') NOT NULL,
	`thresholdAmount` decimal(12,2) NOT NULL,
	`currency` enum('USD','IQD') NOT NULL DEFAULT 'USD',
	`categoryId` int,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`notifyMethod` enum('system','email','both') NOT NULL DEFAULT 'system',
	`description` text,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenseAlerts_id` PRIMARY KEY(`id`)
);
