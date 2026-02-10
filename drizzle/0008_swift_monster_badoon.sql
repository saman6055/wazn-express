CREATE TABLE `backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`fileUrl` varchar(500),
	`fileSize` bigint,
	`backupType` enum('manual','scheduled_daily','scheduled_weekly','scheduled_monthly') NOT NULL,
	`status` enum('in_progress','completed','failed') NOT NULL DEFAULT 'in_progress',
	`errorMessage` text,
	`createdById` int,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `backups_id` PRIMARY KEY(`id`)
);
