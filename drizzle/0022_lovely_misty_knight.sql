CREATE TABLE `customerAddresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`label` varchar(100) NOT NULL,
	`recipientName` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`country` varchar(100) NOT NULL DEFAULT 'Iraq',
	`city` varchar(100) NOT NULL,
	`district` varchar(100),
	`street` varchar(255),
	`building` varchar(100),
	`floor` varchar(20),
	`apartment` varchar(20),
	`landmark` text,
	`notes` text,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerAddresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` varchar(50) NOT NULL,
	`customerId` int NOT NULL,
	`message` text NOT NULL,
	`senderType` enum('customer','admin') NOT NULL,
	`senderId` int NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`attachmentUrl` varchar(500),
	`attachmentType` enum('image','document','other'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`titleKu` varchar(255),
	`titleAr` varchar(255),
	`message` text NOT NULL,
	`messageKu` text,
	`messageAr` text,
	`type` enum('info','success','warning','error','package','payment','promotion') NOT NULL DEFAULT 'info',
	`relatedType` enum('package','batch','payment','invoice','full_package'),
	`relatedId` int,
	`actionUrl` varchar(500),
	`actionLabel` varchar(100),
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerNotifications_id` PRIMARY KEY(`id`)
);
