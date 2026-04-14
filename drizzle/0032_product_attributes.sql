-- Create productAttributes table for managing colors, sizes, and product types
CREATE TABLE `productAttributes` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `type` enum('color','size','productType') NOT NULL,
  `value` varchar(200) NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

-- Add productType column to fullPackageOrders
ALTER TABLE `fullPackageOrders` ADD COLUMN `productType` varchar(200);
