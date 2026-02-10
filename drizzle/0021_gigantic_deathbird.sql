CREATE TABLE `packageClaimRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestNumber` varchar(50) NOT NULL,
	`packageId` int NOT NULL,
	`trackingNumber` varchar(100) NOT NULL,
	`customerId` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`customerNote` text,
	`reviewedById` int,
	`reviewedAt` timestamp,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packageClaimRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `packageClaimRequests_requestNumber_unique` UNIQUE(`requestNumber`)
);
