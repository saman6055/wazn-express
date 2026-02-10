ALTER TABLE `customerAccounts` ADD `packageDebtUsd` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerAccounts` ADD `fullPackageDebtUsd` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerAccounts` ADD `purchaseRequestDebtUsd` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerAccounts` ADD `commissionDebtUsd` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerAccounts` ADD `serviceDebtUsd` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerAccounts` ADD `creditBalanceUsd` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerAccounts` ADD `creditBalanceIqd` decimal(15,0) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `isCharged` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `fullPackageOrders` ADD `chargedToAccountAt` timestamp;