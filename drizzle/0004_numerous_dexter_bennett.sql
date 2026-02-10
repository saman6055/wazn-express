ALTER TABLE `packages` ADD `isCharged` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `deliveryType` enum('air_transit','warehouse_pickup','direct_delivery');