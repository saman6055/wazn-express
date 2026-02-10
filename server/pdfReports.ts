import PDFDocument from 'pdfkit';
import { getDb } from './db';
import { packages, users, customers, ledgerTransactions, customerAccounts, paymentRecords, batches } from '../drizzle/schema';
import { sql, count, eq, desc, gte, lte, and, sum } from 'drizzle-orm';

// ============ CUSTOMER PDF REPORT ============

interface CustomerReportData {
  customer: {
    id: number;
    fullName: string;
    customerCode: string;
    mobileNumber: string;
    email: string | null;
    createdAt: Date;
  };
  accountSummary: {
    totalCharges: number;
    totalPayments: number;
    currentBalance: number;
    creditLimit: number;
  };
  packages: Array<{
    trackingNumber: string;
    status: string;
    weightKg: number;
    costUsd: number;
    createdAt: Date;
    batchCode: string | null;
  }>;
  payments: Array<{
    amount: number;
    method: string;
    reference: string | null;
    createdAt: Date;
  }>;
  transactions: Array<{
    type: string;
    amount: number;
    description: string;
    createdAt: Date;
  }>;
  generatedAt: Date;
  dateRange?: { start: Date; end: Date };
}

export async function getCustomerReportData(customerId: number, startDate?: Date, endDate?: Date): Promise<CustomerReportData | null> {
  const db = await getDb();
  if (!db) return null;

  // Get customer info (from customers table)
  const [customer] = await db.select({
    id: customers.id,
    fullName: customers.fullName,
    customerCode: customers.customerCode,
    mobileNumber: customers.mobileNumber,
    email: customers.email,
    createdAt: customers.createdAt
  }).from(customers).where(eq(customers.id, customerId));

  if (!customer) return null;

  // Get account summary
  const [account] = await db.select({
    currentBalance: customerAccounts.currentBalanceUsd,
    creditLimit: customerAccounts.creditLimitUsd
  }).from(customerAccounts).where(eq(customerAccounts.customerId, customerId));

  // Get total charges
  const [chargesResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END), 0)`
  }).from(ledgerTransactions).where(eq(ledgerTransactions.accountId, customerId));

  // Get total payments
  const [paymentsTotal] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords).where(eq(paymentRecords.accountId, customerId));

  // Get packages with optional date filter
  let packagesQuery = db.select({
    trackingNumber: packages.trackingNumber,
    status: packages.status,
    weightKg: packages.weightKg,
    costUsd: packages.calculatedCostUsd,
    createdAt: packages.createdAt,
    batchId: packages.batchId
  }).from(packages).where(eq(packages.customerId, customerId));

  if (startDate && endDate) {
    packagesQuery = db.select({
      trackingNumber: packages.trackingNumber,
      status: packages.status,
      weightKg: packages.weightKg,
      costUsd: packages.calculatedCostUsd,
      createdAt: packages.createdAt,
      batchId: packages.batchId
    }).from(packages).where(and(
      eq(packages.customerId, customerId),
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ));
  }

  const customerPackages = await packagesQuery.orderBy(desc(packages.createdAt)).limit(50);

  // Get batch codes for packages
  const packagesWithBatch = await Promise.all(customerPackages.map(async (pkg) => {
    let batchCode = null;
    if (pkg.batchId) {
      const [batch] = await db.select({ batchCode: batches.batchCode }).from(batches).where(eq(batches.id, pkg.batchId));
      batchCode = batch?.batchCode || null;
    }
    return {
      trackingNumber: pkg.trackingNumber || '',
      status: pkg.status,
      weightKg: Number(pkg.weightKg) || 0,
      costUsd: Number(pkg.costUsd) || 0,
      createdAt: pkg.createdAt,
      batchCode
    };
  }));

  // Get payments with optional date filter
  let paymentsQuery = db.select({
    amount: paymentRecords.amountUsd,
    method: paymentRecords.paymentMethod,
    reference: paymentRecords.bankReference,
    createdAt: paymentRecords.createdAt
  }).from(paymentRecords).where(eq(paymentRecords.accountId, customerId));

  if (startDate && endDate) {
    paymentsQuery = db.select({
      amount: paymentRecords.amountUsd,
      method: paymentRecords.paymentMethod,
      reference: paymentRecords.bankReference,
      createdAt: paymentRecords.createdAt
    }).from(paymentRecords).where(and(
      eq(paymentRecords.accountId, customerId),
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ));
  }

  const payments = await paymentsQuery.orderBy(desc(paymentRecords.createdAt)).limit(30);

  // Get transactions
  let transactionsQuery = db.select({
    type: ledgerTransactions.transactionType,
    amount: ledgerTransactions.amountUsd,
    description: ledgerTransactions.description,
    createdAt: ledgerTransactions.createdAt
  }).from(ledgerTransactions).where(eq(ledgerTransactions.accountId, customerId));

  if (startDate && endDate) {
    transactionsQuery = db.select({
      type: ledgerTransactions.transactionType,
      amount: ledgerTransactions.amountUsd,
      description: ledgerTransactions.description,
      createdAt: ledgerTransactions.createdAt
    }).from(ledgerTransactions).where(and(
      eq(ledgerTransactions.accountId, customerId),
      gte(ledgerTransactions.createdAt, startDate),
      lte(ledgerTransactions.createdAt, endDate)
    ));
  }

  const transactions = await transactionsQuery.orderBy(desc(ledgerTransactions.createdAt)).limit(50);

  return {
    customer: {
      id: customer.id,
      fullName: customer.fullName || 'Unknown',
      customerCode: customer.customerCode || '',
      mobileNumber: customer.mobileNumber || '',
      email: customer.email,
      createdAt: customer.createdAt
    },
    accountSummary: {
      totalCharges: parseFloat(chargesResult?.total || '0'),
      totalPayments: parseFloat(paymentsTotal?.total || '0'),
      currentBalance: parseFloat(account?.currentBalance || '0'),
      creditLimit: parseFloat(account?.creditLimit || '0')
    },
    packages: packagesWithBatch,
    payments: payments.map(p => ({
      amount: Number(p.amount) || 0,
      method: p.method,
      reference: p.reference,
      createdAt: p.createdAt
    })),
    transactions: transactions.map(t => ({
      type: t.type,
      amount: Number(t.amount) || 0,
      description: t.description || '',
      createdAt: t.createdAt
    })),
    generatedAt: new Date(),
    dateRange: startDate && endDate ? { start: startDate, end: endDate } : undefined
  };
}

export async function generateCustomerPDF(data: CustomerReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Wazn Express - Customer Report: ${data.customer.fullName}`,
          Author: 'Wazn Express System',
          Subject: 'Customer Report',
          CreationDate: new Date()
        }
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header with gradient effect
      doc.rect(0, 0, 595, 100).fill('#1a365d');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
         .text('WAZN EXPRESS', 40, 30);
      doc.fontSize(12).font('Helvetica').fillColor('#a0aec0')
         .text('Customer Financial Report', 40, 55);
      
      // Date range if specified
      if (data.dateRange) {
        doc.fontSize(9).fillColor('#a0aec0')
           .text(`Period: ${data.dateRange.start.toLocaleDateString()} - ${data.dateRange.end.toLocaleDateString()}`, 40, 75);
      }
      
      // Generated date
      doc.fontSize(9).fillColor('#a0aec0')
         .text(`Generated: ${data.generatedAt.toLocaleString()}`, 400, 75, { align: 'right' });

      let y = 120;

      // Customer Info Card
      doc.roundedRect(40, y, 515, 80, 8).fillColor('#f7fafc').fill();
      doc.roundedRect(40, y, 515, 80, 8).strokeColor('#e2e8f0').stroke();
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a365d')
         .text(data.customer.fullName, 55, y + 15);
      doc.fontSize(10).font('Helvetica').fillColor('#4a5568')
         .text(`Customer Code: ${data.customer.customerCode}`, 55, y + 35);
      doc.text(`Mobile: ${data.customer.mobileNumber}`, 55, y + 50);
      if (data.customer.email) {
        doc.text(`Email: ${data.customer.email}`, 55, y + 65);
      }
      
      // Account Summary on right side
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2d3748')
         .text('Account Summary', 350, y + 15);
      doc.font('Helvetica').fillColor('#4a5568');
      doc.text(`Total Charges: $${data.accountSummary.totalCharges.toFixed(2)}`, 350, y + 32);
      doc.text(`Total Payments: $${data.accountSummary.totalPayments.toFixed(2)}`, 350, y + 47);
      
      const balanceColor = data.accountSummary.currentBalance > 0 ? '#e53e3e' : '#38a169';
      doc.font('Helvetica-Bold').fillColor(balanceColor)
         .text(`Current Balance: $${data.accountSummary.currentBalance.toFixed(2)}`, 350, y + 62);

      y += 100;

      // Financial Summary Cards
      const cardWidth = 160;
      const cardGap = 17;
      
      // Card 1: Total Packages
      drawSummaryCard(doc, 40, y, cardWidth, 'Total Packages', String(data.packages.length), '#3182ce');
      
      // Card 2: Total Payments
      drawSummaryCard(doc, 40 + cardWidth + cardGap, y, cardWidth, 'Total Payments', `$${data.accountSummary.totalPayments.toFixed(0)}`, '#38a169');
      
      // Card 3: Balance
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 2, y, cardWidth, 'Balance Due', `$${data.accountSummary.currentBalance.toFixed(0)}`, data.accountSummary.currentBalance > 0 ? '#e53e3e' : '#38a169');

      y += 85;

      // Packages Table
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Package History', 40, y);
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Tracking #', 45, y + 6);
      doc.text('Status', 170, y + 6);
      doc.text('Weight', 260, y + 6);
      doc.text('Cost', 320, y + 6);
      doc.text('Batch', 390, y + 6);
      doc.text('Date', 470, y + 6);
      y += 22;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      for (const pkg of data.packages.slice(0, 15)) {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        const rowColor = data.packages.indexOf(pkg) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 18).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(pkg.trackingNumber.substring(0, 20), 45, y + 5);
        doc.fillColor(getStatusColor(pkg.status)).text(formatStatus(pkg.status), 170, y + 5);
        doc.fillColor('#2d3748');
        doc.text(`${pkg.weightKg.toFixed(1)} kg`, 260, y + 5);
        doc.text(`$${pkg.costUsd.toFixed(2)}`, 320, y + 5);
        doc.text(pkg.batchCode || '-', 390, y + 5);
        doc.text(pkg.createdAt.toLocaleDateString(), 470, y + 5);
        y += 18;
      }

      if (data.packages.length > 15) {
        doc.fontSize(8).fillColor('#718096').text(`... and ${data.packages.length - 15} more packages`, 45, y + 5);
        y += 20;
      }

      y += 20;

      // Payments Table
      if (y > 600) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Payment History', 40, y);
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Date', 45, y + 6);
      doc.text('Amount', 150, y + 6);
      doc.text('Method', 280, y + 6);
      doc.text('Reference', 400, y + 6);
      y += 22;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      for (const payment of data.payments.slice(0, 15)) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        
        const rowColor = data.payments.indexOf(payment) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 18).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(payment.createdAt.toLocaleDateString(), 45, y + 5);
        doc.fillColor('#38a169').text(`$${payment.amount.toFixed(2)}`, 150, y + 5);
        doc.fillColor('#2d3748');
        doc.text(formatPaymentMethod(payment.method), 280, y + 5);
        doc.text(payment.reference || '-', 400, y + 5);
        y += 18;
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Customer Report | ${data.customer.customerCode}`,
             40, 780, { align: 'center', width: 515 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ BATCH PDF REPORT ============

interface BatchReportData {
  batch: {
    id: number;
    batchCode: string;
    shippingType: string;
    status: string;
    departureDate: Date | null;
    arrivalDate: Date | null;
    totalWeight: number;
    carrierInfo: string | null;
  };
  summary: {
    totalPackages: number;
    totalWeight: number;
    totalCost: number;
    customerCount: number;
  };
  packages: Array<{
    trackingNumber: string;
    customerName: string;
    customerCode: string;
    weightKg: number;
    costUsd: number;
    status: string;
  }>;
  customerBreakdown: Array<{
    customerName: string;
    customerCode: string;
    packageCount: number;
    totalWeight: number;
    totalCost: number;
  }>;
  generatedAt: Date;
}

export async function getBatchReportData(batchId: number): Promise<BatchReportData | null> {
  const db = await getDb();
  if (!db) return null;

  // Get batch info
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId));
  if (!batch) return null;

  // Get packages in batch
  const batchPackages = await db.select({
    trackingNumber: packages.trackingNumber,
    customerId: packages.customerId,
    weightKg: packages.weightKg,
    costUsd: packages.calculatedCostUsd,
    status: packages.status
  }).from(packages).where(eq(packages.batchId, batchId));

  // Get customer info for each package (from customers table)
  const packagesWithCustomer = await Promise.all(batchPackages.map(async (pkg) => {
    const [customer] = await db.select({
      fullName: customers.fullName,
      customerCode: customers.customerCode
    }).from(customers).where(eq(customers.id, pkg.customerId || 0));
    
    return {
      trackingNumber: pkg.trackingNumber || '',
      customerName: customer?.fullName || 'Unknown',
      customerCode: customer?.customerCode || '',
      weightKg: Number(pkg.weightKg) || 0,
      costUsd: Number(pkg.costUsd) || 0,
      status: pkg.status
    };
  }));

  // Calculate customer breakdown
  const customerMap = new Map<number, { name: string; code: string; packages: number; weight: number; cost: number }>();
  
  for (const pkg of batchPackages) {
    const customerId = pkg.customerId || 0;
    const existing = customerMap.get(customerId);
    if (existing) {
      existing.packages++;
      existing.weight += Number(pkg.weightKg) || 0;
      existing.cost += Number(pkg.costUsd) || 0;
    } else {
      const [customer] = await db.select({
        fullName: customers.fullName,
        customerCode: customers.customerCode
      }).from(customers).where(eq(customers.id, customerId));
      
      customerMap.set(customerId, {
        name: customer?.fullName || 'Unknown',
        code: customer?.customerCode || '',
        packages: 1,
        weight: Number(pkg.weightKg) || 0,
        cost: Number(pkg.costUsd) || 0
      });
    }
  }

  const customerBreakdown = Array.from(customerMap.values()).map(c => ({
    customerName: c.name,
    customerCode: c.code,
    packageCount: c.packages,
    totalWeight: c.weight,
    totalCost: c.cost
  })).sort((a, b) => b.packageCount - a.packageCount);

  const totalWeight = packagesWithCustomer.reduce((sum, p) => sum + p.weightKg, 0);
  const totalCost = packagesWithCustomer.reduce((sum, p) => sum + p.costUsd, 0);

  return {
    batch: {
      id: batch.id,
      batchCode: batch.batchCode,
      shippingType: batch.shippingType,
      status: batch.status,
      departureDate: batch.departureDate,
      arrivalDate: batch.actualArrival,
      totalWeight: Number(batch.totalWeight) || 0,
      carrierInfo: batch.carrierInfo
    },
    summary: {
      totalPackages: packagesWithCustomer.length,
      totalWeight,
      totalCost,
      customerCount: customerMap.size
    },
    packages: packagesWithCustomer,
    customerBreakdown,
    generatedAt: new Date()
  };
}

export async function generateBatchPDF(data: BatchReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Wazn Express - Batch Report: ${data.batch.batchCode}`,
          Author: 'Wazn Express System',
          Subject: 'Batch Report',
          CreationDate: new Date()
        }
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      const headerColor = data.batch.shippingType === 'sea' ? '#0d9488' : '#3b82f6';
      doc.rect(0, 0, 595, 110).fill(headerColor);
      
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
         .text('WAZN EXPRESS', 40, 25);
      doc.fontSize(14).font('Helvetica').fillColor('#e0e7ff')
         .text('Batch Shipment Report', 40, 50);
      
      // Batch code badge
      doc.roundedRect(40, 70, 150, 28, 4).fill('#ffffff');
      doc.fontSize(14).font('Helvetica-Bold').fillColor(headerColor)
         .text(data.batch.batchCode, 50, 78);
      
      // Shipping type badge
      const typeLabel = data.batch.shippingType === 'sea' ? '🚢 Sea Freight' : '✈️ Air Freight';
      doc.fontSize(10).fillColor('#ffffff')
         .text(typeLabel, 400, 78);
      
      // Generated date
      doc.fontSize(9).fillColor('#e0e7ff')
         .text(`Generated: ${data.generatedAt.toLocaleString()}`, 400, 92);

      let y = 130;

      // Batch Info Card
      doc.roundedRect(40, y, 515, 70, 8).fillColor('#f0f9ff').fill();
      doc.roundedRect(40, y, 515, 70, 8).strokeColor('#bae6fd').stroke();
      
      doc.fontSize(10).font('Helvetica').fillColor('#4a5568');
      doc.text(`Status: ${formatStatus(data.batch.status)}`, 55, y + 15);
      doc.text(`Carrier: ${data.batch.carrierInfo || 'Not specified'}`, 55, y + 32);
      
      if (data.batch.departureDate) {
        doc.text(`Departure: ${data.batch.departureDate.toLocaleDateString()}`, 250, y + 15);
      }
      if (data.batch.arrivalDate) {
        doc.text(`Arrival: ${data.batch.arrivalDate.toLocaleDateString()}`, 250, y + 32);
      }
      
      doc.text(`Total Weight: ${data.batch.totalWeight.toFixed(1)} kg`, 420, y + 15);
      doc.text(`Packages: ${data.summary.totalPackages}`, 420, y + 32);

      y += 90;

      // Summary Cards
      const cardWidth = 120;
      const cardGap = 12;
      
      drawSummaryCard(doc, 40, y, cardWidth, 'Packages', String(data.summary.totalPackages), '#3182ce');
      drawSummaryCard(doc, 40 + cardWidth + cardGap, y, cardWidth, 'Customers', String(data.summary.customerCount), '#805ad5');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 2, y, cardWidth, 'Weight', `${data.summary.totalWeight.toFixed(1)} kg`, '#dd6b20');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 3, y, cardWidth, 'Total Cost', `$${data.summary.totalCost.toFixed(0)}`, '#38a169');

      y += 85;

      // Customer Breakdown Table
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Customer Breakdown', 40, y);
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Customer', 45, y + 6);
      doc.text('Code', 200, y + 6);
      doc.text('Packages', 280, y + 6);
      doc.text('Weight', 360, y + 6);
      doc.text('Cost', 450, y + 6);
      y += 22;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      for (const customer of data.customerBreakdown.slice(0, 12)) {
        const rowColor = data.customerBreakdown.indexOf(customer) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 18).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(customer.customerName.substring(0, 25), 45, y + 5);
        doc.text(customer.customerCode, 200, y + 5);
        doc.text(String(customer.packageCount), 280, y + 5);
        doc.text(`${customer.totalWeight.toFixed(1)} kg`, 360, y + 5);
        doc.fillColor('#38a169').text(`$${customer.totalCost.toFixed(2)}`, 450, y + 5);
        y += 18;
      }

      y += 25;

      // Package List Table
      if (y > 550) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Package List', 40, y);
      y += 20;

      // Table header
      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Tracking #', 45, y + 6);
      doc.text('Customer', 180, y + 6);
      doc.text('Weight', 320, y + 6);
      doc.text('Cost', 390, y + 6);
      doc.text('Status', 470, y + 6);
      y += 22;

      // Table rows
      doc.font('Helvetica').fontSize(8);
      for (const pkg of data.packages.slice(0, 20)) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        
        const rowColor = data.packages.indexOf(pkg) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 18).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(pkg.trackingNumber.substring(0, 18), 45, y + 5);
        doc.text(pkg.customerName.substring(0, 20), 180, y + 5);
        doc.text(`${pkg.weightKg.toFixed(1)} kg`, 320, y + 5);
        doc.text(`$${pkg.costUsd.toFixed(2)}`, 390, y + 5);
        doc.fillColor(getStatusColor(pkg.status)).text(formatStatus(pkg.status), 470, y + 5);
        y += 18;
      }

      if (data.packages.length > 20) {
        doc.fontSize(8).fillColor('#718096').text(`... and ${data.packages.length - 20} more packages`, 45, y + 5);
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Batch Report | ${data.batch.batchCode}`,
             40, 780, { align: 'center', width: 515 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ DATE-FILTERED DASHBOARD REPORT ============

interface DateFilteredDashboardData {
  dateRange: { start: Date; end: Date };
  periodLabel: string;
  financialStats: {
    totalRevenue: number;
    totalPayments: number;
    newCustomers: number;
    packagesProcessed: number;
  };
  dailyRevenue: Array<{ date: string; revenue: number; packages: number }>;
  topCustomers: Array<{ name: string; code: string; revenue: number; packages: number }>;
  packagesByStatus: Array<{ status: string; count: number }>;
  generatedAt: Date;
}

export async function getDateFilteredDashboardData(
  period: 'week' | 'month' | 'year' | 'custom',
  customStart?: Date,
  customEnd?: Date
): Promise<DateFilteredDashboardData> {
  const db = await getDb();
  
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(now);
  let periodLabel: string;

  switch (period) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      periodLabel = 'Last 7 Days';
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      periodLabel = 'Last 30 Days';
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      periodLabel = 'Last 12 Months';
      break;
    case 'custom':
      startDate = customStart || new Date(now.setDate(now.getDate() - 30));
      endDate = customEnd || new Date();
      periodLabel = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      break;
    default:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      periodLabel = 'Last 30 Days';
  }

  if (!db) {
    return {
      dateRange: { start: startDate, end: endDate },
      periodLabel,
      financialStats: { totalRevenue: 0, totalPayments: 0, newCustomers: 0, packagesProcessed: 0 },
      dailyRevenue: [],
      topCustomers: [],
      packagesByStatus: [],
      generatedAt: new Date()
    };
  }

  // Get total revenue in period
  const [revenueResult] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ));

  // Get packages processed in period
  const [packagesResult] = await db.select({
    count: count()
  }).from(packages)
    .where(and(
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ));

  // Get new customers in period (from customers table)
  const [customersResult] = await db.select({
    count: count()
  }).from(customers)
    .where(and(
      gte(customers.createdAt, startDate),
      lte(customers.createdAt, endDate)
    ));

  // Get packages by status in period
  const packagesByStatus = await db.select({
    status: packages.status,
    count: count()
  }).from(packages)
    .where(and(
      gte(packages.createdAt, startDate),
      lte(packages.createdAt, endDate)
    ))
    .groupBy(packages.status);

  // Get top customers in period
  const topCustomersRaw = await db.select({
    customerId: paymentRecords.accountId,
    totalRevenue: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`,
    packageCount: count()
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, startDate),
      lte(paymentRecords.createdAt, endDate)
    ))
    .groupBy(paymentRecords.accountId)
    .orderBy(desc(sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`))
    .limit(10);

  const topCustomers = await Promise.all(topCustomersRaw.map(async (c) => {
    const [customer] = await db.select({
      fullName: customers.fullName,
      customerCode: customers.customerCode
    }).from(customers).where(eq(customers.id, c.customerId));
    
    return {
      name: customer?.fullName || 'Unknown',
      code: customer?.customerCode || '',
      revenue: parseFloat(c.totalRevenue),
      packages: c.packageCount
    };
  }));

  return {
    dateRange: { start: startDate, end: endDate },
    periodLabel,
    financialStats: {
      totalRevenue: parseFloat(revenueResult?.total || '0'),
      totalPayments: parseFloat(revenueResult?.total || '0'),
      newCustomers: customersResult?.count || 0,
      packagesProcessed: packagesResult?.count || 0
    },
    dailyRevenue: [],
    topCustomers,
    packagesByStatus: packagesByStatus.map(s => ({ status: s.status, count: Number(s.count) })),
    generatedAt: new Date()
  };
}

export async function generateDateFilteredDashboardPDF(data: DateFilteredDashboardData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Wazn Express - Dashboard Report (${data.periodLabel})`,
          Author: 'Wazn Express System',
          Subject: 'Dashboard Report',
          CreationDate: new Date()
        }
      });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.rect(0, 0, 595, 100).fill('#1a365d');
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
         .text('WAZN EXPRESS', 40, 25);
      doc.fontSize(14).font('Helvetica').fillColor('#a0aec0')
         .text('Dashboard Report', 40, 50);
      
      // Period badge
      doc.roundedRect(40, 68, 200, 24, 4).fill('#3182ce');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
         .text(data.periodLabel, 50, 74);
      
      doc.fontSize(9).fillColor('#a0aec0')
         .text(`Generated: ${data.generatedAt.toLocaleString()}`, 400, 78, { align: 'right' });

      let y = 120;

      // Summary Cards
      const cardWidth = 120;
      const cardGap = 12;
      
      drawSummaryCard(doc, 40, y, cardWidth, 'Total Revenue', `$${data.financialStats.totalRevenue.toFixed(0)}`, '#38a169');
      drawSummaryCard(doc, 40 + cardWidth + cardGap, y, cardWidth, 'Packages', String(data.financialStats.packagesProcessed), '#3182ce');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 2, y, cardWidth, 'New Customers', String(data.financialStats.newCustomers), '#805ad5');
      drawSummaryCard(doc, 40 + (cardWidth + cardGap) * 3, y, cardWidth, 'Payments', `$${data.financialStats.totalPayments.toFixed(0)}`, '#dd6b20');

      y += 90;

      // Package Status Breakdown
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Package Status Distribution', 40, y);
      y += 20;

      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Status', 45, y + 6);
      doc.text('Count', 250, y + 6);
      doc.text('Percentage', 400, y + 6);
      y += 22;

      const totalPkgs = data.packagesByStatus.reduce((sum, s) => sum + s.count, 0);
      doc.font('Helvetica').fontSize(9);
      
      for (const stat of data.packagesByStatus) {
        const percentage = totalPkgs > 0 ? ((stat.count / totalPkgs) * 100).toFixed(1) : '0';
        const rowColor = data.packagesByStatus.indexOf(stat) % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 20).fill(rowColor);
        
        doc.fillColor(getStatusColor(stat.status)).text(formatStatus(stat.status), 45, y + 6);
        doc.fillColor('#2d3748').text(String(stat.count), 250, y + 6);
        doc.text(`${percentage}%`, 400, y + 6);
        y += 20;
      }

      y += 30;

      // Top Customers
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Top Customers by Revenue', 40, y);
      y += 20;

      doc.rect(40, y, 515, 22).fill('#edf2f7');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('#', 45, y + 6);
      doc.text('Customer', 70, y + 6);
      doc.text('Code', 230, y + 6);
      doc.text('Packages', 330, y + 6);
      doc.text('Revenue', 430, y + 6);
      y += 22;

      doc.font('Helvetica').fontSize(9);
      data.topCustomers.forEach((customer, index) => {
        const rowColor = index % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(40, y, 515, 20).fill(rowColor);
        
        doc.fillColor('#2d3748');
        doc.text(String(index + 1), 45, y + 6);
        doc.text(customer.name.substring(0, 25), 70, y + 6);
        doc.text(customer.code, 230, y + 6);
        doc.text(String(customer.packages), 330, y + 6);
        doc.fillColor('#38a169').text(`$${customer.revenue.toFixed(2)}`, 430, y + 6);
        y += 20;
      });

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Dashboard Report | ${data.periodLabel}`,
             40, 780, { align: 'center', width: 515 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ============ HELPER FUNCTIONS ============

function drawSummaryCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, label: string, value: string, color: string) {
  doc.roundedRect(x, y, width, 65, 6).fillColor('#ffffff').fill();
  doc.roundedRect(x, y, width, 65, 6).strokeColor('#e2e8f0').stroke();
  
  // Color accent bar
  doc.rect(x, y, 4, 65).fill(color);
  
  doc.fontSize(9).font('Helvetica').fillColor('#718096')
     .text(label, x + 12, y + 12, { width: width - 20 });
  
  doc.fontSize(18).font('Helvetica-Bold').fillColor(color)
     .text(value, x + 12, y + 32, { width: width - 20 });
}

function formatStatus(status: string): string {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'registered': '#3182ce',
    'in_transit': '#dd6b20',
    'arrived': '#805ad5',
    'customs': '#d69e2e',
    'ready_for_delivery': '#38a169',
    'delivered': '#38a169',
    'returned': '#e53e3e'
  };
  return colors[status] || '#4a5568';
}

function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    'cash': 'Cash',
    'bank_transfer': 'Bank Transfer',
    'mobile_payment': 'Mobile Payment',
    'card': 'Card',
    'fastpay': 'FastPay',
    'other': 'Other'
  };
  return methods[method] || method;
}
