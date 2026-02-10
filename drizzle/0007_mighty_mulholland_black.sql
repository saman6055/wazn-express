CREATE TABLE `packageScans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int,
	`trackingNumber` varchar(100) NOT NULL,
	`scanType` enum('registered','received_china','in_batch','in_transit','received_local','out_for_delivery','delivered','returned','customs_hold') NOT NULL,
	`scannedById` int NOT NULL,
	`warehouseId` int,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`locationName` varchar(255),
	`notes` text,
	`photoUrl` varchar(500),
	`deviceId` int,
	`deviceInfo` json,
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `packageScans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packageStatusHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`fromStatus` varchar(50),
	`toStatus` varchar(50) NOT NULL,
	`changedById` int NOT NULL,
	`changeMethod` enum('scan','manual','system','api') NOT NULL DEFAULT 'manual',
	`scanId` int,
	`reason` varchar(255),
	`notes` text,
	`metadata` json,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `packageStatusHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scanDevices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceName` varchar(100) NOT NULL,
	`deviceType` enum('mobile','scanner','tablet','desktop') NOT NULL DEFAULT 'mobile',
	`deviceIdentifier` varchar(255),
	`assignedToId` int,
	`warehouseId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastActiveAt` timestamp,
	`totalScans` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scanDevices_id` PRIMARY KEY(`id`),
	CONSTRAINT `scanDevices_deviceIdentifier_unique` UNIQUE(`deviceIdentifier`)
);
