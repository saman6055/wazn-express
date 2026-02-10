CREATE TABLE `notificationSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`emailEnabled` boolean NOT NULL DEFAULT false,
	`smsEnabled` boolean NOT NULL DEFAULT false,
	`whatsappEnabled` boolean NOT NULL DEFAULT false,
	`whatsappApiKey` varchar(255),
	`whatsappPhoneNumberId` varchar(50),
	`whatsappTemplateId` varchar(100),
	`customSubject` varchar(255),
	`customBody` text,
	`updatedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationSettings_eventType_unique` UNIQUE(`eventType`)
);
