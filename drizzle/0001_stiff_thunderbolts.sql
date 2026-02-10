CREATE TABLE `deletionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(100) NOT NULL,
	`deletionType` enum('single_category','old_data','test_data','factory_reset') NOT NULL,
	`recordCount` int NOT NULL,
	`details` json,
	`backupCreated` boolean NOT NULL DEFAULT false,
	`backupFileUrl` varchar(500),
	`backupFileName` varchar(255),
	`deletedById` int NOT NULL,
	`deletedByName` varchar(255),
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	`ipAddress` varchar(45),
	`reason` text,
	CONSTRAINT `deletionLogs_id` PRIMARY KEY(`id`)
);
