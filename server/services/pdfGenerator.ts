import PDFDocument from 'pdfkit';
import { getActiveBatches, getDb, getDefaultInvoiceTemplate } from '../db';
import { packages, users, customers, ledgerTransactions, customerAccounts, paymentRecords } from '../../drizzle/schema';
import { sql, count, eq, desc, gt, gte, and } from 'drizzle-orm';

interface DashboardReportData {
  financialStats: {
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
    totalDebt: number;
    todayPackages: number;
    todayChange: number;
    weekChange: number;
    monthChange: number;
  };
  packageStats: Array<{ status: string; count: number }>;
  topCustomers: Array<{ customerId: number; customerName: string; totalCharges: number; packageCount: number }>;
  activeBatches: Array<{ batchCode: string; status: string; packageCount: number; totalWeight: number }>;
  topDebtors: Array<{ customerId: number; customerName: string; debtUsd: number }>;
  generatedAt: Date;
}

export async function generateDashboardPDF(data: DashboardReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: 'Wazn Express - Dashboard Report',
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
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a365d')
         .text('Wazn Express', 50, 50, { align: 'center' });
      
      doc.fontSize(16).font('Helvetica').fillColor('#4a5568')
         .text('Dashboard Report', 50, 80, { align: 'center' });
      
      doc.fontSize(10).fillColor('#718096')
         .text(`Generated: ${data.generatedAt.toLocaleString()}`, 50, 105, { align: 'center' });

      // Divider line
      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#e2e8f0').stroke();

      // Financial Stats Section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d3748')
         .text('Financial Overview', 50, 150);

      const statsY = 175;
      const colWidth = 120;
      
      // Today's Revenue
      drawStatBox(doc, 50, statsY, "Today's Revenue", `$${data.financialStats.todayRevenue.toLocaleString()}`, '#48bb78');
      
      // Week's Revenue
      drawStatBox(doc, 50 + colWidth + 15, statsY, "Week's Revenue", `$${data.financialStats.weekRevenue.toLocaleString()}`, '#4299e1');
      
      // Month's Revenue
      drawStatBox(doc, 50 + (colWidth + 15) * 2, statsY, "Month's Revenue", `$${data.financialStats.monthRevenue.toLocaleString()}`, '#9f7aea');
      
      // Total Debt
      drawStatBox(doc, 50 + (colWidth + 15) * 3, statsY, 'Total Debt', `$${data.financialStats.totalDebt.toLocaleString()}`, '#f56565');

      // Package Stats Section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d3748')
         .text('Package Statistics', 50, statsY + 90);

      let packageY = statsY + 115;
      const totalPackages = data.packageStats.reduce((sum, s) => sum + Number(s.count), 0);
      
      doc.fontSize(10).font('Helvetica').fillColor('#4a5568');
      
      // Draw package status table
      doc.font('Helvetica-Bold').text('Status', 50, packageY);
      doc.text('Count', 200, packageY);
      doc.text('Percentage', 300, packageY);
      
      packageY += 20;
      doc.font('Helvetica');
      
      for (const stat of data.packageStats) {
        const percentage = totalPackages > 0 ? ((Number(stat.count) / totalPackages) * 100).toFixed(1) : '0';
        doc.text(formatStatus(stat.status), 50, packageY);
        doc.text(String(stat.count), 200, packageY);
        doc.text(`${percentage}%`, 300, packageY);
        packageY += 18;
      }
      
      doc.text(`Total: ${totalPackages}`, 50, packageY + 5, { underline: true });

      // Active Batches Section
      packageY += 40;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d3748')
         .text('Active Batches', 50, packageY);

      packageY += 25;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('Batch Code', 50, packageY);
      doc.text('Status', 150, packageY);
      doc.text('Packages', 250, packageY);
      doc.text('Weight (kg)', 350, packageY);
      
      packageY += 20;
      doc.font('Helvetica');
      
      for (const batch of data.activeBatches.slice(0, 5)) {
        doc.text(batch.batchCode, 50, packageY);
        doc.text(formatStatus(batch.status), 150, packageY);
        doc.text(String(batch.packageCount), 250, packageY);
        doc.text(batch.totalWeight.toFixed(1), 350, packageY);
        packageY += 18;
      }

      // Top Customers Section
      if (packageY > 600) {
        doc.addPage();
        packageY = 50;
      } else {
        packageY += 30;
      }
      
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d3748')
         .text('Top Customers by Revenue', 50, packageY);

      packageY += 25;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#4a5568');
      doc.text('#', 50, packageY);
      doc.text('Customer', 80, packageY);
      doc.text('Packages', 280, packageY);
      doc.text('Revenue', 380, packageY);
      
      packageY += 20;
      doc.font('Helvetica');
      
      data.topCustomers.slice(0, 10).forEach((customer, index) => {
        doc.text(String(index + 1), 50, packageY);
        doc.text(customer.customerName || `Customer #${customer.customerId}`, 80, packageY);
        doc.text(String(customer.packageCount), 280, packageY);
        doc.fillColor('#48bb78').text(`$${Number(customer.totalCharges).toFixed(2)}`, 380, packageY);
        doc.fillColor('#4a5568');
        packageY += 18;
      });

      // Top Debtors Section
      if (data.topDebtors.length > 0) {
        packageY += 30;
        
        if (packageY > 650) {
          doc.addPage();
          packageY = 50;
        }
        
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#2d3748')
           .text('Top Debtors', 50, packageY);

        packageY += 25;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#4a5568');
        doc.text('#', 50, packageY);
        doc.text('Customer', 80, packageY);
        doc.text('Debt Amount', 350, packageY);
        
        packageY += 20;
        doc.font('Helvetica');
        
        data.topDebtors.slice(0, 10).forEach((debtor, index) => {
          doc.text(String(index + 1), 50, packageY);
          doc.text(debtor.customerName || `Customer #${debtor.customerId}`, 80, packageY);
          doc.fillColor('#f56565').text(`$${debtor.debtUsd.toFixed(2)}`, 350, packageY);
          doc.fillColor('#4a5568');
          packageY += 18;
        });
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#a0aec0')
           .text(
             `Page ${i + 1} of ${pageCount} | Wazn Express Dashboard Report | ${data.generatedAt.toLocaleDateString()}`,
             50, 780, { align: 'center' }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function drawStatBox(doc: PDFKit.PDFDocument, x: number, y: number, label: string, value: string, color: string) {
  // Box background
  doc.roundedRect(x, y, 115, 60, 5).fillColor('#f7fafc').fill();
  
  // Label
  doc.fontSize(9).font('Helvetica').fillColor('#718096')
     .text(label, x + 10, y + 10, { width: 95 });
  
  // Value
  doc.fontSize(16).font('Helvetica-Bold').fillColor(color)
     .text(value, x + 10, y + 30, { width: 95 });
}

function formatStatus(status: string): string {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

export async function getDashboardReportData(): Promise<DashboardReportData> {
  const activeBatches = await getActiveBatches();
  const db = await getDb();
  
  // Calculate date ranges
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 30);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // Get package stats
  const packageStats = db ? await db.select({
    status: packages.status,
    count: count()
  }).from(packages).groupBy(packages.status) : [];

  // Get revenue stats from payment records
  const todayPayments = db ? await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords)
    .where(gte(paymentRecords.createdAt, todayStart)) : [{ total: '0' }];

  const weekPayments = db ? await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords)
    .where(gte(paymentRecords.createdAt, weekStart)) : [{ total: '0' }];

  const monthPayments = db ? await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords)
    .where(gte(paymentRecords.createdAt, monthStart)) : [{ total: '0' }];

  // Get yesterday's revenue for comparison
  const yesterdayPayments = db ? await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${paymentRecords.amountUsd} AS DECIMAL(12,2))), 0)`
  }).from(paymentRecords)
    .where(and(
      gte(paymentRecords.createdAt, yesterdayStart),
      sql`${paymentRecords.createdAt} < ${todayStart}`
    )) : [{ total: '0' }];

  // Get total debt
  const totalDebtResult = db ? await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))), 0)`
  }).from(customerAccounts)
    .where(gt(customerAccounts.currentBalanceUsd, '0')) : [{ total: '0' }];

  // Get today's packages
  const todayPackagesResult = db ? await db.select({
    count: count()
  }).from(packages)
    .where(gte(packages.createdAt, todayStart)) : [{ count: 0 }];

  // Calculate change percentages
  const todayRev = parseFloat(todayPayments[0]?.total || '0');
  const yesterdayRev = parseFloat(yesterdayPayments[0]?.total || '0');
  const todayChange = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev * 100) : 0;

  // Get top customers by revenue
  const topCustomers = db ? await db.select({
    customerId: ledgerTransactions.accountId,
    totalCharges: sql<string>`COALESCE(SUM(CASE WHEN ${ledgerTransactions.transactionType} LIKE 'DEBIT_%' THEN CAST(${ledgerTransactions.amountUsd} AS DECIMAL(12,2)) ELSE 0 END), 0)`,
    packageCount: count()
  }).from(ledgerTransactions)
    .groupBy(ledgerTransactions.accountId)
    .orderBy(desc(sql`totalCharges`))
    .limit(10) : [];

  // Get customer names
  const customersWithNames = await Promise.all(topCustomers.map(async (c) => {
    if (!db) return { ...c, customerName: `Customer #${c.customerId}`, totalCharges: parseFloat(c.totalCharges), packageCount: c.packageCount };
    const [customer] = await db.select({ fullName: customers.fullName }).from(customers).where(eq(customers.id, c.customerId));
    return {
      customerId: c.customerId,
      customerName: customer?.fullName || `Customer #${c.customerId}`,
      totalCharges: parseFloat(c.totalCharges),
      packageCount: c.packageCount
    };
  }));

  // Get top debtors
  const debtors = db ? await db.select({
    customerId: customerAccounts.customerId,
    debtUsd: sql<string>`CAST(${customerAccounts.currentBalanceUsd} AS DECIMAL(12,2))`
  }).from(customerAccounts)
    .where(gt(customerAccounts.currentBalanceUsd, '0'))
    .orderBy(desc(customerAccounts.currentBalanceUsd))
    .limit(10) : [];

  const debtorsWithNames = await Promise.all(debtors.map(async (d) => {
    if (!db) return { customerId: d.customerId, customerName: `Customer #${d.customerId}`, debtUsd: parseFloat(d.debtUsd) };
    const [customer] = await db.select({ fullName: customers.fullName }).from(customers).where(eq(customers.id, d.customerId));
    return {
      customerId: d.customerId,
      customerName: customer?.fullName || `Customer #${d.customerId}`,
      debtUsd: parseFloat(d.debtUsd)
    };
  }));

  return {
    financialStats: {
      todayRevenue: todayRev,
      weekRevenue: parseFloat(weekPayments[0]?.total || '0'),
      monthRevenue: parseFloat(monthPayments[0]?.total || '0'),
      totalDebt: parseFloat(totalDebtResult[0]?.total || '0'),
      todayPackages: todayPackagesResult[0]?.count || 0,
      todayChange: Math.round(todayChange * 10) / 10,
      weekChange: 0,
      monthChange: 0
    },
    packageStats: packageStats.map(s => ({ status: s.status, count: Number(s.count) })),
    topCustomers: customersWithNames,
    activeBatches: (activeBatches || []).map(b => ({
      batchCode: b.batchCode,
      status: b.status,
      packageCount: 0, // Will be calculated separately if needed
      totalWeight: Number(b.totalWeight) || 0
    })),
    topDebtors: debtorsWithNames,
    generatedAt: new Date()
  };
}


