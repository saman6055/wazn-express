/**
 * Wazn Express - Auto Migration System v2.0
 * 
 * This file contains all 72 table definitions for automatic database migration.
 * Tables are ordered by dependency (tables with no foreign keys first).
 * 
 * @author Wazn Express Development Team
 * @version 2.0.0
 * @date 2026-02-01
 */

import { Connection } from "mysql2/promise";
import { appLogger } from "../utils/logger";

// ============ MIGRATION CONFIGURATION ============
export interface MigrationConfig {
  connection: Connection;
  logger?: (message: string, level?: 'info' | 'warn' | 'error' | 'success') => void;
  dryRun?: boolean;
}

export interface MigrationResult {
  success: boolean;
  tablesCreated: string[];
  tablesSkipped: string[];
  errors: { table: string; error: string }[];
  duration: number;
}

// ============ TABLE DEFINITIONS (72 TABLES) ============
// Ordered by dependency - independent tables first

export const TABLE_DEFINITIONS: { name: string; sql: string; dependencies: string[] }[] = [
  // ============ LEVEL 1: NO DEPENDENCIES ============
  
  {
    name: "users",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      openId VARCHAR(64) UNIQUE,
      username VARCHAR(100) UNIQUE,
      name TEXT,
      email VARCHAR(320),
      loginMethod VARCHAR(64),
      role ENUM('super_admin', 'admin', 'employee', 'accountant') NOT NULL DEFAULT 'employee',
      mobileNumber VARCHAR(20) UNIQUE,
      passwordHash VARCHAR(255),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "countries",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS countries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nameEn VARCHAR(100) NOT NULL,
      nameAr VARCHAR(100),
      nameKu VARCHAR(100),
      nameZh VARCHAR(100),
      nameTr VARCHAR(100),
      nameFa VARCHAR(100),
      isoCode VARCHAR(3) NOT NULL UNIQUE,
      defaultCurrency VARCHAR(3),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      isOrigin BOOLEAN NOT NULL DEFAULT FALSE,
      isDestination BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "currencies",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS currencies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(10) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      symbol VARCHAR(10) NOT NULL,
      exchangeRate DECIMAL(20, 6) NOT NULL,
      isBaseCurrency BOOLEAN NOT NULL DEFAULT FALSE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdById INT,
      createdByName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "taxRates",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS tax_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      rate DECIMAL(5, 2) NOT NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      description TEXT,
      createdById INT,
      createdByName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "emailTemplates",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS email_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      subject VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      variables TEXT,
      category ENUM('notification', 'invoice', 'report', 'alert') NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdById INT,
      createdByName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "ipWhitelist",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS ip_whitelist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ipAddress VARCHAR(45) NOT NULL UNIQUE,
      description VARCHAR(255),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdById INT,
      createdByName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "systemSettings",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS systemSettings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      settingKey VARCHAR(100) NOT NULL UNIQUE,
      settingValue TEXT,
      settingType VARCHAR(20) DEFAULT 'string',
      description TEXT,
      updatedById INT,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "productCategories",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS productCategories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nameEn VARCHAR(100) NOT NULL,
      nameAr VARCHAR(100),
      nameKu VARCHAR(100),
      nameZh VARCHAR(100),
      description TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "expenseCategories",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS expenseCategories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      nameKu VARCHAR(100),
      description TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "serviceTypes",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS serviceTypes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nameEn VARCHAR(100) NOT NULL,
      nameKu VARCHAR(100),
      nameAr VARCHAR(100),
      icon VARCHAR(50),
      color VARCHAR(20),
      defaultCost DECIMAL(10, 2),
      defaultPrice DECIMAL(10, 2),
      requiresCustomer BOOLEAN NOT NULL DEFAULT TRUE,
      addToCustomerBalance BOOLEAN NOT NULL DEFAULT TRUE,
      sortOrder INT NOT NULL DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      showOnPortal BOOLEAN NOT NULL DEFAULT FALSE,
      portalDescriptionKu TEXT,
      portalDescriptionEn TEXT,
      portalDescriptionAr TEXT,
      portalDescriptionZh TEXT,
      portalBadge VARCHAR(30),
      portalPriceLabelKu VARCHAR(100),
      portalPriceLabelEn VARCHAR(100),
      portalPriceLabelAr VARCHAR(100),
      portalPriceLabelZh VARCHAR(100),
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    // Portal price list — single-row settings table. Lazily seeded by
    // getPortalPriceListSettings() in server/db/settings.db.ts, so no
    // initial INSERT is needed here. The portal gracefully hides the
    // section when the row is missing.
    name: "portalPriceListSettings",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS portalPriceListSettings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      titleKu VARCHAR(200),
      titleEn VARCHAR(200),
      titleAr VARCHAR(200),
      titleZh VARCHAR(200),
      subtitleKu VARCHAR(400),
      subtitleEn VARCHAR(400),
      subtitleAr VARCHAR(400),
      subtitleZh VARCHAR(400),
      showShippingRates BOOLEAN NOT NULL DEFAULT TRUE,
      showServices BOOLEAN NOT NULL DEFAULT TRUE,
      showRmbEquivalent BOOLEAN NOT NULL DEFAULT TRUE,
      showIqdEquivalent BOOLEAN NOT NULL DEFAULT FALSE,
      layoutVariant ENUM('tabs','stacked','compact') NOT NULL DEFAULT 'tabs',
      position ENUM('top','belowHeader','belowStats') NOT NULL DEFAULT 'belowHeader',
      accentColor VARCHAR(30) NOT NULL DEFAULT 'purple',
      disclaimerKu TEXT,
      disclaimerEn TEXT,
      disclaimerAr TEXT,
      disclaimerZh TEXT,
      updatedById INT,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockCategories",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS stockCategories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      nameKu VARCHAR(100),
      nameAr VARCHAR(100),
      slug VARCHAR(100) UNIQUE,
      description TEXT,
      parentId INT,
      image VARCHAR(500),
      sortOrder INT DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerCodePrefixes",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS customer_code_prefixes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(10) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "invoiceTemplates",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS invoiceTemplates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      paperSize ENUM('A4', 'A5', 'Letter', 'Thermal80mm') NOT NULL DEFAULT 'A4',
      orientation ENUM('portrait', 'landscape') NOT NULL DEFAULT 'portrait',
      showLogo BOOLEAN NOT NULL DEFAULT TRUE,
      logoUrl VARCHAR(500),
      logoWidth INT DEFAULT 150,
      showCompanyInfo BOOLEAN NOT NULL DEFAULT TRUE,
      companyName VARCHAR(255),
      companyAddress TEXT,
      companyPhone VARCHAR(50),
      companyEmail VARCHAR(320),
      showCustomerInfo BOOLEAN NOT NULL DEFAULT TRUE,
      showPackageDetails BOOLEAN NOT NULL DEFAULT TRUE,
      showPriceBreakdown BOOLEAN NOT NULL DEFAULT TRUE,
      showPaymentInfo BOOLEAN NOT NULL DEFAULT TRUE,
      showQrCode BOOLEAN NOT NULL DEFAULT TRUE,
      showBarcode BOOLEAN NOT NULL DEFAULT FALSE,
      showSignatureLine BOOLEAN NOT NULL DEFAULT TRUE,
      showTerms BOOLEAN NOT NULL DEFAULT TRUE,
      termsText TEXT,
      footerText TEXT,
      primaryColor VARCHAR(7) DEFAULT '#000000',
      fontFamily VARCHAR(100) DEFAULT 'Arial',
      fontSize INT DEFAULT 12,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "labelTemplates",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS labelTemplates (
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
      showTrackingNumber BOOLEAN NOT NULL DEFAULT TRUE,
      showCustomerName BOOLEAN NOT NULL DEFAULT TRUE,
      showCustomerCode BOOLEAN NOT NULL DEFAULT TRUE,
      showCustomerPhone BOOLEAN NOT NULL DEFAULT TRUE,
      showDestinationCity BOOLEAN NOT NULL DEFAULT TRUE,
      showWeight BOOLEAN NOT NULL DEFAULT TRUE,
      showDimensions BOOLEAN NOT NULL DEFAULT FALSE,
      showShippingType BOOLEAN NOT NULL DEFAULT TRUE,
      showBatchNumber BOOLEAN NOT NULL DEFAULT TRUE,
      showDate BOOLEAN NOT NULL DEFAULT TRUE,
      showPrice BOOLEAN NOT NULL DEFAULT FALSE,
      primaryColor VARCHAR(7) DEFAULT '#000000',
      fontFamily VARCHAR(100) DEFAULT 'Arial',
      fontSize INT DEFAULT 12,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "batchLabelTemplates",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS batchLabelTemplates (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "notificationTemplates",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS notificationTemplates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eventType VARCHAR(100) NOT NULL UNIQUE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      smsEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      smsTemplate TEXT,
      smsTemplateAr TEXT,
      smsTemplateKu TEXT,
      whatsappEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      whatsappTemplate TEXT,
      whatsappTemplateAr TEXT,
      whatsappTemplateKu TEXT,
      emailEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      emailSubject VARCHAR(255),
      emailSubjectAr VARCHAR(255),
      emailSubjectKu VARCHAR(255),
      emailTemplate TEXT,
      emailTemplateAr TEXT,
      emailTemplateKu TEXT,
      pushTitle VARCHAR(100),
      pushTitleAr VARCHAR(100),
      pushTitleKu VARCHAR(100),
      pushTemplate TEXT,
      pushTemplateAr TEXT,
      pushTemplateKu TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "notificationSettings",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS notificationSettings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eventType VARCHAR(100) NOT NULL UNIQUE,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      emailEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      smsEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      whatsappEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      pushEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      emailRecipients TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // ============ LEVEL 2: DEPENDS ON LEVEL 1 ============

  {
    name: "customers",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerCode VARCHAR(100) NOT NULL UNIQUE,
      sequenceNumber INT NOT NULL UNIQUE,
      fullName VARCHAR(255) NOT NULL,
      fullNameArabic VARCHAR(255),
      fullNameKurdish VARCHAR(255),
      gender ENUM('male', 'female'),
      nationality VARCHAR(100),
      businessType VARCHAR(100),
      mobileNumber VARCHAR(20) NOT NULL UNIQUE,
      secondaryMobile VARCHAR(20),
      passwordHash VARCHAR(255) NOT NULL,
      email VARCHAR(320),
      country VARCHAR(100),
      city VARCHAR(100),
      district VARCHAR(100),
      address TEXT,
      passportUrl TEXT,
      nationalIdUrl TEXT,
      contractUrl TEXT,
      goodsTypePreferences JSON,
      shippingTypePreferences JSON,
      serviceTypes JSON,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      linkedUserId INT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      lastSignedIn TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "warehouses",
    dependencies: ["countries"],
    sql: `CREATE TABLE IF NOT EXISTS warehouses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nameEn VARCHAR(200) NOT NULL,
      nameAr VARCHAR(200),
      nameKu VARCHAR(200),
      nameZh VARCHAR(200),
      nameTr VARCHAR(200),
      nameFa VARCHAR(200),
      countryId INT NOT NULL,
      city VARCHAR(100) NOT NULL,
      addressEn TEXT,
      addressAr TEXT,
      addressKu TEXT,
      warehouseType ENUM('air', 'sea', 'custom') NOT NULL,
      codePrefix VARCHAR(10) NOT NULL,
      expectedDeliveryMin INT,
      expectedDeliveryMax INT,
      pricingModel ENUM('per_kg', 'per_cbm') NOT NULL,
      contactInfo TEXT,
      notes TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "suppliers",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      nameArabic VARCHAR(255),
      nameChinese VARCHAR(255),
      contactPerson VARCHAR(255),
      phone VARCHAR(50),
      wechatId VARCHAR(100),
      email VARCHAR(320),
      platform ENUM('1688', 'taobao', 'alibaba', 'pinduoduo', 'other') DEFAULT '1688',
      platformShopUrl TEXT,
      rating DECIMAL(3, 2) DEFAULT 5.00,
      totalOrders INT DEFAULT 0,
      totalSpentUsd DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "partners",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS partners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      nameKu VARCHAR(255),
      email VARCHAR(320),
      phone VARCHAR(20),
      ownershipPercentage DECIMAL(5, 2) NOT NULL,
      initialCapital DECIMAL(14, 2) NOT NULL DEFAULT 0,
      currentBalance DECIMAL(14, 2) NOT NULL DEFAULT 0,
      joinDate TIMESTAMP NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "cashAccounts",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS cashAccounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountName VARCHAR(255) NOT NULL,
      accountNameKu VARCHAR(255),
      accountType ENUM('cash', 'bank', 'mobile_wallet') NOT NULL,
      bankName VARCHAR(255),
      accountNumber VARCHAR(100),
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      currentBalance DECIMAL(14, 2) NOT NULL DEFAULT 0,
      initialBalance DECIMAL(14, 2) NOT NULL DEFAULT 0,
      description TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      isPrimary BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "companyDebts",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS companyDebts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      creditorName VARCHAR(255) NOT NULL,
      creditorType ENUM('personal', 'bank', 'supplier', 'other') NOT NULL,
      creditorPhone VARCHAR(20),
      creditorEmail VARCHAR(320),
      principalAmount DECIMAL(14, 2) NOT NULL,
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      principalAmountUsd DECIMAL(14, 2) NOT NULL,
      interestRate DECIMAL(5, 2) DEFAULT 0,
      totalInterest DECIMAL(14, 2) DEFAULT 0,
      totalAmount DECIMAL(14, 2) NOT NULL,
      paidAmount DECIMAL(14, 2) NOT NULL DEFAULT 0,
      remainingAmount DECIMAL(14, 2) NOT NULL,
      startDate TIMESTAMP NOT NULL,
      dueDate TIMESTAMP,
      installmentCount INT,
      installmentAmount DECIMAL(14, 2),
      status ENUM('active', 'paid', 'overdue', 'restructured') NOT NULL DEFAULT 'active',
      purpose TEXT,
      collateral TEXT,
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "permissions",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      module VARCHAR(100) NOT NULL,
      canView BOOLEAN NOT NULL DEFAULT FALSE,
      canCreate BOOLEAN NOT NULL DEFAULT FALSE,
      canEdit BOOLEAN NOT NULL DEFAULT FALSE,
      canDelete BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_module (userId, module)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "subPermissions",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS sub_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      module VARCHAR(100) NOT NULL,
      permissionKey VARCHAR(100) NOT NULL,
      isAllowed BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_module_key (userId, module, permissionKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "exchangeRates",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS exchangeRates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      baseCurrency VARCHAR(3) NOT NULL DEFAULT 'USD',
      targetCurrency VARCHAR(3) NOT NULL,
      rate DECIMAL(15, 6) NOT NULL,
      source VARCHAR(50),
      isManualOverride BOOLEAN NOT NULL DEFAULT FALSE,
      effectiveFrom TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      effectiveTo TIMESTAMP,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "scanDevices",
    dependencies: ["users", "warehouses"],
    sql: `CREATE TABLE IF NOT EXISTS scanDevices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deviceName VARCHAR(100) NOT NULL,
      deviceType ENUM('mobile', 'scanner', 'tablet', 'desktop') NOT NULL DEFAULT 'mobile',
      deviceIdentifier VARCHAR(255) UNIQUE,
      assignedToId INT,
      warehouseId INT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      lastActiveAt TIMESTAMP,
      totalScans INT DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockProducts",
    dependencies: ["stockCategories", "suppliers"],
    sql: `CREATE TABLE IF NOT EXISTS stockProducts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku VARCHAR(50) NOT NULL UNIQUE,
      barcode VARCHAR(100) UNIQUE,
      name VARCHAR(255) NOT NULL,
      nameKu VARCHAR(255),
      nameAr VARCHAR(255),
      nameCn VARCHAR(255),
      categoryId INT,
      description TEXT,
      shortDescription VARCHAR(500),
      mainImage VARCHAR(500),
      images JSON,
      costPrice DECIMAL(10, 2) DEFAULT 0,
      sellingPrice DECIMAL(10, 2) DEFAULT 0,
      minSellingPrice DECIMAL(10, 2),
      unit VARCHAR(50) DEFAULT 'piece',
      minStockLevel INT DEFAULT 5,
      maxStockLevel INT,
      reorderQuantity INT DEFAULT 10,
      currentStock INT DEFAULT 0,
      reservedStock INT DEFAULT 0,
      availableStock INT DEFAULT 0,
      trackInventory BOOLEAN NOT NULL DEFAULT TRUE,
      allowNegativeStock BOOLEAN NOT NULL DEFAULT FALSE,
      weight DECIMAL(8, 3),
      length DECIMAL(8, 2),
      width DECIMAL(8, 2),
      height DECIMAL(8, 2),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      isFeatured BOOLEAN NOT NULL DEFAULT FALSE,
      defaultSupplierId INT,
      supplierSku VARCHAR(100),
      tags JSON,
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // ============ LEVEL 3: DEPENDS ON LEVEL 2 ============

  {
    name: "pricingRules",
    dependencies: ["countries", "warehouses", "users"],
    sql: `CREATE TABLE IF NOT EXISTS pricingRules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      originCountryId INT NOT NULL,
      originWarehouseId INT,
      destinationCountryId INT NOT NULL,
      shippingType ENUM('air_regular', 'air_irregular', 'sea') NOT NULL,
      pricePerUnit DECIMAL(10, 2) NOT NULL,
      unit ENUM('kg', 'cbm') NOT NULL,
      effectiveFrom TIMESTAMP NOT NULL,
      effectiveTo TIMESTAMP,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "batches",
    dependencies: ["warehouses", "countries", "users"],
    sql: `CREATE TABLE IF NOT EXISTS batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batchCode VARCHAR(50) NOT NULL UNIQUE,
      originWarehouseId INT NOT NULL,
      destinationCountryId INT NOT NULL,
      shippingType ENUM('air_regular', 'air_irregular', 'sea') NOT NULL,
      carrierInfo VARCHAR(255),
      airlineName VARCHAR(100),
      flightNumber VARCHAR(50),
      shippingCompany VARCHAR(100),
      containerNumber VARCHAR(50),
      vesselName VARCHAR(100),
      awbNumber VARCHAR(50),
      shipmentTrackings JSON,
      cartonCount INT,
      shippingCost DECIMAL(12, 2),
      departureDate TIMESTAMP,
      estimatedArrival TIMESTAMP,
      actualArrival TIMESTAMP,
      status ENUM('preparing', 'in_transit', 'arrived', 'customs', 'delivered', 'closed') NOT NULL DEFAULT 'preparing',
      totalPackages INT NOT NULL DEFAULT 0,
      totalWeight DECIMAL(10, 2),
      actualWeightKg DECIMAL(10, 2),
      actualCbm DECIMAL(10, 4),
      chargedWeightKg DECIMAL(10, 2),
      chargedCbm DECIMAL(10, 4),
      costPerKg DECIMAL(10, 2),
      costPerCbm DECIMAL(10, 2),
      pricePerKg DECIMAL(10, 2),
      pricePerCbm DECIMAL(10, 2),
      useTieredPricing BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerAccounts",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerAccounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL UNIQUE,
      accountNumber VARCHAR(50) NOT NULL UNIQUE,
      currentBalanceUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      currentBalanceIqd DECIMAL(15, 0) NOT NULL DEFAULT 0,
      packageDebtUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      fullPackageDebtUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      purchaseRequestDebtUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      commissionDebtUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      totalDebtUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      totalPaidUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      creditLimitUsd DECIMAL(12, 2) DEFAULT 0,
      isOverLimit BOOLEAN NOT NULL DEFAULT FALSE,
      lastActivityAt TIMESTAMP,
      lastPaymentAt TIMESTAMP,
      lastPaymentAmount DECIMAL(12, 2),
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerNotificationPrefs",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerNotificationPrefs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL UNIQUE,
      emailEnabled BOOLEAN DEFAULT TRUE,
      smsEnabled BOOLEAN DEFAULT TRUE,
      whatsappEnabled BOOLEAN DEFAULT FALSE,
      packageRegistered BOOLEAN DEFAULT TRUE,
      packageStatusChange BOOLEAN DEFAULT TRUE,
      packageDelivered BOOLEAN DEFAULT TRUE,
      paymentReminder BOOLEAN DEFAULT TRUE,
      promotions BOOLEAN DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "vipCustomers",
    dependencies: ["customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS vipCustomers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL UNIQUE,
      tier ENUM('silver', 'gold', 'platinum') NOT NULL DEFAULT 'silver',
      discountPercent DECIMAL(5, 2) DEFAULT 0,
      fixedPricePerKgAir DECIMAL(10, 2),
      fixedPricePerKgSea DECIMAL(10, 2),
      creditLimitUsd DECIMAL(10, 2) DEFAULT 0,
      notes TEXT,
      validFrom TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      validTo TIMESTAMP,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerAddresses",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerAddresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      addressType ENUM('home', 'work', 'warehouse', 'other') NOT NULL DEFAULT 'home',
      label VARCHAR(100),
      recipientName VARCHAR(255),
      phone VARCHAR(20),
      country VARCHAR(100),
      city VARCHAR(100),
      district VARCHAR(100),
      street TEXT,
      building VARCHAR(100),
      floor VARCHAR(20),
      apartment VARCHAR(20),
      postalCode VARCHAR(20),
      latitude DECIMAL(10, 7),
      longitude DECIMAL(10, 7),
      notes TEXT,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerDeclaredPackages",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerDeclaredPackages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      trackingNumber VARCHAR(100) NOT NULL,
      platform ENUM('taobao', 'pinduoduo', 'alibaba', '1688', 'aliexpress', 'weixin', 'other'),
      productName VARCHAR(255),
      productImages JSON,
      categoryId INT,
      notes TEXT,
      purchaseDate TIMESTAMP NULL,
      status ENUM('pending', 'matched', 'received', 'cancelled') NOT NULL DEFAULT 'pending',
      matchedPackageId INT,
      matchedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cdp_tracking (trackingNumber),
      INDEX idx_cdp_customer (customerId),
      INDEX idx_cdp_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerMessages",
    dependencies: ["customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS customerMessages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      direction ENUM('inbound', 'outbound') NOT NULL,
      channel ENUM('sms', 'whatsapp', 'email', 'in_app') NOT NULL,
      subject VARCHAR(255),
      content TEXT NOT NULL,
      status ENUM('pending', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'pending',
      errorMessage TEXT,
      sentById INT,
      sentAt TIMESTAMP,
      readAt TIMESTAMP,
      metadata JSON,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerNotifications",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerNotifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      titleKu VARCHAR(255),
      titleAr VARCHAR(255),
      message TEXT NOT NULL,
      messageKu TEXT,
      messageAr TEXT,
      type ENUM('info', 'success', 'warning', 'error', 'package', 'payment', 'promotion') NOT NULL DEFAULT 'info',
      relatedType ENUM('package', 'batch', 'payment', 'invoice', 'full_package'),
      relatedId INT,
      actionUrl VARCHAR(500),
      actionLabel VARCHAR(100),
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      readAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "customerPushSubscriptions",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      endpoint VARCHAR(500) NOT NULL UNIQUE,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      userAgent VARCHAR(500),
      platform VARCHAR(50),
      language VARCHAR(10),
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      failureCount INT NOT NULL DEFAULT 0,
      lastUsedAt TIMESTAMP NULL,
      lastFailedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX customerPushSubscriptions_customerId_idx (customerId),
      INDEX customerPushSubscriptions_active_idx (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "pushNotificationCampaigns",
    dependencies: ["customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS push_notification_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titleKu VARCHAR(200),
      titleEn VARCHAR(200),
      titleAr VARCHAR(200),
      titleZh VARCHAR(200),
      bodyKu TEXT,
      bodyEn TEXT,
      bodyAr TEXT,
      bodyZh TEXT,
      url VARCHAR(500),
      targetType ENUM('all','customer','batch','segment') NOT NULL,
      targetCustomerId INT,
      targetBatchId INT,
      targetSegment ENUM('active_customers','with_pending_packages','with_unpaid_invoices','vip_customers','inactive_30d'),
      status ENUM('draft','scheduled','sending','completed','failed','cancelled') NOT NULL DEFAULT 'draft',
      scheduledAt TIMESTAMP NULL,
      startedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      totalRecipients INT NOT NULL DEFAULT 0,
      sentCount INT NOT NULL DEFAULT 0,
      failedCount INT NOT NULL DEFAULT 0,
      expiredRemovedCount INT NOT NULL DEFAULT 0,
      createdById INT NOT NULL,
      errorMessage TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX pushCampaigns_status_idx (status),
      INDEX pushCampaigns_scheduled_idx (scheduledAt),
      INDEX pushCampaigns_created_idx (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "supportChats",
    dependencies: ["customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS support_chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      customerName VARCHAR(255),
      customerCode VARCHAR(100),
      subject VARCHAR(255),
      category ENUM('order_status', 'pricing', 'payment', 'general', 'complaint', 'other') NOT NULL DEFAULT 'general',
      priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
      status ENUM('open', 'pending', 'resolved', 'closed') NOT NULL DEFAULT 'open',
      assignedToId INT,
      assignedToName VARCHAR(255),
      lastMessageAt TIMESTAMP,
      resolvedAt TIMESTAMP,
      closedAt TIMESTAMP,
      unreadByCustomer INT NOT NULL DEFAULT 0,
      unreadByStaff INT NOT NULL DEFAULT 0,
      totalMessages INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "chatMessages",
    dependencies: ["supportChats"],
    sql: `CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chatId INT NOT NULL,
      senderType ENUM('customer', 'staff', 'system', 'bot') NOT NULL,
      senderId INT,
      senderName VARCHAR(255),
      content TEXT NOT NULL,
      messageType ENUM('text', 'image', 'file', 'system') NOT NULL DEFAULT 'text',
      attachmentUrl VARCHAR(500),
      attachmentName VARCHAR(255),
      attachmentType VARCHAR(100),
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      readAt TIMESTAMP,
      metadata JSON,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "fullPackageOrders",
    dependencies: ["customers", "suppliers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS fullPackageOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderCode VARCHAR(50) NOT NULL UNIQUE,
      customerId INT NOT NULL,
      supplierId INT,
      productName VARCHAR(500) NOT NULL,
      productNameArabic VARCHAR(500),
      productUrl TEXT,
      productImages JSON,
      productSpecifications JSON,
      quantity INT NOT NULL DEFAULT 1,
      unitCostRmb DECIMAL(10, 2),
      unitCostUsd DECIMAL(10, 2),
      totalProductCostRmb DECIMAL(12, 2),
      totalProductCostUsd DECIMAL(12, 2),
      domesticShippingRmb DECIMAL(10, 2) DEFAULT 0,
      domesticShippingUsd DECIMAL(10, 2) DEFAULT 0,
      internationalShippingUsd DECIMAL(10, 2) DEFAULT 0,
      customsFees DECIMAL(10, 2) DEFAULT 0,
      commissionPercent DECIMAL(5, 2) DEFAULT 0,
      commissionUsd DECIMAL(10, 2) DEFAULT 0,
      totalCostUsd DECIMAL(12, 2) NOT NULL,
      sellingPriceUsd DECIMAL(12, 2) NOT NULL,
      profitUsd DECIMAL(12, 2),
      profitPercent DECIMAL(5, 2),
      exchangeRateRmbToUsd DECIMAL(10, 6),
      paymentStatus ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
      paidAmount DECIMAL(12, 2) DEFAULT 0,
      status ENUM('pending', 'confirmed', 'ordered', 'shipped_domestic', 'received_warehouse', 'shipped_international', 'customs', 'delivered', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
      notes TEXT,
      internalNotes TEXT,
      createdById INT NOT NULL,
      confirmedById INT,
      confirmedAt TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "fullPackageStatusHistory",
    dependencies: ["fullPackageOrders", "users"],
    sql: `CREATE TABLE IF NOT EXISTS fullPackageStatusHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      fromStatus VARCHAR(50),
      toStatus VARCHAR(50) NOT NULL,
      changedById INT NOT NULL,
      reason VARCHAR(255),
      notes TEXT,
      metadata JSON,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "fullPackageOrderTrackings",
    dependencies: ["fullPackageOrders"],
    // NOTE: trackingNumber is intentionally NOT unique here — multiple orders
    // may legitimately share one tracking (the "same carton" scenario from
    // commit 48259fd). Older deployments still have a leftover UNIQUE index
    // from an earlier schema; SCHEMA_PATCHES below drops it idempotently.
    sql: `CREATE TABLE IF NOT EXISTS fullPackageOrderTrackings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fullPackageOrderId INT NOT NULL,
      trackingNumber VARCHAR(100) NOT NULL,
      cartonIndex INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_fpot_order_id (fullPackageOrderId),
      KEY idx_fpot_tracking_number (trackingNumber)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "packageOrderLinks",
    dependencies: ["packages", "fullPackageOrders"],
    // Why: one package ↔ many full-package-orders, and one order ↔ many packages.
    // The legacy packages.fullPackageOrderId remains as a fast lookup for the
    // "primary" link; this table captures every other linkage exactly once.
    // The single-customer business rule is enforced in app code, not DB.
    sql: `CREATE TABLE IF NOT EXISTS packageOrderLinks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageId INT NOT NULL,
      fullPackageOrderId INT NOT NULL,
      cartonIndex INT NOT NULL DEFAULT 1,
      isPrimary BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_pol_pkg_order (packageId, fullPackageOrderId),
      KEY idx_pol_package_id (packageId),
      KEY idx_pol_order_id (fullPackageOrderId),
      CONSTRAINT fk_pol_package FOREIGN KEY (packageId) REFERENCES packages(id) ON DELETE CASCADE,
      CONSTRAINT fk_pol_order FOREIGN KEY (fullPackageOrderId) REFERENCES fullPackageOrders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "batchPricingTiers",
    dependencies: ["batches"],
    sql: `CREATE TABLE IF NOT EXISTS batchPricingTiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batchId INT NOT NULL,
      minWeight DECIMAL(10, 2) NOT NULL,
      maxWeight DECIMAL(10, 2),
      pricePerKg DECIMAL(10, 2) NOT NULL,
      pricePerCbm DECIMAL(10, 2),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "batchCustomerPricing",
    dependencies: ["batches", "customers"],
    sql: `CREATE TABLE IF NOT EXISTS batchCustomerPricing (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batchId INT NOT NULL,
      customerId INT NOT NULL,
      pricePerKg DECIMAL(10, 2),
      pricePerCbm DECIMAL(10, 2),
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY batch_customer_unique (batchId, customerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "expenses",
    dependencies: ["expenseCategories", "cashAccounts", "users"],
    sql: `CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      expenseNumber VARCHAR(50) NOT NULL UNIQUE,
      categoryId INT,
      description TEXT NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      amountUsd DECIMAL(12, 2) NOT NULL,
      expenseDate TIMESTAMP NOT NULL,
      paymentMethod ENUM('cash', 'bank_transfer', 'card', 'other') NOT NULL DEFAULT 'cash',
      cashAccountId INT,
      receiptUrl TEXT,
      vendor VARCHAR(255),
      isRecurring BOOLEAN NOT NULL DEFAULT FALSE,
      recurringPeriod ENUM('daily', 'weekly', 'monthly', 'yearly'),
      referenceNumber VARCHAR(100),
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "partnerTransactions",
    dependencies: ["partners", "cashAccounts", "users"],
    sql: `CREATE TABLE IF NOT EXISTS partnerTransactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      partnerId INT NOT NULL,
      transactionType ENUM('capital_contribution', 'profit_share', 'withdrawal', 'loan_to_company', 'loan_repayment', 'adjustment') NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      amountUsd DECIMAL(14, 2) NOT NULL,
      balanceBefore DECIMAL(14, 2) NOT NULL,
      balanceAfter DECIMAL(14, 2) NOT NULL,
      description TEXT,
      transactionDate TIMESTAMP NOT NULL,
      periodMonth INT,
      periodYear INT,
      cashAccountId INT,
      referenceNumber VARCHAR(100),
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "debtPayments",
    dependencies: ["companyDebts", "cashAccounts", "users"],
    sql: `CREATE TABLE IF NOT EXISTS debtPayments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      debtId INT NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      amountUsd DECIMAL(14, 2) NOT NULL,
      principalPaid DECIMAL(14, 2) NOT NULL,
      interestPaid DECIMAL(14, 2) DEFAULT 0,
      paymentDate TIMESTAMP NOT NULL,
      paymentMethod ENUM('cash', 'bank_transfer', 'card', 'other') NOT NULL DEFAULT 'cash',
      cashAccountId INT,
      remainingAfter DECIMAL(14, 2),
      referenceNumber VARCHAR(100),
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "cashTransactions",
    dependencies: ["cashAccounts", "users"],
    sql: `CREATE TABLE IF NOT EXISTS cashTransactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      transactionType ENUM('deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'customer_payment', 'expense', 'debt_payment', 'partner_deposit', 'partner_withdrawal', 'adjustment') NOT NULL,
      amount DECIMAL(14, 2) NOT NULL,
      balanceBefore DECIMAL(14, 2) NOT NULL,
      balanceAfter DECIMAL(14, 2) NOT NULL,
      relatedAccountId INT,
      relatedEntityType VARCHAR(50),
      relatedEntityId INT,
      description TEXT,
      transactionDate TIMESTAMP NOT NULL,
      referenceNumber VARCHAR(100),
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "financialPeriods",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS financialPeriods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      periodType ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
      year INT NOT NULL,
      month INT,
      quarter INT,
      startDate TIMESTAMP NOT NULL,
      endDate TIMESTAMP NOT NULL,
      totalRevenue DECIMAL(14, 2) DEFAULT 0,
      packageRevenue DECIMAL(14, 2) DEFAULT 0,
      fullPackageRevenue DECIMAL(14, 2) DEFAULT 0,
      commissionRevenue DECIMAL(14, 2) DEFAULT 0,
      otherRevenue DECIMAL(14, 2) DEFAULT 0,
      totalExpenses DECIMAL(14, 2) DEFAULT 0,
      operatingExpenses DECIMAL(14, 2) DEFAULT 0,
      shippingCosts DECIMAL(14, 2) DEFAULT 0,
      salaries DECIMAL(14, 2) DEFAULT 0,
      otherExpenses DECIMAL(14, 2) DEFAULT 0,
      grossProfit DECIMAL(14, 2) DEFAULT 0,
      netProfit DECIMAL(14, 2) DEFAULT 0,
      profitMargin DECIMAL(5, 2) DEFAULT 0,
      totalPackagesShipped INT DEFAULT 0,
      totalCustomersServed INT DEFAULT 0,
      newCustomers INT DEFAULT 0,
      status ENUM('open', 'closed', 'locked') NOT NULL DEFAULT 'open',
      closedById INT,
      closedAt TIMESTAMP,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockPurchases",
    dependencies: ["suppliers", "warehouses", "users"],
    sql: `CREATE TABLE IF NOT EXISTS stockPurchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchaseCode VARCHAR(50) NOT NULL UNIQUE,
      supplierId INT,
      supplierName VARCHAR(255),
      warehouseId INT,
      status ENUM('draft', 'ordered', 'shipped', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
      orderDate TIMESTAMP,
      expectedDate TIMESTAMP,
      receivedDate TIMESTAMP,
      subtotal DECIMAL(12, 2) DEFAULT 0,
      shippingCost DECIMAL(10, 2) DEFAULT 0,
      otherCosts DECIMAL(10, 2) DEFAULT 0,
      discount DECIMAL(10, 2) DEFAULT 0,
      totalCost DECIMAL(12, 2) DEFAULT 0,
      currency VARCHAR(3) DEFAULT 'USD',
      exchangeRate DECIMAL(10, 4) DEFAULT 1,
      paymentStatus ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
      paidAmount DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      internalNotes TEXT,
      createdById INT,
      receivedById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockPurchaseItems",
    dependencies: ["stockPurchases", "stockProducts"],
    sql: `CREATE TABLE IF NOT EXISTS stockPurchaseItems (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchaseId INT NOT NULL,
      productId INT NOT NULL,
      orderedQuantity INT NOT NULL,
      receivedQuantity INT DEFAULT 0,
      unitCost DECIMAL(10, 2) NOT NULL,
      totalCost DECIMAL(12, 2) NOT NULL,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockSales",
    dependencies: ["customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS stockSales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      saleCode VARCHAR(50) NOT NULL UNIQUE,
      customerId INT,
      customerName VARCHAR(255),
      status ENUM('draft', 'confirmed', 'delivered', 'cancelled') NOT NULL DEFAULT 'draft',
      saleDate TIMESTAMP,
      deliveryDate TIMESTAMP,
      subtotal DECIMAL(12, 2) DEFAULT 0,
      discount DECIMAL(10, 2) DEFAULT 0,
      tax DECIMAL(10, 2) DEFAULT 0,
      totalAmount DECIMAL(12, 2) DEFAULT 0,
      currency VARCHAR(3) DEFAULT 'USD',
      paymentStatus ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
      paidAmount DECIMAL(12, 2) DEFAULT 0,
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockSaleItems",
    dependencies: ["stockSales", "stockProducts"],
    sql: `CREATE TABLE IF NOT EXISTS stockSaleItems (
      id INT AUTO_INCREMENT PRIMARY KEY,
      saleId INT NOT NULL,
      productId INT NOT NULL,
      quantity INT NOT NULL,
      unitPrice DECIMAL(10, 2) NOT NULL,
      discount DECIMAL(10, 2) DEFAULT 0,
      totalPrice DECIMAL(12, 2) NOT NULL,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "stockMovements",
    dependencies: ["stockProducts", "warehouses", "users"],
    sql: `CREATE TABLE IF NOT EXISTS stockMovements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT NOT NULL,
      movementType ENUM('purchase', 'sale', 'adjustment', 'transfer', 'return', 'damage') NOT NULL,
      quantity INT NOT NULL,
      quantityBefore INT NOT NULL,
      quantityAfter INT NOT NULL,
      unitCost DECIMAL(10, 2),
      totalValue DECIMAL(12, 2),
      warehouseId INT,
      referenceType VARCHAR(50),
      referenceId INT,
      reason TEXT,
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // ============ LEVEL 4: PACKAGES AND RELATED ============

  {
    name: "packages",
    dependencies: ["customers", "warehouses", "batches", "fullPackageOrders", "productCategories", "pricingRules", "users"],
    sql: `CREATE TABLE IF NOT EXISTS packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageCode VARCHAR(50) NOT NULL UNIQUE,
      trackingNumber VARCHAR(100) UNIQUE,
      customerId INT,
      originWarehouseId INT NOT NULL,
      batchId INT,
      fullPackageOrderId INT,
      packageOwnership ENUM('customer', 'company') NOT NULL DEFAULT 'customer',
      categoryId INT,
      isUnclaimed BOOLEAN NOT NULL DEFAULT FALSE,
      claimedAt TIMESTAMP,
      claimedById INT,
      qrCodeData TEXT,
      qrCodeSignature VARCHAR(255),
      weightKg DECIMAL(10, 3),
      lengthCm DECIMAL(10, 2),
      widthCm DECIMAL(10, 2),
      heightCm DECIMAL(10, 2),
      volumeCbm DECIMAL(10, 6),
      shippingType ENUM('air_regular', 'air_irregular', 'sea') NOT NULL,
      description TEXT,
      photos JSON,
      calculatedCostUsd DECIMAL(10, 2),
      appliedPricingRuleId INT,
      isCharged BOOLEAN NOT NULL DEFAULT FALSE,
      deliveryType ENUM('air_transit', 'warehouse_pickup', 'direct_delivery'),
      status ENUM('registered', 'in_batch', 'in_transit', 'customs_processing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'returned', 'cancelled') NOT NULL DEFAULT 'registered',
      registeredAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      registeredById INT NOT NULL,
      deliveredAt TIMESTAMP,
      deliveredById INT,
      recipientName VARCHAR(255),
      recipientSignature TEXT,
      deliveryPhoto TEXT,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "invoices",
    dependencies: ["customers", "packages", "batches", "users"],
    sql: `CREATE TABLE IF NOT EXISTS invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoiceNumber VARCHAR(50) NOT NULL UNIQUE,
      customerId INT NOT NULL,
      packageId INT,
      batchId INT,
      subtotalUsd DECIMAL(12, 2) NOT NULL,
      taxUsd DECIMAL(12, 2) DEFAULT 0,
      totalUsd DECIMAL(12, 2) NOT NULL,
      exchangeRateIqd DECIMAL(12, 2),
      exchangeRateRmb DECIMAL(12, 6),
      totalIqd DECIMAL(15, 0),
      totalRmb DECIMAL(12, 2),
      status ENUM('draft', 'issued', 'paid', 'partially_paid', 'cancelled', 'refunded') NOT NULL DEFAULT 'draft',
      issuedAt TIMESTAMP,
      dueDate TIMESTAMP,
      paidAt TIMESTAMP,
      pdfUrl TEXT,
      lineItems JSON,
      notes TEXT,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "packageQrCodes",
    dependencies: ["packages", "users"],
    sql: `CREATE TABLE IF NOT EXISTS packageQrCodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageId INT NOT NULL,
      packageType ENUM('regular', 'full_package') NOT NULL DEFAULT 'regular',
      qrCode VARCHAR(100) NOT NULL UNIQUE,
      qrImageUrl TEXT,
      lastScannedAt TIMESTAMP,
      lastScannedById INT,
      scanCount INT DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "packageScans",
    dependencies: ["packages", "users", "warehouses", "scanDevices"],
    sql: `CREATE TABLE IF NOT EXISTS packageScans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageId INT,
      trackingNumber VARCHAR(100) NOT NULL,
      scanType ENUM('registered', 'received_china', 'in_batch', 'in_transit', 'received_local', 'out_for_delivery', 'delivered', 'returned', 'customs_hold') NOT NULL,
      scannedById INT NOT NULL,
      warehouseId INT,
      latitude DECIMAL(10, 7),
      longitude DECIMAL(10, 7),
      locationName VARCHAR(255),
      notes TEXT,
      photoUrl VARCHAR(500),
      deviceId INT,
      deviceInfo JSON,
      scannedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "packageStatusHistory",
    dependencies: ["packages", "users", "packageScans"],
    sql: `CREATE TABLE IF NOT EXISTS packageStatusHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageId INT NOT NULL,
      fromStatus VARCHAR(50),
      toStatus VARCHAR(50) NOT NULL,
      changedById INT NOT NULL,
      changeMethod ENUM('scan', 'manual', 'system', 'api') NOT NULL DEFAULT 'manual',
      scanId INT,
      reason VARCHAR(255),
      notes TEXT,
      metadata JSON,
      changedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    // When a shipment moved from one stage to the next, and who moved it.
    //
    // A batch carries three timestamps of its own — created, departed,
    // arrived — so the customer's journey stepper could show a date for the
    // first three steps and never for customs, the Erbil depot or delivery.
    // A shipment that had reached the customer showed six green steps and one
    // date, the oldest of them.
    //
    // A history rather than three more columns: a status corrected back and
    // forth leaves both moves on the record, and it says who made each change.
    // Parcels already work exactly this way in packageStatusHistory.
    //
    // Holds nothing financial, on purpose. State and time, nothing else.
    name: "batchStatusHistory",
    dependencies: ["batches", "users"],
    sql: `CREATE TABLE IF NOT EXISTS batchStatusHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batchId INT NOT NULL,
      fromStatus VARCHAR(50),
      toStatus VARCHAR(50) NOT NULL,
      changedById INT,
      changedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bsh_batch_id (batchId),
      INDEX idx_bsh_changed_at (changedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "packageClaimRequests",
    dependencies: ["packages", "customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS packageClaimRequests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageId INT NOT NULL,
      requestedById INT NOT NULL,
      requestedCustomerId INT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      notes TEXT,
      processedById INT,
      processedAt TIMESTAMP,
      rejectionReason TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "extraServices",
    dependencies: ["packages", "serviceTypes"],
    sql: `CREATE TABLE IF NOT EXISTS extraServices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packageId INT NOT NULL,
      serviceTypeId INT,
      serviceName VARCHAR(100) NOT NULL,
      description TEXT,
      priceUsd DECIMAL(10, 2) NOT NULL,
      quantity INT DEFAULT 1,
      totalUsd DECIMAL(10, 2) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // ============ LEVEL 5: FINANCIAL TRANSACTIONS ============

  {
    name: "ledgerTransactions",
    dependencies: ["customerAccounts", "packages", "fullPackageOrders", "invoices", "users"],
    sql: `CREATE TABLE IF NOT EXISTS ledgerTransactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      transactionNumber VARCHAR(50) NOT NULL UNIQUE,
      transactionType ENUM('package_charge', 'full_package_charge', 'purchase_request_charge', 'commission_charge', 'payment', 'refund', 'credit_adjustment', 'debit_adjustment', 'transfer', 'opening_balance') NOT NULL,
      description TEXT,
      debitUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      creditUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      balanceAfterUsd DECIMAL(12, 2) NOT NULL,
      debitIqd DECIMAL(15, 0) NOT NULL DEFAULT 0,
      creditIqd DECIMAL(15, 0) NOT NULL DEFAULT 0,
      balanceAfterIqd DECIMAL(15, 0) NOT NULL,
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      exchangeRate DECIMAL(12, 2),
      relatedPackageId INT,
      relatedFullPackageId INT,
      relatedInvoiceId INT,
      relatedPaymentId INT,
      referenceNumber VARCHAR(100),
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_account (accountId),
      INDEX idx_type (transactionType),
      INDEX idx_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "paymentRecords",
    dependencies: ["customerAccounts", "ledgerTransactions", "users"],
    sql: `CREATE TABLE IF NOT EXISTS paymentRecords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      transactionId INT,
      paymentNumber VARCHAR(50) NOT NULL UNIQUE,
      amountUsd DECIMAL(12, 2) NOT NULL DEFAULT 0,
      amountIqd DECIMAL(15, 0) NOT NULL DEFAULT 0,
      exchangeRate DECIMAL(12, 2),
      paymentMethod ENUM('cash', 'bank_transfer', 'mobile_money', 'card', 'check', 'other') NOT NULL DEFAULT 'cash',
      paymentStatus ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
      paymentCurrency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      bankName VARCHAR(100),
      bankAccountNumber VARCHAR(50),
      receiptNumber VARCHAR(100),
      bankReference VARCHAR(100),
      referenceNumber VARCHAR(100),
      receiptUrl TEXT,
      receiptPhoto TEXT,
      notes TEXT,
      receivedById INT NOT NULL,
      confirmedById INT,
      cancelledById INT,
      cancelReason TEXT,
      receivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmedAt TIMESTAMP,
      cancelledAt TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "creditAdjustments",
    dependencies: ["customerAccounts", "ledgerTransactions", "users"],
    sql: `CREATE TABLE IF NOT EXISTS creditAdjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      transactionId INT,
      adjustmentNumber VARCHAR(50) NOT NULL UNIQUE,
      adjustmentType ENUM('credit', 'debit') NOT NULL,
      amountUsd DECIMAL(12, 2) NOT NULL,
      reason TEXT NOT NULL,
      approvedById INT,
      approvedAt TIMESTAMP,
      createdById INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "paymentReminders",
    dependencies: ["customerAccounts", "customers", "users"],
    sql: `CREATE TABLE IF NOT EXISTS paymentReminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId INT NOT NULL,
      customerId INT NOT NULL,
      reminderType ENUM('first', 'second', 'final', 'overdue') NOT NULL,
      amountDueUsd DECIMAL(12, 2) NOT NULL,
      dueDate TIMESTAMP,
      sentAt TIMESTAMP,
      sentVia ENUM('email', 'sms', 'whatsapp', 'in_app') NOT NULL,
      status ENUM('pending', 'sent', 'failed', 'acknowledged') NOT NULL DEFAULT 'pending',
      acknowledgedAt TIMESTAMP,
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "revenueRecords",
    dependencies: ["customers", "packages", "fullPackageOrders", "batches", "users"],
    sql: `CREATE TABLE IF NOT EXISTS revenueRecords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      revenueNumber VARCHAR(50) NOT NULL UNIQUE,
      revenueType ENUM('package_shipping', 'full_package_profit', 'commission', 'extra_service', 'other') NOT NULL,
      customerId INT,
      packageId INT,
      fullPackageOrderId INT,
      batchId INT,
      description TEXT,
      grossAmountUsd DECIMAL(12, 2) NOT NULL,
      costAmountUsd DECIMAL(12, 2) DEFAULT 0,
      netAmountUsd DECIMAL(12, 2) NOT NULL,
      currency ENUM('USD', 'IQD') NOT NULL DEFAULT 'USD',
      exchangeRate DECIMAL(12, 2),
      revenueDate TIMESTAMP NOT NULL,
      notes TEXT,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "dailyFinancialSummary",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS dailyFinancialSummary (
      id INT AUTO_INCREMENT PRIMARY KEY,
      summaryDate DATE NOT NULL UNIQUE,
      totalRevenueUsd DECIMAL(14, 2) DEFAULT 0,
      packageRevenueUsd DECIMAL(14, 2) DEFAULT 0,
      fullPackageRevenueUsd DECIMAL(14, 2) DEFAULT 0,
      commissionRevenueUsd DECIMAL(14, 2) DEFAULT 0,
      otherRevenueUsd DECIMAL(14, 2) DEFAULT 0,
      totalExpensesUsd DECIMAL(14, 2) DEFAULT 0,
      totalPaymentsReceivedUsd DECIMAL(14, 2) DEFAULT 0,
      totalPaymentsReceivedIqd DECIMAL(15, 0) DEFAULT 0,
      packagesRegistered INT DEFAULT 0,
      packagesDelivered INT DEFAULT 0,
      newCustomers INT DEFAULT 0,
      activeCustomers INT DEFAULT 0,
      netProfitUsd DECIMAL(14, 2) DEFAULT 0,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // ============ LEVEL 6: LOGS AND HISTORY ============

  {
    name: "auditLogs",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS auditLogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      userName VARCHAR(255),
      userRole VARCHAR(20),
      action VARCHAR(100) NOT NULL,
      actionLabel VARCHAR(255),
      category ENUM('customer', 'package', 'batch', 'full_package', 'purchase_request', 'commission', 'finance', 'settings', 'user', 'system') NOT NULL DEFAULT 'system',
      entityType VARCHAR(50) NOT NULL,
      entityId INT,
      entityCode VARCHAR(100),
      oldValues JSON,
      newValues JSON,
      changedFields JSON,
      description TEXT,
      metadata JSON,
      ipAddress VARCHAR(45),
      userAgent TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_category (category),
      INDEX idx_audit_entity_type (entityType),
      INDEX idx_audit_user (userId),
      INDEX idx_audit_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "notificationLogs",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS notificationLogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT,
      channel ENUM('email', 'whatsapp', 'sms') NOT NULL,
      eventType VARCHAR(100) NOT NULL,
      recipient VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      content TEXT,
      status ENUM('pending', 'sent', 'failed', 'delivered') NOT NULL DEFAULT 'pending',
      errorMessage TEXT,
      sentAt TIMESTAMP,
      deliveredAt TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "scheduledTasksLog",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS scheduledTasksLog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      taskName VARCHAR(100) NOT NULL,
      taskType VARCHAR(50) NOT NULL,
      startedAt TIMESTAMP NOT NULL,
      completedAt TIMESTAMP,
      status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
      itemsProcessed INT DEFAULT 0,
      itemsSucceeded INT DEFAULT 0,
      itemsFailed INT DEFAULT 0,
      errorMessage TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "scanHistory",
    dependencies: ["users", "warehouses"],
    sql: `CREATE TABLE IF NOT EXISTS scanHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trackingNumber VARCHAR(100) NOT NULL,
      scanResult ENUM('success', 'not_found', 'already_scanned', 'error') NOT NULL,
      packageId INT,
      scannedById INT NOT NULL,
      warehouseId INT,
      scanType VARCHAR(50),
      errorMessage TEXT,
      deviceInfo JSON,
      scannedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "deletionLogs",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS deletionLogs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entityType VARCHAR(50) NOT NULL,
      entityId INT NOT NULL,
      entityCode VARCHAR(100),
      entityData JSON,
      reason TEXT,
      deletedById INT NOT NULL,
      deletedByName VARCHAR(255),
      deletedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    // The recycle bin. Holds a complete copy of a deleted row so it can be
    // put back, keyed by what it was rather than by a foreign key — the row
    // it came from is gone, which is the point.
    //
    // A new table rather than reusing deletionLogs: that one's migration SQL
    // and its drizzle schema have drifted into two different shapes, and
    // building recovery on top of a table nobody can describe would be a bad
    // trade for saving one CREATE.
    name: "deletedRecords",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS deletedRecords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entityType VARCHAR(50) NOT NULL,
      entityId INT NOT NULL,
      label VARCHAR(255) NOT NULL,
      snapshot JSON NOT NULL,
      deletedById INT NOT NULL,
      deletedByName VARCHAR(255),
      deletionReason TEXT,
      deletedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_deleted_records_deleted_at (deletedAt),
      INDEX idx_deleted_records_entity (entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "activityAlerts",
    dependencies: ["users", "auditLogs"],
    sql: `CREATE TABLE IF NOT EXISTS activity_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      category ENUM('customer', 'package', 'batch', 'full_package', 'purchase_request', 'commission', 'finance', 'settings', 'user', 'system', 'security') NOT NULL,
      severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
      entityType VARCHAR(100),
      entityId INT,
      entityCode VARCHAR(100),
      auditLogId INT,
      action VARCHAR(100) NOT NULL,
      triggeredById INT,
      triggeredByName VARCHAR(255),
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      readAt TIMESTAMP,
      readById INT,
      notificationSent BOOLEAN NOT NULL DEFAULT FALSE,
      notificationSentAt TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "backups",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS backups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      fileKey VARCHAR(500) NOT NULL,
      fileUrl VARCHAR(500) NOT NULL,
      fileSize BIGINT,
      backupType ENUM('manual', 'scheduled') NOT NULL DEFAULT 'manual',
      backupContent ENUM('database_only', 'files_only', 'full') NOT NULL DEFAULT 'database_only',
      schedule ENUM('daily', 'weekly', 'monthly'),
      status ENUM('in_progress', 'completed', 'failed') NOT NULL DEFAULT 'in_progress',
      filesZipUrl VARCHAR(500),
      filesZipSize BIGINT,
      filesCount INT,
      errorMessage TEXT,
      databaseName VARCHAR(100),
      tablesCount INT,
      recordsCount INT,
      createdById INT,
      createdByName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMP,
      expiresAt TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "portalTutorials",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS portalTutorials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      language VARCHAR(10) NOT NULL DEFAULT 'ku',
      titleKu VARCHAR(300) NOT NULL,
      titleEn VARCHAR(300),
      titleAr VARCHAR(300),
      summaryKu TEXT,
      summaryEn TEXT,
      summaryAr TEXT,
      videoUrl VARCHAR(500) NOT NULL,
      durationSeconds INT,
      sortOrder INT NOT NULL DEFAULT 0,
      isPublished BOOLEAN NOT NULL DEFAULT FALSE,
      isFeatured BOOLEAN NOT NULL DEFAULT FALSE,
      viewCount INT NOT NULL DEFAULT 0,
      completedCount INT NOT NULL DEFAULT 0,
      helpfulCount INT NOT NULL DEFAULT 0,
      notHelpfulCount INT NOT NULL DEFAULT 0,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_portal_tutorials_category (category),
      INDEX idx_portal_tutorials_published (isPublished, sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  {
    name: "blogPosts",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS blogPosts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      titleKu VARCHAR(500),
      titleAr VARCHAR(500),
      excerpt TEXT,
      excerptKu TEXT,
      excerptAr TEXT,
      content TEXT NOT NULL,
      contentKu TEXT,
      contentAr TEXT,
      featuredImage VARCHAR(500),
      category VARCHAR(100),
      tags JSON,
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      publishedAt TIMESTAMP,
      viewCount INT DEFAULT 0,
      authorId INT,
      authorName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // Wazn Store — public storefront products
  {
    name: "storeProducts",
    dependencies: ["users"],
    sql: `CREATE TABLE IF NOT EXISTS storeProducts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nameEn VARCHAR(300) NOT NULL,
      nameKu VARCHAR(300),
      nameAr VARCHAR(300),
      descriptionEn TEXT,
      descriptionKu TEXT,
      descriptionAr TEXT,
      price DECIMAL(10,2) NOT NULL,
      compareAtPrice DECIMAL(10,2),
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      coverImageUrl VARCHAR(500),
      images JSON,
      category VARCHAR(100),
      status ENUM('active', 'hidden', 'out_of_stock') NOT NULL DEFAULT 'active',
      stock INT,
      slug VARCHAR(255) UNIQUE,
      isFeatured BOOLEAN NOT NULL DEFAULT false,
      sortOrder INT NOT NULL DEFAULT 0,
      viewCount INT NOT NULL DEFAULT 0,
      orderCount INT NOT NULL DEFAULT 0,
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX storeProducts_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // Wazn Store — public orders (guest checkout, saved + sent to WhatsApp)
  {
    name: "storeOrders",
    dependencies: ["storeProducts"],
    sql: `CREATE TABLE IF NOT EXISTS storeOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderCode VARCHAR(50) NOT NULL UNIQUE,
      productId INT,
      productName VARCHAR(300) NOT NULL,
      productImageUrl VARCHAR(500),
      unitPrice DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      totalPrice DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      customerName VARCHAR(200) NOT NULL,
      customerPhone VARCHAR(50) NOT NULL,
      customerCity VARCHAR(100),
      customerAddress TEXT,
      note TEXT,
      status ENUM('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'new',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX storeOrders_status_idx (status),
      INDEX storeOrders_product_idx (productId),
      INDEX storeOrders_created_idx (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // Prohibited packages — items that arrived at China warehouse but can't ship
  {
    name: "prohibitedPackages",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS prohibitedPackages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      trackingNumber VARCHAR(100) NOT NULL,
      photos JSON,
      reasonId VARCHAR(120),
      reasonNote TEXT,
      resolutionChoice ENUM('return', 'reship', 'destroy'),
      reshipAddress TEXT,
      resolutionChosenAt TIMESTAMP NULL,
      viewedByCustomerAt TIMESTAMP NULL,
      feeUsd DECIMAL(10,2),
      chargedAt TIMESTAMP NULL,
      ledgerTransactionId INT,
      status ENUM('pending', 'chosen', 'resolved', 'cancelled') NOT NULL DEFAULT 'pending',
      createdById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX prohibitedPackages_customer_idx (customerId),
      INDEX prohibitedPackages_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  // Product Attributes: colors, sizes, product types managed from settings
  {
    name: "productAttributes",
    dependencies: [],
    sql: `CREATE TABLE IF NOT EXISTS productAttributes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('color', 'size', 'productType') NOT NULL,
      value VARCHAR(200) NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT true,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  // Customer Portal Center: durable log of what each customer does in the
  // portal (observability only — no business logic depends on it).
  {
    name: "customerActivityLog",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerActivityLog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      action VARCHAR(60) NOT NULL,
      category ENUM('auth', 'navigation', 'declaration', 'claim', 'message', 'search', 'profile', 'other') NOT NULL DEFAULT 'other',
      entityType VARCHAR(50),
      entityId INT,
      path VARCHAR(255),
      detail VARCHAR(500),
      metadata JSON,
      ipAddress VARCHAR(64),
      userAgent VARCHAR(400),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cal_customer (customerId),
      INDEX idx_cal_action (action),
      INDEX idx_cal_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  // Portal Center: internal staff-only notes about a customer.
  {
    name: "customerAdminNotes",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS customerAdminNotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      note VARCHAR(2000) NOT NULL,
      createdById INT NOT NULL,
      createdByName VARCHAR(255),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_can_customer (customerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  // Portal: customer 1-5 star rating per delivered package.
  {
    name: "deliveryRatings",
    dependencies: ["customers", "packages"],
    sql: `CREATE TABLE IF NOT EXISTS deliveryRatings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      packageId INT NOT NULL UNIQUE,
      rating INT NOT NULL,
      comment VARCHAR(1000),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dr_customer (customerId),
      INDEX idx_dr_rating (rating)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },

  // Portal: customer requests to buy Chinese Yuan (CNY) with USD at the
  // company's sell rate; managed by staff from the Portal Center.
  {
    name: "yuanExchangeOrders",
    dependencies: ["customers"],
    sql: `CREATE TABLE IF NOT EXISTS yuanExchangeOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      usdAmount DECIMAL(12,2) NOT NULL,
      cnyAmount DECIMAL(12,2) NOT NULL,
      rate DECIMAL(10,4) NOT NULL,
      status ENUM('pending', 'processing', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
      customerNote VARCHAR(1000),
      adminNote VARCHAR(1000),
      handledById INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_yeo_customer (customerId),
      INDEX idx_yeo_status (status),
      INDEX idx_yeo_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  }
];

// ============ MIGRATION FUNCTIONS ============

/**
 * Run all migrations
 */
export async function runMigrations(config: MigrationConfig): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: true,
    tablesCreated: [],
    tablesSkipped: [],
    errors: [],
    duration: 0
  };

  const log = config.logger || ((msg: string, level?: string) => {
    if (level === 'error') appLogger.error(msg);
    else if (level === 'warn') appLogger.warn(msg);
    else appLogger.info(msg);
  });

  log(`Starting migration for ${TABLE_DEFINITIONS.length} tables...`, 'info');

  for (const table of TABLE_DEFINITIONS) {
    try {
      if (config.dryRun) {
        log(`[DRY RUN] Would create table: ${table.name}`, 'info');
        result.tablesCreated.push(table.name);
        continue;
      }

      // Check if table exists
      const [rows] = await config.connection.execute(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
        [table.name]
      ) as unknown as [Array<{ count: number }>];

      if (rows[0].count > 0) {
        log(`Table ${table.name} already exists, skipping`, 'info');
        result.tablesSkipped.push(table.name);
        continue;
      }

      // Create table
      await config.connection.execute(table.sql);
      log(`Created table: ${table.name}`, 'success');
      result.tablesCreated.push(table.name);

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`Failed to create table ${table.name}: ${errorMsg}`, 'error');
      result.errors.push({ table: table.name, error: errorMsg });
      result.success = false;
    }
  }

  result.duration = Date.now() - startTime;

  log(`\nMigration completed in ${result.duration}ms`, 'info');
  log(`Tables created: ${result.tablesCreated.length}`, 'success');
  log(`Tables skipped: ${result.tablesSkipped.length}`, 'info');
  if (result.errors.length > 0) {
    log(`Errors: ${result.errors.length}`, 'error');
  }

  return result;
}

/**
 * Get migration status
 */
export async function getMigrationStatus(connection: Connection): Promise<{
  totalTables: number;
  existingTables: string[];
  missingTables: string[];
}> {
  const [rows] = await connection.execute(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
  ) as unknown as [Array<{ table_name?: string; TABLE_NAME?: string }>];

  const existingTables = rows.map((r) => r.table_name ?? r.TABLE_NAME ?? "");
  const allTableNames = TABLE_DEFINITIONS.map(t => t.name);
  const missingTables = allTableNames.filter(t => !existingTables.includes(t));

  return {
    totalTables: TABLE_DEFINITIONS.length,
    existingTables,
    missingTables
  };
}

// ============ SCHEMA PATCHES (ALTER existing tables - e.g. serviceTypes had old columns only) ============
export const SCHEMA_PATCHES: { name: string; sql: string }[] = [
  { name: "serviceTypes.sortOrder", sql: "ALTER TABLE serviceTypes ADD COLUMN sortOrder INT NOT NULL DEFAULT 0" },
  { name: "serviceTypes.icon", sql: "ALTER TABLE serviceTypes ADD COLUMN icon VARCHAR(50)" },
  { name: "serviceTypes.color", sql: "ALTER TABLE serviceTypes ADD COLUMN color VARCHAR(20)" },
  { name: "serviceTypes.defaultCost", sql: "ALTER TABLE serviceTypes ADD COLUMN defaultCost DECIMAL(10,2)" },
  { name: "serviceTypes.defaultPrice", sql: "ALTER TABLE serviceTypes ADD COLUMN defaultPrice DECIMAL(10,2)" },
  { name: "serviceTypes.requiresCustomer", sql: "ALTER TABLE serviceTypes ADD COLUMN requiresCustomer BOOLEAN NOT NULL DEFAULT TRUE" },
  { name: "serviceTypes.addToCustomerBalance", sql: "ALTER TABLE serviceTypes ADD COLUMN addToCustomerBalance BOOLEAN NOT NULL DEFAULT TRUE" },
  { name: "serviceTypes.createdById", sql: "ALTER TABLE serviceTypes ADD COLUMN createdById INT" },
  { name: "fullPackageOrders.productType", sql: "ALTER TABLE fullPackageOrders ADD COLUMN productType VARCHAR(200)" },
  { name: "customers.serviceTypes", sql: "ALTER TABLE customers ADD COLUMN serviceTypes JSON" },
  { name: "chatMessages.messageType.voice", sql: "ALTER TABLE chatMessages MODIFY COLUMN messageType ENUM('text','image','file','system','voice') NOT NULL DEFAULT 'text'" },
  { name: "deliveryBoxes.batchId", sql: "ALTER TABLE deliveryBoxes ADD COLUMN batchId INT" },
  { name: "fullPackageOrders.advancePaidUsd", sql: "ALTER TABLE fullPackageOrders ADD COLUMN advancePaidUsd DECIMAL(10,2) NOT NULL DEFAULT 0" },
  { name: "fullPackageOrders.advancePaidAt", sql: "ALTER TABLE fullPackageOrders ADD COLUMN advancePaidAt TIMESTAMP NULL" },
  { name: "fullPackageOrders.advancePaymentMethod", sql: "ALTER TABLE fullPackageOrders ADD COLUMN advancePaymentMethod ENUM('CASH','BANK_TRANSFER','FIB','FASTPAY','ZAINCASH','ASIAHAWALA','CARD','OTHER') NULL" },
  // Platforms are user-extendable (admins add their own from the order form),
  // so they live as productAttributes rows rather than a hard-coded enum, and
  // the order's platform column widens to free text to hold any of them.
  { name: "productAttributes.type.platform", sql: "ALTER TABLE productAttributes MODIFY COLUMN type ENUM('color','size','productType','platform') NOT NULL" },
  { name: "fullPackageOrders.platform", sql: "ALTER TABLE fullPackageOrders ADD COLUMN platform VARCHAR(100) NULL" },
  // Images are stored as base64 data URIs. A compressed photo runs past TEXT's
  // 64KB ceiling, so MySQL rejected the whole write with "Data too long" and
  // adding a picture to an order simply never saved.
  { name: "fullPackageOrders.productImage.mediumtext", sql: "ALTER TABLE fullPackageOrders MODIFY COLUMN productImage MEDIUMTEXT" },
  // One platform list for the whole system: the customer portal's pre-declare
  // form now picks from the same productAttributes rows the order forms use,
  // so a shop the admin adds is available everywhere instead of only on orders.
  { name: "customerDeclaredPackages.platform.varchar", sql: "ALTER TABLE customerDeclaredPackages MODIFY COLUMN platform VARCHAR(100) NULL" },
  { name: "fullPackageOrders.advancePaymentTransactionId", sql: "ALTER TABLE fullPackageOrders ADD COLUMN advancePaymentTransactionId INT NULL" },
  { name: "paymentRecords.reversedAmountUsd", sql: "ALTER TABLE paymentRecords ADD COLUMN reversedAmountUsd DECIMAL(10,2) NOT NULL DEFAULT 0" },
  { name: "paymentRecords.reversedAt", sql: "ALTER TABLE paymentRecords ADD COLUMN reversedAt TIMESTAMP NULL" },
  { name: "paymentRecords.reversalTransactionId", sql: "ALTER TABLE paymentRecords ADD COLUMN reversalTransactionId INT NULL" },
  // paymentRecords.paymentStatus was originally ENUM('pending','confirmed','cancelled')
  // (see CREATE TABLE above, pre-Plan-v3). The schema.ts definition now includes
  // 'refunded' — used by reverseAdvancePayment when a paymentRecord is fully
  // reversed. Without this ALTER, existing deployments hit MySQL strict-mode
  // error 1265 (Data truncated for column 'paymentStatus') and every delete
  // that fires reverseAdvancePayment blows up on the paymentRecords update.
  { name: "paymentRecords.paymentStatus.refunded", sql: "ALTER TABLE paymentRecords MODIFY COLUMN paymentStatus ENUM('pending','confirmed','cancelled','refunded') NOT NULL DEFAULT 'confirmed'" },

  // ============ Plan v3, Phase 1: Safe edit/delete infrastructure ============
  // These five columns + two indexes on fullPackageOrders make order edits
  // and deletions atomic, reversible, and free of customer-ledger drift.
  // See drizzle/0033_safe_edit_delete_infra.sql for the full rationale.
  { name: "fullPackageOrders.chargeTransactionId", sql: "ALTER TABLE fullPackageOrders ADD COLUMN chargeTransactionId INT NULL" },
  { name: "fullPackageOrders.version", sql: "ALTER TABLE fullPackageOrders ADD COLUMN version INT NOT NULL DEFAULT 1" },
  { name: "fullPackageOrders.deletedAt", sql: "ALTER TABLE fullPackageOrders ADD COLUMN deletedAt TIMESTAMP NULL" },
  { name: "fullPackageOrders.deletedById", sql: "ALTER TABLE fullPackageOrders ADD COLUMN deletedById INT NULL" },
  { name: "fullPackageOrders.deletionReason", sql: "ALTER TABLE fullPackageOrders ADD COLUMN deletionReason TEXT NULL" },
  { name: "idx_fpo_deleted_at", sql: "CREATE INDEX idx_fpo_deleted_at ON fullPackageOrders (deletedAt)" },
  { name: "idx_fpo_charge_txn_id", sql: "CREATE INDEX idx_fpo_charge_txn_id ON fullPackageOrders (chargeTransactionId)" },

  // ============ Portal Price List — portal display metadata ============
  // Existing deployments already have pricingRules and serviceTypes; these
  // ALTERs add the per-row "show on customer portal" flag plus label/icon/
  // color/badge fields the admin uses to curate what customers see.
  // Each patch is idempotent — runSchemaPatches swallows "duplicate column"
  // errors on reruns, so re-deploys are safe.
  // Proof-of-ownership images on package claim requests (customer uploads
  // purchase screenshots / supplier / WeChat photos when claiming an
  // unclaimed package). Idempotent — reruns swallow "duplicate column".
  { name: "packageClaimRequests.proofImages", sql: "ALTER TABLE packageClaimRequests ADD COLUMN proofImages JSON" },

  // ============ customerNotifications drift repair ============
  // The live table was created from an older CREATE TABLE whose columns no
  // longer match the Drizzle schema (missing titleAr/messageAr/relatedType/
  // relatedId/actionLabel; a narrower `type` enum). The ORM SELECTs the
  // schema columns, so getCustomerNotifications 500s on the missing ones —
  // the "network error" the notifications centre showed. These idempotent
  // ALTERs reconcile existing deployments; runSchemaPatches swallows
  // duplicate-column errors so re-runs and already-correct DBs are safe.
  { name: "customerNotifications.titleAr", sql: "ALTER TABLE customerNotifications ADD COLUMN titleAr VARCHAR(255)" },
  { name: "customerNotifications.messageAr", sql: "ALTER TABLE customerNotifications ADD COLUMN messageAr TEXT" },
  { name: "customerNotifications.relatedType", sql: "ALTER TABLE customerNotifications ADD COLUMN relatedType ENUM('package','batch','payment','invoice','full_package')" },
  { name: "customerNotifications.relatedId", sql: "ALTER TABLE customerNotifications ADD COLUMN relatedId INT" },
  { name: "customerNotifications.actionLabel", sql: "ALTER TABLE customerNotifications ADD COLUMN actionLabel VARCHAR(100)" },
  { name: "customerNotifications.typeExtended", sql: "ALTER TABLE customerNotifications MODIFY COLUMN type ENUM('info','success','warning','error','package','payment','promotion') NOT NULL DEFAULT 'info'" },

  // The portal speaks four languages; its notifications spoke three. A
  // Chinese-speaking customer picked 中文 in the app and then got every
  // movement alert — the ones that wake their phone at night — in English.
  { name: "customerNotifications.titleZh", sql: "ALTER TABLE customerNotifications ADD COLUMN titleZh VARCHAR(255)" },
  { name: "customerNotifications.messageZh", sql: "ALTER TABLE customerNotifications ADD COLUMN messageZh TEXT" },

  { name: "pricingRules.showOnPortal",       sql: "ALTER TABLE pricingRules ADD COLUMN showOnPortal BOOLEAN NOT NULL DEFAULT FALSE" },
  { name: "pricingRules.portalLabelKu",      sql: "ALTER TABLE pricingRules ADD COLUMN portalLabelKu VARCHAR(150)" },
  { name: "pricingRules.portalLabelEn",      sql: "ALTER TABLE pricingRules ADD COLUMN portalLabelEn VARCHAR(150)" },
  { name: "pricingRules.portalLabelAr",      sql: "ALTER TABLE pricingRules ADD COLUMN portalLabelAr VARCHAR(150)" },
  { name: "pricingRules.portalLabelZh",      sql: "ALTER TABLE pricingRules ADD COLUMN portalLabelZh VARCHAR(150)" },
  { name: "pricingRules.portalIcon",         sql: "ALTER TABLE pricingRules ADD COLUMN portalIcon VARCHAR(50)" },
  { name: "pricingRules.portalColor",        sql: "ALTER TABLE pricingRules ADD COLUMN portalColor VARCHAR(30)" },
  { name: "pricingRules.portalBadge",        sql: "ALTER TABLE pricingRules ADD COLUMN portalBadge VARCHAR(30)" },
  { name: "pricingRules.portalSortOrder",    sql: "ALTER TABLE pricingRules ADD COLUMN portalSortOrder INT NOT NULL DEFAULT 0" },

  { name: "serviceTypes.showOnPortal",          sql: "ALTER TABLE serviceTypes ADD COLUMN showOnPortal BOOLEAN NOT NULL DEFAULT FALSE" },
  { name: "serviceTypes.portalDescriptionKu",   sql: "ALTER TABLE serviceTypes ADD COLUMN portalDescriptionKu TEXT" },
  { name: "serviceTypes.portalDescriptionEn",   sql: "ALTER TABLE serviceTypes ADD COLUMN portalDescriptionEn TEXT" },
  { name: "serviceTypes.portalDescriptionAr",   sql: "ALTER TABLE serviceTypes ADD COLUMN portalDescriptionAr TEXT" },
  { name: "serviceTypes.portalDescriptionZh",   sql: "ALTER TABLE serviceTypes ADD COLUMN portalDescriptionZh TEXT" },
  { name: "serviceTypes.portalBadge",           sql: "ALTER TABLE serviceTypes ADD COLUMN portalBadge VARCHAR(30)" },
  { name: "serviceTypes.portalPriceLabelKu",    sql: "ALTER TABLE serviceTypes ADD COLUMN portalPriceLabelKu VARCHAR(100)" },
  { name: "serviceTypes.portalPriceLabelEn",    sql: "ALTER TABLE serviceTypes ADD COLUMN portalPriceLabelEn VARCHAR(100)" },
  { name: "serviceTypes.portalPriceLabelAr",    sql: "ALTER TABLE serviceTypes ADD COLUMN portalPriceLabelAr VARCHAR(100)" },
  { name: "serviceTypes.portalPriceLabelZh",    sql: "ALTER TABLE serviceTypes ADD COLUMN portalPriceLabelZh VARCHAR(100)" },

  // ============ Multi-tracking / shared-tracking infrastructure ============
  // Older deployments still carry a UNIQUE constraint on
  // fullPackageOrderTrackings.trackingNumber from an earlier schema. The
  // shared-tracking feature (commit 48259fd) dropped it from drizzle but
  // never added a corresponding ALTER, so production DBs that ran the old
  // CREATE TABLE block still reject any second order trying to attach the
  // same tracking. These two patches make existing deployments match the
  // current schema. Both are idempotent: MySQL "duplicate key name" /
  // "check that column/key exists" errors are swallowed in runSchemaPatches.
  { name: "fpot.drop_unique_trackingNumber", sql: "ALTER TABLE fullPackageOrderTrackings DROP INDEX fullPackageOrderTrackings_trackingNumber_unique" },
  { name: "fpot.idx_tracking_number",        sql: "CREATE INDEX idx_fpot_tracking_number ON fullPackageOrderTrackings (trackingNumber)" },

  // Wazn News: pin-to-top flag. isFeatured added defensively too in case an
  // older blogPosts CREATE predates it. Idempotent — duplicate-column errors
  // are swallowed by runSchemaPatches.
  { name: "blogPosts.isFeatured", sql: "ALTER TABLE blogPosts ADD COLUMN isFeatured BOOLEAN NOT NULL DEFAULT FALSE" },
  { name: "blogPosts.isPinned",   sql: "ALTER TABLE blogPosts ADD COLUMN isPinned BOOLEAN NOT NULL DEFAULT FALSE" },

  // ============ Performance indexes (2026-07 audit) ============
  // Hot-path WHERE/JOIN/ORDER BY columns that previously forced full-table
  // scans. Pure additions — identical query results, just faster. All
  // idempotent: "duplicate key name" errors are swallowed by runSchemaPatches.
  { name: "idx.fpo_customer_id",           sql: "CREATE INDEX idx_fpo_customer_id ON fullPackageOrders (customerId)" },
  { name: "idx.fpo_tracking_number",       sql: "CREATE INDEX idx_fpo_tracking_number ON fullPackageOrders (trackingNumber)" },
  { name: "idx.fpo_batch_id",              sql: "CREATE INDEX idx_fpo_batch_id ON fullPackageOrders (batchId)" },
  { name: "idx.fpo_status",                sql: "CREATE INDEX idx_fpo_status ON fullPackageOrders (status)" },
  { name: "idx.cust_notif_customer_created", sql: "CREATE INDEX idx_cust_notif_customer_created ON customerNotifications (customerId, createdAt)" },
  // packageStatusHistory shipped with a primary key and nothing else, while
  // the portal's notification badge joins it on packageId and filters on
  // changedAt — on every home and profile load. With no access path MySQL
  // nested-loops the whole table per package: a customer with 200 parcels
  // against a year of history is already millions of row reads for one badge.
  { name: "idx.psh_package_changed",       sql: "CREATE INDEX idx_psh_package_changed ON packageStatusHistory (packageId, changedAt)" },
  { name: "idx.cust_msg_customer_created", sql: "CREATE INDEX idx_cust_msg_customer_created ON customerMessages (customerId, createdAt)" },
  { name: "idx.payment_records_account_id", sql: "CREATE INDEX idx_payment_records_account_id ON paymentRecords (accountId)" },
  { name: "idx.invoices_status",           sql: "CREATE INDEX idx_invoices_status ON invoices (status)" },
  { name: "idx.revenue_records_record_date", sql: "CREATE INDEX idx_revenue_records_record_date ON revenueRecords (recordDate)" },
  { name: "idx.revenue_records_customer_id", sql: "CREATE INDEX idx_revenue_records_customer_id ON revenueRecords (customerId)" },
  { name: "idx.expenses_expense_date",     sql: "CREATE INDEX idx_expenses_expense_date ON expenses (expenseDate)" },
  { name: "idx.expenses_category_id",      sql: "CREATE INDEX idx_expenses_category_id ON expenses (categoryId)" },
  { name: "idx.cash_txn_account_id",       sql: "CREATE INDEX idx_cash_txn_account_id ON cashTransactions (accountId)" },
  { name: "idx.batch_pricing_tiers_batch_id", sql: "CREATE INDEX idx_batch_pricing_tiers_batch_id ON batchPricingTiers (batchId)" },
  { name: "idx.batch_customer_pricing",    sql: "CREATE INDEX idx_batch_customer_pricing ON batchCustomerPricing (batchId, customerId)" },
  { name: "idx.delivery_boxes_batch_id",   sql: "CREATE INDEX idx_delivery_boxes_batch_id ON deliveryBoxes (batchId)" },
  { name: "idx.delivery_boxes_customer_id", sql: "CREATE INDEX idx_delivery_boxes_customer_id ON deliveryBoxes (customerId)" },

  // Tutorials added before videos were split by spoken language. Kurdish is
  // the right default: every video recorded up to that point was in Kurdish.
  { name: "portalTutorials.language", sql: "ALTER TABLE portalTutorials ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'ku'" },
  { name: "idx.portal_tutorials_language", sql: "CREATE INDEX idx_portal_tutorials_language ON portalTutorials (language, isPublished)" },

  // A stage between customs and delivered: through customs, in the Erbil
  // depot, waiting to be collected. Widening an enum keeps every existing row
  // valid, so this is safe to re-run and safe on live data.
  // Set when the customer confirms receipt from the portal, kept apart from
  // deliveredById so a staff handover with a signature stays distinguishable
  // from the customer's own word.
  { name: "deliveryBoxes.customerConfirmedAt", sql: "ALTER TABLE deliveryBoxes ADD COLUMN customerConfirmedAt TIMESTAMP NULL" },

  // Volumetric billing acknowledgement.
  //
  // Air is billed on the greater of scale weight and volumetric weight, so a
  // light bulky carton costs several times what its weight suggests. The
  // customer has to be told before it ships, and somebody has to record that
  // they were. Nullable and additive: an existing parcel simply has no
  // acknowledgement, which is exactly true of every parcel registered before
  // this existed. Batching is never blocked on it — the flag is there so the
  // case cannot pass unnoticed, not to hold up the warehouse.
  { name: "packages.volumetricAckAt", sql: "ALTER TABLE packages ADD COLUMN volumetricAckAt TIMESTAMP NULL" },
  { name: "packages.volumetricAckById", sql: "ALTER TABLE packages ADD COLUMN volumetricAckById INT NULL" },
  { name: "packages.volumetricNotifiedAt", sql: "ALTER TABLE packages ADD COLUMN volumetricNotifiedAt TIMESTAMP NULL" },

  // The portal filters packages by customer AND batch together, seven times
  // on a single page load. MySQL uses one index per table, so the
  // single-column customerId index was reading the customer's entire parcel
  // history each time and discarding almost all of it.
  { name: "idx.packages_customer_batch", sql: "CREATE INDEX idx_packages_customer_batch ON packages (customerId, batchId)" },

  // When a customer last set their own password. The password stays
  // hashed and unreadable; this only records that they chose one.
  { name: "customers.passwordChangedAt", sql: "ALTER TABLE customers ADD COLUMN passwordChangedAt TIMESTAMP NULL" },
  { name: "customers.photoUrl", sql: "ALTER TABLE customers ADD COLUMN photoUrl TEXT NULL" },
  { name: "customers.failedLoginAttempts", sql: "ALTER TABLE customers ADD COLUMN failedLoginAttempts INT NOT NULL DEFAULT 0" },
  { name: "customers.lastFailedLoginAt", sql: "ALTER TABLE customers ADD COLUMN lastFailedLoginAt TIMESTAMP NULL" },
  { name: "customers.lockedUntil", sql: "ALTER TABLE customers ADD COLUMN lockedUntil TIMESTAMP NULL" },
  { name: "batches.flightStatus", sql: "ALTER TABLE batches ADD COLUMN flightStatus VARCHAR(40) NULL" },
  { name: "batches.flightArrivedAt", sql: "ALTER TABLE batches ADD COLUMN flightArrivedAt TIMESTAMP NULL" },

  // A cancelled delivery box keeps the record of what happened, so it needs
  // to say why — otherwise the row reports only that something went wrong.
  { name: "deliveryBoxes.cancellationReason", sql: "ALTER TABLE deliveryBoxes ADD COLUMN cancellationReason TEXT NULL" },
  { name: "deliveryBoxes.cancelledById", sql: "ALTER TABLE deliveryBoxes ADD COLUMN cancelledById INT NULL" },
  { name: "deliveryBoxes.cancelledAt", sql: "ALTER TABLE deliveryBoxes ADD COLUMN cancelledAt TIMESTAMP NULL" },

  // ---- where the work was done
  //
  // Some customers' goods never reach the China warehouse: they arrive in
  // Erbil, are registered and batched and boxed there, all inside two days.
  // The system handles both identically, which is right — but it left no way
  // to tell afterwards which shipments were handled where.
  //
  // The location lives on the staff account and is stamped onto whatever they
  // create. Stamped, not looked up: if somebody changes office next year,
  // last year's batches must still say where they were actually made.
  { name: "users.workCountryId", sql: "ALTER TABLE users ADD COLUMN workCountryId INT NULL" },
  { name: "users.workCity", sql: "ALTER TABLE users ADD COLUMN workCity VARCHAR(100) NULL" },
  { name: "batches.createdInCountryId", sql: "ALTER TABLE batches ADD COLUMN createdInCountryId INT NULL" },
  { name: "batches.createdInCity", sql: "ALTER TABLE batches ADD COLUMN createdInCity VARCHAR(100) NULL" },
  { name: "packages.registeredInCountryId", sql: "ALTER TABLE packages ADD COLUMN registeredInCountryId INT NULL" },
  { name: "packages.registeredInCity", sql: "ALTER TABLE packages ADD COLUMN registeredInCity VARCHAR(100) NULL" },
  // Grouping a report by where the work happened.
  { name: "idx.batches_created_in_country", sql: "CREATE INDEX idx_batches_created_in_country ON batches (createdInCountryId)" },

  // Backfill from the creator's location, once. Everything already in the
  // database predates the stamp, and the only honest source for it is where
  // the person who made it works now — which is exactly the rule the office
  // was going to apply by hand anyway. Runs only over rows with no stamp, so
  // it never overwrites a real one.
  {
    name: "backfill.batches.createdInLocation",
    sql: `UPDATE batches b JOIN users u ON u.id = b.createdById
          SET b.createdInCountryId = u.workCountryId, b.createdInCity = u.workCity
          WHERE b.createdInCountryId IS NULL AND u.workCountryId IS NOT NULL`,
  },
  {
    name: "backfill.packages.registeredInLocation",
    sql: `UPDATE packages p JOIN users u ON u.id = p.registeredById
          SET p.registeredInCountryId = u.workCountryId, p.registeredInCity = u.workCity
          WHERE p.registeredInCountryId IS NULL AND u.workCountryId IS NOT NULL`,
  },

  // ---- expenseCategories: the table and the code described different tables
  //
  // CREATE TABLE above makes `name`, `nameKu`, `description`, `isActive`.
  // The code inserts `nameEn`, `nameAr`, `icon`, `color`, `isRecurring` and
  // `sortOrder`. So creating a category wrote columns that did not exist and
  // omitted a NOT NULL one — it could not have worked, which is exactly what
  // the expenses screen showed: no categories, and a form that did nothing.
  //
  // Additive and idempotent, so it repairs a table created either way.
  { name: "expenseCategories.nameEn", sql: "ALTER TABLE expenseCategories ADD COLUMN nameEn VARCHAR(100)" },
  { name: "expenseCategories.nameAr", sql: "ALTER TABLE expenseCategories ADD COLUMN nameAr VARCHAR(100)" },
  { name: "expenseCategories.icon", sql: "ALTER TABLE expenseCategories ADD COLUMN icon VARCHAR(50)" },
  { name: "expenseCategories.color", sql: "ALTER TABLE expenseCategories ADD COLUMN color VARCHAR(20)" },
  { name: "expenseCategories.isRecurring", sql: "ALTER TABLE expenseCategories ADD COLUMN isRecurring BOOLEAN NOT NULL DEFAULT FALSE" },
  { name: "expenseCategories.sortOrder", sql: "ALTER TABLE expenseCategories ADD COLUMN sortOrder INT NOT NULL DEFAULT 0" },
  // The legacy `name` column is NOT NULL and nothing writes it any more, so
  // every insert failed on it. Widened to accept nothing rather than dropped:
  // a column that existing rows may still be read through is not worth
  // removing for the sake of tidiness.
  { name: "expenseCategories.name.nullable", sql: "ALTER TABLE expenseCategories MODIFY COLUMN name VARCHAR(100) NULL" },
  // Backfill so rows written under either shape read correctly from both.
  { name: "expenseCategories.backfill.nameEn", sql: "UPDATE expenseCategories SET nameEn = name WHERE (nameEn IS NULL OR nameEn = '') AND name IS NOT NULL" },

  // ---- the categories this company actually spends money on
  //
  // The table shipped empty, so the expenses screen opened with nothing to
  // file anything under and the first job was inventing fourteen categories
  // by hand. These are the ones named by the office, plus the recurring bills
  // every freight operation has.
  //
  // Each insert is guarded on its own name, so re-running adds nothing and a
  // category the office later renames or deletes does not come back.
  ...([
    ["Fuel", "بەنزین", "وقود", "⛽", "amber", 0, 1],
    ["Meals", "نانخواردن", "وجبات", "🍽️", "orange", 0, 2],
    ["Supplies", "کەل و پەل", "مستلزمات", "📦", "blue", 0, 3],
    ["Vehicle maintenance", "مەسارفی سەیارە", "صيانة المركبات", "🚗", "slate", 0, 4],
    ["Rent", "کرێی بینا", "إيجار", "🏢", "violet", 1, 5],
    ["Salaries", "موچەی فەرمانبەران", "رواتب", "👥", "green", 1, 6],
    ["Freight charges", "کرێی گواستنەوە", "أجور الشحن", "✈️", "cyan", 0, 7],
    ["Customs and duties", "گومرگ و باج", "جمارك ورسوم", "🛃", "red", 0, 8],
    ["Electricity and water", "کارەبا و ئاو", "كهرباء وماء", "💡", "yellow", 1, 9],
    ["Generator", "مۆلیدە", "مولدة", "🔌", "stone", 1, 10],
    ["Internet and phone", "ئینتەرنێت و تەلەفۆن", "إنترنت وهاتف", "📶", "sky", 1, 11],
    ["Repairs", "چاککردنەوە", "تصليحات", "🔧", "zinc", 0, 12],
    ["Marketing", "بانگەشە", "تسويق", "📣", "pink", 0, 13],
    ["Bank charges", "کرێی بانک", "رسوم بنكية", "🏦", "indigo", 0, 14],
    ["Other", "هیتر", "أخرى", "•", "gray", 0, 99],
  ].map(([en, ku, ar, icon, color, recurring, order]) => {
    // Single quotes, not JSON's double ones: under ANSI_QUOTES a double-quoted
    // literal is read as an identifier and the whole statement fails.
    const q = (v: unknown) => `'${String(v).replace(/'/g, "''")}'`;
    return {
      name: `seed.expenseCategory.${String(en).toLowerCase().replace(/[^a-z]+/g, "_")}`,
      sql:
        `INSERT INTO expenseCategories (nameEn, nameKu, nameAr, icon, color, isRecurring, sortOrder, isActive) ` +
        `SELECT ${q(en)}, ${q(ku)}, ${q(ar)}, ${q(icon)}, ${q(color)}, ${recurring}, ${order}, TRUE FROM DUAL ` +
        // The derived table keeps MySQL happy about reading the table it is
        // inserting into.
        `WHERE NOT EXISTS (SELECT 1 FROM (SELECT nameEn FROM expenseCategories) c WHERE c.nameEn = ${q(en)})`,
    };
  })),

  {
    name: "batches.status.at_depot",
    sql: "ALTER TABLE batches MODIFY COLUMN status ENUM('preparing','in_transit','arrived','customs','at_depot','delivered','closed') NOT NULL DEFAULT 'preparing'",
  },

  // The read-only account. Without this the role cannot be saved at all, and
  // MySQL reports it as truncated data for column 'role' — an error nobody
  // would trace back to a new feature. See shared/readOnlyRole.ts.
  {
    name: "users.role.auditor",
    sql: "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','admin','employee','accountant','auditor') NOT NULL DEFAULT 'employee'",
  },

  // How a batch physically reached the carrier, and how big it was.
  //
  // The air waybill is the air counterpart of the container number, and like
  // it, is unknown while the cartons are still being filled — so both are
  // nullable and filled in later. shipmentTrackings holds the courier
  // trackings the cartons travelled under, cartonCount how many cartons went;
  // the piece count needs no column because every item is scanned into the
  // batch. All additive and nullable: existing batches keep working with none
  // of them set.
  { name: "batches.awbNumber", sql: "ALTER TABLE batches ADD COLUMN awbNumber VARCHAR(50) NULL" },
  { name: "batches.shipmentTrackings", sql: "ALTER TABLE batches ADD COLUMN shipmentTrackings JSON NULL" },
  { name: "batches.cartonCount", sql: "ALTER TABLE batches ADD COLUMN cartonCount INT NULL" },
];

export async function runSchemaPatches(config: MigrationConfig): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const log = config.logger || (() => {});

  for (const patch of SCHEMA_PATCHES) {
    try {
      if (config.dryRun) {
        log(`[DRY RUN] Would run patch: ${patch.name}`, "info");
        applied.push(patch.name);
        continue;
      }
      await config.connection.execute(patch.sql);
      log(`Applied schema patch: ${patch.name}`, "success");
      applied.push(patch.name);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const lower = msg.toLowerCase();
      // Swallow "already exists" errors so patches are idempotent across restarts.
      // MySQL reports them as "Duplicate column", "Duplicate key name", or
      // generic "already exists" depending on statement type (ALTER vs CREATE INDEX).
      // For DROP INDEX/COLUMN statements, "check that column/key exists" (1091)
      // and "doesn't exist" mean the patch was already applied (or never needed).
      if (
        lower.includes("duplicate column") ||
        lower.includes("duplicate key name") ||
        lower.includes("already exists") ||
        lower.includes("check that column/key exists") ||
        lower.includes("doesn't exist") ||
        lower.includes("does not exist")
      ) {
        skipped.push(patch.name);
      } else {
        log(`Schema patch failed ${patch.name}: ${msg}`, "warn");
      }
    }
  }
  return { applied, skipped };
}

export default {
  TABLE_DEFINITIONS,
  runMigrations,
  getMigrationStatus,
  SCHEMA_PATCHES,
  runSchemaPatches,
};
