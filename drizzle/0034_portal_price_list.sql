-- ============================================================================
-- Portal Price List Feature
-- ----------------------------------------------------------------------------
-- Adds customer-facing "Price List" section to the portal home page.
--
-- 1. pricingRules gains `showOnPortal` + per-language labels/icons/colors so
--    admins can curate which shipping rates are visible to customers and
--    how they are presented.
--
-- 2. serviceTypes gains `showOnPortal` + per-language descriptions and a
--    portal badge ("POPULAR" / "NEW") for marketing polish.
--
-- 3. New `portalPriceListSettings` table stores the ONE-ROW config for the
--    section as a whole — title, subtitle, disclaimer, layout variant,
--    position (top/below-header/below-stats), currency toggles.
--
-- All new columns are nullable / defaulted so the migration is zero-downtime
-- safe and backward-compatible with existing rows.
-- ============================================================================

ALTER TABLE `pricingRules`
  ADD COLUMN `showOnPortal` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `portalLabelKu` VARCHAR(150) NULL,
  ADD COLUMN `portalLabelEn` VARCHAR(150) NULL,
  ADD COLUMN `portalLabelAr` VARCHAR(150) NULL,
  ADD COLUMN `portalLabelZh` VARCHAR(150) NULL,
  ADD COLUMN `portalIcon` VARCHAR(50) NULL,
  ADD COLUMN `portalColor` VARCHAR(30) NULL,
  ADD COLUMN `portalBadge` VARCHAR(30) NULL,
  ADD COLUMN `portalSortOrder` INT NOT NULL DEFAULT 0;

ALTER TABLE `serviceTypes`
  ADD COLUMN `showOnPortal` BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `portalDescriptionKu` TEXT NULL,
  ADD COLUMN `portalDescriptionEn` TEXT NULL,
  ADD COLUMN `portalDescriptionAr` TEXT NULL,
  ADD COLUMN `portalDescriptionZh` TEXT NULL,
  ADD COLUMN `portalBadge` VARCHAR(30) NULL,
  ADD COLUMN `portalPriceLabelKu` VARCHAR(100) NULL,
  ADD COLUMN `portalPriceLabelEn` VARCHAR(100) NULL,
  ADD COLUMN `portalPriceLabelAr` VARCHAR(100) NULL,
  ADD COLUMN `portalPriceLabelZh` VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS `portalPriceListSettings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `isEnabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `titleKu` VARCHAR(200) NULL,
  `titleEn` VARCHAR(200) NULL,
  `titleAr` VARCHAR(200) NULL,
  `titleZh` VARCHAR(200) NULL,
  `subtitleKu` VARCHAR(400) NULL,
  `subtitleEn` VARCHAR(400) NULL,
  `subtitleAr` VARCHAR(400) NULL,
  `subtitleZh` VARCHAR(400) NULL,
  `showShippingRates` BOOLEAN NOT NULL DEFAULT TRUE,
  `showServices` BOOLEAN NOT NULL DEFAULT TRUE,
  `showRmbEquivalent` BOOLEAN NOT NULL DEFAULT TRUE,
  `showIqdEquivalent` BOOLEAN NOT NULL DEFAULT FALSE,
  `layoutVariant` ENUM('tabs','stacked','compact') NOT NULL DEFAULT 'tabs',
  `position` ENUM('top','belowHeader','belowStats') NOT NULL DEFAULT 'belowHeader',
  `accentColor` VARCHAR(30) NOT NULL DEFAULT 'purple',
  `disclaimerKu` TEXT NULL,
  `disclaimerEn` TEXT NULL,
  `disclaimerAr` TEXT NULL,
  `disclaimerZh` TEXT NULL,
  `updatedById` INT NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Seed the single-row settings with sensible defaults in all four languages.
INSERT INTO `portalPriceListSettings`
  (`isEnabled`, `titleKu`, `titleEn`, `titleAr`, `titleZh`,
   `subtitleKu`, `subtitleEn`, `subtitleAr`, `subtitleZh`,
   `disclaimerKu`, `disclaimerEn`, `disclaimerAr`, `disclaimerZh`)
VALUES
  (TRUE,
   'لیستی نرخی خزمەتگوزاری', 'Price List', 'قائمة الأسعار', '价格表',
   'نرخە نوێکراوەکانی گواستنەوە و خزمەتگوزاری', 'Up-to-date shipping & service rates', 'أحدث أسعار الشحن والخدمات', '最新运费和服务价格',
   'ئەم نرخانە ڕێنماییکارن و لەوانەیە بەپێی کێش، قەبارە و وڵاتی مەبەست بگۆڕێن. بۆ زانیاری زیاتر پەیوەندیمان پێوە بکە.',
   'These rates are indicative and may vary based on weight, volume and destination. Contact us for a precise quote.',
   'هذه الأسعار تقريبية وقد تختلف حسب الوزن والحجم والوجهة. اتصل بنا للحصول على عرض سعر دقيق.',
   '以上价格为参考价格，可能因重量、体积和目的地而异。请联系我们获取准确报价。');
