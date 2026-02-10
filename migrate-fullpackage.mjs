import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('Starting migration...');
  
  // New columns to add to fullPackageOrders
  const newColumns = [
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS supplierId INT",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS productImages JSON",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS color VARCHAR(100)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS size VARCHAR(100)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS supplierTrackingNumber VARCHAR(100)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS supplierOrderNumber VARCHAR(100)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS purchaseInvoiceUrl TEXT",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS purchasePriceCny DECIMAL(10,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS commissionRate DECIMAL(5,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS commissionAmount DECIMAL(10,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS volumeCbm DECIMAL(10,6)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS dimensionLength DECIMAL(10,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS dimensionWidth DECIMAL(10,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS dimensionHeight DECIMAL(10,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS expectedDeliveryDate TIMESTAMP NULL",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS actualDeliveryDate TIMESTAMP NULL",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS qualityCheckStatus ENUM('pending', 'passed', 'failed', 'partial')",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS qualityCheckNotes TEXT",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS qualityCheckDate TIMESTAMP NULL",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS qualityCheckById INT",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS isReturned BOOLEAN DEFAULT FALSE",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS returnReason TEXT",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS returnDate TIMESTAMP NULL",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS returnStatus ENUM('requested', 'approved', 'rejected', 'completed')",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS refundAmount DECIMAL(10,2)",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS tags JSON",
    "ALTER TABLE fullPackageOrders ADD COLUMN IF NOT EXISTS customerNotes TEXT",
  ];
  
  // Update status enum to include new statuses
  const updateStatusEnum = `
    ALTER TABLE fullPackageOrders MODIFY COLUMN status ENUM(
      'pending', 'approved', 'ordered', 'tracking_added', 
      'in_china_warehouse', 'quality_check', 'in_batch', 'in_transit', 
      'arrived', 'ready_for_delivery', 'delivered', 
      'cancelled', 'refunded', 'returned'
    ) DEFAULT 'pending' NOT NULL
  `;
  
  // Create suppliers table
  const createSuppliersTable = `
    CREATE TABLE IF NOT EXISTS suppliers (
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
      rating DECIMAL(3,2) DEFAULT 5.00,
      totalOrders INT DEFAULT 0,
      totalSpentUsd DECIMAL(12,2) DEFAULT 0,
      notes TEXT,
      isActive BOOLEAN DEFAULT TRUE NOT NULL,
      createdById INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `;
  
  // Create fullPackageStatusHistory table
  const createStatusHistoryTable = `
    CREATE TABLE IF NOT EXISTS fullPackageStatusHistory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      previousStatus VARCHAR(50),
      newStatus VARCHAR(50) NOT NULL,
      changedById INT NOT NULL,
      changedByName VARCHAR(255),
      notes TEXT,
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `;
  
  try {
    // Create new tables first
    console.log('Creating suppliers table...');
    await conn.query(createSuppliersTable);
    console.log('✓ Suppliers table created');
    
    console.log('Creating fullPackageStatusHistory table...');
    await conn.query(createStatusHistoryTable);
    console.log('✓ Status history table created');
    
    // Add new columns
    for (const sql of newColumns) {
      try {
        await conn.query(sql);
        console.log('✓', sql.split('ADD COLUMN')[1]?.split(' ')[3] || 'column added');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log('- Column already exists, skipping');
        } else {
          console.error('Error:', err.message);
        }
      }
    }
    
    // Update status enum
    console.log('Updating status enum...');
    try {
      await conn.query(updateStatusEnum);
      console.log('✓ Status enum updated');
    } catch (err) {
      console.log('- Status enum update skipped:', err.message);
    }
    
    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
  
  await conn.end();
}

migrate();
