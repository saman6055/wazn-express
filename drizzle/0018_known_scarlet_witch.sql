CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`senderType` enum('customer','staff','system','bot') NOT NULL,
	`senderId` int,
	`senderName` varchar(255),
	`content` text NOT NULL,
	`messageType` enum('text','image','file','system') NOT NULL DEFAULT 'text',
	`attachmentUrl` varchar(500),
	`attachmentName` varchar(255),
	`attachmentType` varchar(100),
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`customerName` varchar(255),
	`customerCode` varchar(100),
	`subject` varchar(255),
	`category` enum('order_status','pricing','payment','general','complaint','other') NOT NULL DEFAULT 'general',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','pending','resolved','closed') NOT NULL DEFAULT 'open',
	`assignedToId` int,
	`assignedToName` varchar(255),
	`lastMessageAt` timestamp,
	`resolvedAt` timestamp,
	`closedAt` timestamp,
	`unreadByCustomer` int NOT NULL DEFAULT 0,
	`unreadByStaff` int NOT NULL DEFAULT 0,
	`totalMessages` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_chats_id` PRIMARY KEY(`id`)
);
