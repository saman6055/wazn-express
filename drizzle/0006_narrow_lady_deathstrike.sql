CREATE TABLE `customerNotificationPrefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`emailEnabled` boolean DEFAULT true,
	`smsEnabled` boolean DEFAULT true,
	`whatsappEnabled` boolean DEFAULT false,
	`packageRegistered` boolean DEFAULT true,
	`packageStatusChange` boolean DEFAULT true,
	`packageDelivered` boolean DEFAULT true,
	`paymentReminder` boolean DEFAULT true,
	`promotions` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerNotificationPrefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `customerNotificationPrefs_customerId_unique` UNIQUE(`customerId`)
);
--> statement-breakpoint
CREATE TABLE `packageQrCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`packageType` enum('regular','full_package') NOT NULL DEFAULT 'regular',
	`qrCode` varchar(100) NOT NULL,
	`qrImageUrl` text,
	`lastScannedAt` timestamp,
	`lastScannedById` int,
	`scanCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `packageQrCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `packageQrCodes_qrCode_unique` UNIQUE(`qrCode`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`invoiceId` int,
	`amountUsd` decimal(10,2) NOT NULL,
	`amountLocal` decimal(15,2),
	`currency` varchar(3) DEFAULT 'USD',
	`exchangeRate` decimal(10,4),
	`paymentMethod` enum('cash','bank_transfer','mobile_money','card','other') NOT NULL DEFAULT 'cash',
	`referenceNumber` varchar(100),
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'completed',
	`notes` text,
	`receivedById` int NOT NULL,
	`paymentDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledTasksLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskName` varchar(100) NOT NULL,
	`taskType` varchar(50) NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`itemsProcessed` int DEFAULT 0,
	`itemsSucceeded` int DEFAULT 0,
	`itemsFailed` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduledTasksLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vipCustomers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`tier` enum('silver','gold','platinum') NOT NULL DEFAULT 'silver',
	`discountPercent` decimal(5,2) DEFAULT '0',
	`fixedPricePerKgAir` decimal(10,2),
	`fixedPricePerKgSea` decimal(10,2),
	`creditLimitUsd` decimal(10,2) DEFAULT '0',
	`notes` text,
	`validFrom` timestamp NOT NULL DEFAULT (now()),
	`validTo` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vipCustomers_id` PRIMARY KEY(`id`),
	CONSTRAINT `vipCustomers_customerId_unique` UNIQUE(`customerId`)
);