// Helper function to get template settings for PDF generation
export async function getTemplateSettings() {
  const template = await getDefaultInvoiceTemplate();
  
  if (!template) {
    // Return default settings if no template exists
    return {
      companyName: "Wazn Express",
      companyNameKu: "وازن ئێکسپرێس",
      companyNameAr: "وزن اكسبرس",
      companyAddress: "",
      companyPhone: "",
      companyPhone2: "",
      companyEmail: "",
      companyWebsite: "",
      logoUrl: "",
      logoWidth: 150,
      logoPosition: "left" as const,
      primaryColor: "#3b82f6",
      secondaryColor: "#10b981",
      accentColor: "#f59e0b",
      textColor: "#1f2937",
      backgroundColor: "#ffffff",
      fontFamily: "Helvetica",
      fontSize: 10,
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankIban: "",
      bankSwift: "",
      bank2Name: "",
      bank2AccountName: "",
      bank2AccountNumber: "",
      bank2Currency: "",
      footerText: "Thank you for your business!",
      footerTextKu: "سوپاس بۆ کارکردنتان لەگەڵمان!",
      footerTextAr: "شكراً لتعاملكم معنا!",
      showQrCode: true,
      showWatermark: false,
      watermarkText: "",
      invoicePrefix: "INV",
      invoiceNumberDigits: 6,
      style: "modern" as const,
    };
  }
  
  return {
    companyName: template.companyName || "Wazn Express",
    companyNameKu: template.companyNameKu || "وازن ئێکسپرێس",
    companyNameAr: template.companyNameAr || "وزن اكسبرس",
    companyAddress: template.companyAddress || "",
    companyPhone: template.companyPhone || "",
    companyPhone2: template.companyPhone2 || "",
    companyEmail: template.companyEmail || "",
    companyWebsite: template.companyWebsite || "",
    logoUrl: template.logoUrl || "",
    logoWidth: template.logoWidth || 150,
    logoPosition: template.logoPosition || "left",
    primaryColor: template.primaryColor || "#3b82f6",
    secondaryColor: template.secondaryColor || "#10b981",
    accentColor: template.accentColor || "#f59e0b",
    textColor: template.textColor || "#1f2937",
    backgroundColor: template.backgroundColor || "#ffffff",
    fontFamily: template.fontFamily || "Helvetica",
    fontSize: template.fontSize || 10,
    bankName: template.bankName || "",
    bankAccountName: template.bankAccountName || "",
    bankAccountNumber: template.bankAccountNumber || "",
    bankIban: template.bankIban || "",
    bankSwift: template.bankSwift || "",
    bank2Name: template.bank2Name || "",
    bank2AccountName: template.bank2AccountName || "",
    bank2AccountNumber: template.bank2AccountNumber || "",
    bank2Currency: template.bank2Currency || "",
    footerText: template.footerText || "Thank you for your business!",
    footerTextKu: template.footerTextKu || "سوپاس بۆ کارکردنتان لەگەڵمان!",
    footerTextAr: template.footerTextAr || "شكراً لتعاملكم معنا!",
    showQrCode: template.showQrCode ?? true,
    showWatermark: template.showWatermark ?? false,
    watermarkText: template.watermarkText || "",
    invoicePrefix: template.invoicePrefix || "INV",
    invoiceNumberDigits: template.invoiceNumberDigits || 6,
    style: template.style || "modern",
  };
}

