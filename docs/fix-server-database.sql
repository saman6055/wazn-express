-- ============================================================
-- Fix Server Database — Run on production MySQL (default DB)
-- ============================================================
-- 1) Create missing table: batchLabelTemplates
-- 2) Add missing columns to: productCategories (sortOrder, icon, color, createdById)
-- ============================================================

-- ---------- 1. Create batchLabelTemplates if missing ----------
CREATE TABLE IF NOT EXISTS batchLabelTemplates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  isDefault BOOLEAN NOT NULL DEFAULT FALSE,
  size ENUM('10x15', '10x10', 'A6', 'A5', 'custom') NOT NULL DEFAULT '10x15',
  widthMm INT DEFAULT 100,
  heightMm INT DEFAULT 150,
  showQrCode BOOLEAN NOT NULL DEFAULT TRUE,
  qrCodeSize INT DEFAULT 80,
  qrCodePosition ENUM('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center') DEFAULT 'top-right',
  showBarcode BOOLEAN NOT NULL DEFAULT TRUE,
  barcodeType ENUM('code128', 'code39', 'ean13', 'qr') DEFAULT 'code128',
  showLogo BOOLEAN NOT NULL DEFAULT TRUE,
  logoUrl VARCHAR(500),
  logoWidth INT DEFAULT 60,
  showCustomerName BOOLEAN NOT NULL DEFAULT TRUE,
  showCustomerCode BOOLEAN NOT NULL DEFAULT TRUE,
  showTotalPackages BOOLEAN NOT NULL DEFAULT TRUE,
  showTotalWeight BOOLEAN NOT NULL DEFAULT TRUE,
  showTotalVolume BOOLEAN NOT NULL DEFAULT TRUE,
  showTotalPrice BOOLEAN NOT NULL DEFAULT TRUE,
  showBatchNumber BOOLEAN NOT NULL DEFAULT TRUE,
  showDate BOOLEAN NOT NULL DEFAULT TRUE,
  primaryColor VARCHAR(7) DEFAULT '#059669',
  fontFamily VARCHAR(100) DEFAULT 'Arial',
  fontSize INT DEFAULT 12,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- 2. Add missing columns to productCategories ----------
-- Run each ALTER only if the column does not exist (ignore errors if already present).

ALTER TABLE productCategories ADD COLUMN icon VARCHAR(50) NULL AFTER nameKu;
ALTER TABLE productCategories ADD COLUMN color VARCHAR(20) NULL AFTER icon;
ALTER TABLE productCategories ADD COLUMN sortOrder INT NOT NULL DEFAULT 0 AFTER color;
ALTER TABLE productCategories ADD COLUMN createdById INT NULL AFTER sortOrder;

-- If your MySQL version complains (e.g. duplicate column), run one by one and skip the ones that already exist.
