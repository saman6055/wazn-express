CREATE TABLE `customer_code_prefixes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(10) NOT NULL,
	`label` varchar(100) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_code_prefixes_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_code_prefixes_code_unique` UNIQUE(`code`)
);