// Convert hex color to RGB for PDFKit
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

// Generate a styled PDF header using template settings
export function applyTemplateHeader(
  doc: PDFKit.PDFDocument, 
  settings: Awaited<ReturnType<typeof getTemplateSettings>>,
  title: string,
  subtitle?: string
) {
  const primaryRgb = hexToRgb(settings.primaryColor);
  const textRgb = hexToRgb(settings.textColor);
  const secondaryRgb = hexToRgb(settings.secondaryColor);
  
  // Style-specific header
  if (settings.style === 'modern') {
    // Modern style: colored bar at top
    doc.rect(0, 0, 612, 8).fill(settings.primaryColor);
    
    // Company name
    doc.fontSize(24).font('Helvetica-Bold').fillColor(settings.primaryColor)
       .text(settings.companyName, 50, 30, { align: 'center' });
    
    // Title
    doc.fontSize(16).font('Helvetica').fillColor(settings.textColor)
       .text(title, 50, 60, { align: 'center' });
    
    if (subtitle) {
      doc.fontSize(10).fillColor('#718096')
         .text(subtitle, 50, 85, { align: 'center' });
    }
    
    // Divider
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor(settings.secondaryColor).stroke();
    
    return 130;
  } else if (settings.style === 'classic') {
    // Classic style: bordered header
    doc.rect(45, 25, 505, 80).strokeColor(settings.primaryColor).lineWidth(2).stroke();
    
    doc.fontSize(22).font('Helvetica-Bold').fillColor(settings.primaryColor)
       .text(settings.companyName, 50, 40, { align: 'center' });
    
    doc.fontSize(14).font('Helvetica').fillColor(settings.textColor)
       .text(title, 50, 70, { align: 'center' });
    
    if (subtitle) {
      doc.fontSize(10).fillColor('#718096')
         .text(subtitle, 50, 90, { align: 'center' });
    }
    
    return 130;
  } else {
    // Minimal style: simple text
    doc.fontSize(20).font('Helvetica-Bold').fillColor(settings.textColor)
       .text(settings.companyName, 50, 30);
    
    doc.fontSize(14).font('Helvetica').fillColor('#718096')
       .text(title, 50, 55);
    
    if (subtitle) {
      doc.fontSize(10).text(subtitle, 50, 75);
    }
    
    doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#e2e8f0').stroke();
    
    return 115;
  }
}

// Generate styled PDF footer using template settings
export function applyTemplateFooter(
  doc: PDFKit.PDFDocument,
  settings: Awaited<ReturnType<typeof getTemplateSettings>>,
  pageNum: number,
  totalPages: number,
  date: Date
) {
  doc.fontSize(8).fillColor('#a0aec0');
  
  // Footer text
  if (settings.footerText) {
    doc.text(settings.footerText, 50, 760, { align: 'center' });
  }
  
  // Page number and date
  doc.text(
    `Page ${pageNum} of ${totalPages} | ${settings.companyName} | ${date.toLocaleDateString()}`,
    50, 775, { align: 'center' }
  );
  
  // Contact info
  const contactParts = [];
  if (settings.companyPhone) contactParts.push(settings.companyPhone);
  if (settings.companyEmail) contactParts.push(settings.companyEmail);
  if (settings.companyWebsite) contactParts.push(settings.companyWebsite);
  
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | '), 50, 788, { align: 'center' });
  }
}
