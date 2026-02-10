import PDFDocument from "pdfkit";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

const COMPANY_INFO: CompanyInfo = {
  name: "Wazn Express",
  address: "Erbil, Kurdistan Region, Iraq",
  phone: "+964 750 XXX XXXX",
  email: "info@waznexpress.com",
  website: "www.waznexpress.com",
};

// Colors
const COLORS = {
  primary: "#0f766e",
  secondary: "#14b8a6",
  dark: "#1e293b",
  gray: "#64748b",
  lightGray: "#f1f5f9",
  success: "#22c55e",
  danger: "#ef4444",
};

interface BatchFinancialData {
  batchCode: string;
  shippingType: string;
  status: string;
  departureDate?: string;
  arrivalDate?: string;
  actualVolume: number;
  chargedVolume: number;
  costPerUnit: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  profitMargin: number;
  customerBreakdown: Array<{
    customerName: string;
    customerCode: string;
    packages: number;
    volume: number;
    revenue: number;
  }>;
}

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  customer: {
    name: string;
    code: string;
    phone?: string;
    address?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
  notes?: string;
  isPaid: boolean;
}

export async function generateBatchFinancialPDF(data: BatchFinancialData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `batch-report-${data.batchCode}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`reports/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);
      
      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(COMPANY_INFO.address, 50, 80)
        .text(`Phone: ${COMPANY_INFO.phone}`, 50, 95);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(18)
        .text("Batch Financial Report", 50, 140);

      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 165);

      // Batch Info Box
      const boxY = 200;
      doc.rect(50, boxY, 495, 80)
        .fillColor(COLORS.lightGray)
        .fill();

      doc.fillColor(COLORS.dark)
        .fontSize(12)
        .text(`Batch: ${data.batchCode}`, 60, boxY + 15)
        .text(`Type: ${data.shippingType}`, 250, boxY + 15)
        .text(`Status: ${data.status}`, 400, boxY + 15);

      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`Departure: ${data.departureDate || "N/A"}`, 60, boxY + 40)
        .text(`Arrival: ${data.arrivalDate || "N/A"}`, 250, boxY + 40);

      const unit = data.shippingType === "sea" ? "CBM" : "KG";
      doc.text(`Volume: ${data.chargedVolume} ${unit}`, 400, boxY + 40);
      doc.text(`Cost: $${data.costPerUnit}/${unit}`, 60, boxY + 60);

      // Financial Summary
      const summaryY = 310;
      doc.fillColor(COLORS.dark)
        .fontSize(14)
        .text("Financial Summary", 50, summaryY);

      // Summary Cards
      const cardWidth = 155;
      const cardHeight = 60;
      const cardY = summaryY + 30;

      // Cost Card
      doc.rect(50, cardY, cardWidth, cardHeight)
        .fillColor("#fef2f2")
        .fill();
      doc.fillColor(COLORS.danger)
        .fontSize(10)
        .text("Total Cost", 60, cardY + 10);
      doc.fontSize(18)
        .text(`$${data.totalCost.toFixed(2)}`, 60, cardY + 30);

      // Revenue Card
      doc.rect(50 + cardWidth + 15, cardY, cardWidth, cardHeight)
        .fillColor("#f0fdf4")
        .fill();
      doc.fillColor(COLORS.success)
        .fontSize(10)
        .text("Total Revenue", 60 + cardWidth + 15, cardY + 10);
      doc.fontSize(18)
        .text(`$${data.totalRevenue.toFixed(2)}`, 60 + cardWidth + 15, cardY + 30);

      // Profit Card
      const profitColor = data.profit >= 0 ? COLORS.success : COLORS.danger;
      const profitBg = data.profit >= 0 ? "#dcfce7" : "#fee2e2";
      doc.rect(50 + (cardWidth + 15) * 2, cardY, cardWidth, cardHeight)
        .fillColor(profitBg)
        .fill();
      doc.fillColor(profitColor)
        .fontSize(10)
        .text("Profit", 60 + (cardWidth + 15) * 2, cardY + 10);
      doc.fontSize(18)
        .text(`$${data.profit.toFixed(2)}`, 60 + (cardWidth + 15) * 2, cardY + 30);
      doc.fontSize(10)
        .text(`${data.profitMargin.toFixed(1)}% margin`, 60 + (cardWidth + 15) * 2, cardY + 50);

      // Customer Breakdown Table
      const tableY = cardY + cardHeight + 40;
      doc.fillColor(COLORS.dark)
        .fontSize(14)
        .text("Customer Breakdown", 50, tableY);

      // Table Header
      const headerY = tableY + 25;
      doc.rect(50, headerY, 495, 25)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(10)
        .text("Customer", 60, headerY + 8)
        .text("Code", 180, headerY + 8)
        .text("Packages", 260, headerY + 8)
        .text(unit, 340, headerY + 8)
        .text("Revenue", 420, headerY + 8);

      // Table Rows
      let rowY = headerY + 25;
      data.customerBreakdown.forEach((customer, index) => {
        const bgColor = index % 2 === 0 ? "white" : COLORS.lightGray;
        doc.rect(50, rowY, 495, 22)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(9)
          .text(customer.customerName.substring(0, 20), 60, rowY + 6)
          .text(customer.customerCode, 180, rowY + 6)
          .text(customer.packages.toString(), 260, rowY + 6)
          .text(customer.volume.toFixed(2), 340, rowY + 6);

        doc.fillColor(COLORS.success)
          .text(`$${customer.revenue.toFixed(2)}`, 420, rowY + 6);

        rowY += 22;
      });

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateInvoicePDF(data: InvoiceData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `invoice-${data.invoiceNumber}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`invoices/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header with Logo area
      doc.fillColor(COLORS.primary)
        .fontSize(28)
        .text(COMPANY_INFO.name, 50, 50);

      doc.fillColor(COLORS.gray)
        .fontSize(9)
        .text(COMPANY_INFO.address, 50, 85)
        .text(`Phone: ${COMPANY_INFO.phone}`, 50, 98)
        .text(`Email: ${COMPANY_INFO.email}`, 50, 111);

      // Invoice Title
      doc.fillColor(COLORS.dark)
        .fontSize(24)
        .text("INVOICE", 400, 50, { align: "right" });

      // Invoice Number and Date
      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`Invoice #: ${data.invoiceNumber}`, 350, 85, { align: "right" })
        .text(`Date: ${data.date}`, 350, 100, { align: "right" });

      if (data.dueDate) {
        doc.text(`Due Date: ${data.dueDate}`, 350, 115, { align: "right" });
      }

      // Status Badge
      const statusY = 135;
      if (data.isPaid) {
        doc.rect(450, statusY, 95, 25)
          .fillColor(COLORS.success)
          .fill();
        doc.fillColor("white")
          .fontSize(12)
          .text("PAID", 450, statusY + 7, { width: 95, align: "center" });
      } else {
        doc.rect(450, statusY, 95, 25)
          .fillColor(COLORS.danger)
          .fill();
        doc.fillColor("white")
          .fontSize(12)
          .text("UNPAID", 450, statusY + 7, { width: 95, align: "center" });
      }

      // Bill To Section
      const billToY = 180;
      doc.rect(50, billToY, 250, 80)
        .fillColor(COLORS.lightGray)
        .fill();

      doc.fillColor(COLORS.primary)
        .fontSize(10)
        .text("BILL TO:", 60, billToY + 10);

      doc.fillColor(COLORS.dark)
        .fontSize(12)
        .text(data.customer.name, 60, billToY + 28);

      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`Code: ${data.customer.code}`, 60, billToY + 45);

      if (data.customer.phone) {
        doc.text(`Phone: ${data.customer.phone}`, 60, billToY + 60);
      }

      // Items Table
      const tableY = 290;
      
      // Table Header
      doc.rect(50, tableY, 495, 30)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(10)
        .text("Description", 60, tableY + 10)
        .text("Qty", 300, tableY + 10)
        .text("Unit Price", 360, tableY + 10)
        .text("Total", 460, tableY + 10);

      // Table Rows
      let rowY = tableY + 30;
      data.items.forEach((item, index) => {
        const bgColor = index % 2 === 0 ? "white" : COLORS.lightGray;
        doc.rect(50, rowY, 495, 25)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(9)
          .text(item.description, 60, rowY + 8, { width: 230 })
          .text(item.quantity.toString(), 300, rowY + 8)
          .text(`$${item.unitPrice.toFixed(2)}`, 360, rowY + 8)
          .text(`$${item.total.toFixed(2)}`, 460, rowY + 8);

        rowY += 25;
      });

      // Totals Section
      const totalsY = rowY + 20;
      
      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text("Subtotal:", 360, totalsY)
        .text(`$${data.subtotal.toFixed(2)}`, 460, totalsY);

      if (data.tax) {
        doc.text("Tax:", 360, totalsY + 18)
          .text(`$${data.tax.toFixed(2)}`, 460, totalsY + 18);
      }

      // Total Box
      const totalBoxY = totalsY + (data.tax ? 40 : 25);
      doc.rect(350, totalBoxY, 195, 35)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(12)
        .text("TOTAL:", 360, totalBoxY + 10)
        .fontSize(16)
        .text(`$${data.total.toFixed(2)}`, 460, totalBoxY + 8);

      // Notes
      if (data.notes) {
        const notesY = totalBoxY + 60;
        doc.fillColor(COLORS.dark)
          .fontSize(10)
          .text("Notes:", 50, notesY);
        doc.fillColor(COLORS.gray)
          .fontSize(9)
          .text(data.notes, 50, notesY + 15, { width: 300 });
      }

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text("Thank you for your business!", 50, 720, { align: "center" })
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 735, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function generateCustomerStatementPDF(data: {
  customer: { name: string; code: string; phone?: string };
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  transactions: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `statement-${data.customer.code}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`statements/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);

      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(COMPANY_INFO.address, 50, 80);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(18)
        .text("Account Statement", 50, 120);

      // Customer Info
      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`Customer: ${data.customer.name} (${data.customer.code})`, 50, 150)
        .text(`Period: ${data.startDate} to ${data.endDate}`, 50, 165);

      // Opening Balance
      doc.fillColor(COLORS.dark)
        .fontSize(11)
        .text(`Opening Balance: $${data.openingBalance.toFixed(2)}`, 350, 150);

      // Table Header
      const tableY = 200;
      doc.rect(50, tableY, 495, 25)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(9)
        .text("Date", 60, tableY + 8)
        .text("Description", 130, tableY + 8)
        .text("Debit", 330, tableY + 8)
        .text("Credit", 390, tableY + 8)
        .text("Balance", 460, tableY + 8);

      // Table Rows
      let rowY = tableY + 25;
      data.transactions.forEach((tx, index) => {
        const bgColor = index % 2 === 0 ? "white" : COLORS.lightGray;
        doc.rect(50, rowY, 495, 20)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(8)
          .text(tx.date, 60, rowY + 6)
          .text(tx.description.substring(0, 35), 130, rowY + 6);

        if (tx.debit > 0) {
          doc.fillColor(COLORS.danger)
            .text(`$${tx.debit.toFixed(2)}`, 330, rowY + 6);
        } else {
          doc.fillColor(COLORS.gray).text("-", 330, rowY + 6);
        }

        if (tx.credit > 0) {
          doc.fillColor(COLORS.success)
            .text(`$${tx.credit.toFixed(2)}`, 390, rowY + 6);
        } else {
          doc.fillColor(COLORS.gray).text("-", 390, rowY + 6);
        }

        doc.fillColor(COLORS.dark)
          .text(`$${tx.balance.toFixed(2)}`, 460, rowY + 6);

        rowY += 20;
      });

      // Closing Balance
      const closingY = rowY + 20;
      doc.rect(350, closingY, 195, 30)
        .fillColor(data.closingBalance >= 0 ? "#dcfce7" : "#fee2e2")
        .fill();

      doc.fillColor(data.closingBalance >= 0 ? COLORS.success : COLORS.danger)
        .fontSize(11)
        .text("Closing Balance:", 360, closingY + 8)
        .fontSize(14)
        .text(`$${data.closingBalance.toFixed(2)}`, 460, closingY + 8);

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 750)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}


// ============ COMPANY FINANCIAL REPORTS PDF ============

interface ProfitLossData {
  month: string;
  year: number;
  revenue: {
    packagePayments: number;
    fullPackageProfit: number;
    otherRevenue: number;
    total: number;
  };
  expenses: {
    byCategory: Array<{ category: string; amount: number }>;
    total: number;
  };
  netProfit: number;
}

export async function generateProfitLossPDF(data: ProfitLossData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `profit-loss-${data.year}-${data.month}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`reports/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);
      
      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(COMPANY_INFO.address, 50, 80)
        .text(`Phone: ${COMPANY_INFO.phone}`, 50, 95);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(20)
        .text("Profit & Loss Statement", 50, 140);

      doc.fillColor(COLORS.gray)
        .fontSize(12)
        .text(`${data.month} ${data.year}`, 50, 168);

      doc.fontSize(10)
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 185);

      // Revenue Section
      let yPos = 220;
      doc.fillColor(COLORS.success)
        .fontSize(16)
        .text("Revenue (داهات)", 50, yPos);

      yPos += 30;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.lightGray)
        .fill();

      doc.fillColor(COLORS.dark)
        .fontSize(10)
        .text("Package Payments (داهاتی پاکەتەکان)", 60, yPos + 8)
        .text(`$${data.revenue.packagePayments.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor("white")
        .fill();

      doc.fillColor(COLORS.dark)
        .text("Full Package Profit (قازانجی Full Package)", 60, yPos + 8)
        .text(`$${data.revenue.fullPackageProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.lightGray)
        .fill();

      doc.fillColor(COLORS.dark)
        .text("Other Revenue (داهاتی تر)", 60, yPos + 8)
        .text(`$${data.revenue.otherRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 30;
      doc.rect(50, yPos, 495, 30)
        .fillColor("#dcfce7")
        .fill();

      doc.fillColor(COLORS.success)
        .fontSize(12)
        .text("Total Revenue (کۆی داهات)", 60, yPos + 9)
        .fontSize(14)
        .text(`$${data.revenue.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 430, yPos + 9, { align: "right", width: 105 });

      // Expenses Section
      yPos += 50;
      doc.fillColor(COLORS.danger)
        .fontSize(16)
        .text("Expenses (مەسروفات)", 50, yPos);

      yPos += 30;
      data.expenses.byCategory.forEach((expense, index) => {
        const bgColor = index % 2 === 0 ? COLORS.lightGray : "white";
        doc.rect(50, yPos, 495, 25)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(10)
          .text(expense.category, 60, yPos + 8)
          .text(`-$${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

        yPos += 25;
      });

      doc.rect(50, yPos, 495, 30)
        .fillColor("#fee2e2")
        .fill();

      doc.fillColor(COLORS.danger)
        .fontSize(12)
        .text("Total Expenses (کۆی مەسروفات)", 60, yPos + 9)
        .fontSize(14)
        .text(`-$${data.expenses.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 430, yPos + 9, { align: "right", width: 105 });

      // Net Profit
      yPos += 50;
      const profitColor = data.netProfit >= 0 ? COLORS.success : COLORS.danger;
      const profitBg = data.netProfit >= 0 ? "#dcfce7" : "#fee2e2";
      
      doc.rect(50, yPos, 495, 50)
        .fillColor(profitBg)
        .fill();

      doc.fillColor(profitColor)
        .fontSize(16)
        .text("Net Profit (قازانجی نێت)", 60, yPos + 10)
        .fontSize(24)
        .text(`$${data.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 400, yPos + 12, { align: "right", width: 135 });

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

interface BalanceSheetData {
  date: string;
  assets: {
    cash: number;
    bank: number;
    receivables: number;
    total: number;
  };
  liabilities: {
    debts: Array<{ name: string; amount: number }>;
    total: number;
  };
  equity: {
    partnerCapital: number;
    retainedEarnings: number;
    total: number;
  };
}

export async function generateBalanceSheetPDF(data: BalanceSheetData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `balance-sheet-${data.date}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`reports/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);
      
      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(COMPANY_INFO.address, 50, 80);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(20)
        .text("Balance Sheet (تەرازوی دارایی)", 50, 120);

      doc.fillColor(COLORS.gray)
        .fontSize(12)
        .text(`As of ${data.date}`, 50, 148);

      // Assets Section
      let yPos = 190;
      doc.fillColor(COLORS.success)
        .fontSize(16)
        .text("Assets (دراوە)", 50, yPos);

      yPos += 30;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.lightGray)
        .fill();
      doc.fillColor(COLORS.dark)
        .fontSize(10)
        .text("Cash (نەقد)", 60, yPos + 8)
        .text(`$${data.assets.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor("white")
        .fill();
      doc.fillColor(COLORS.dark)
        .text("Bank Accounts (بانک)", 60, yPos + 8)
        .text(`$${data.assets.bank.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.lightGray)
        .fill();
      doc.fillColor(COLORS.dark)
        .text("Accounts Receivable (قەرزی کڕیاران)", 60, yPos + 8)
        .text(`$${data.assets.receivables.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 30;
      doc.rect(50, yPos, 495, 30)
        .fillColor("#dcfce7")
        .fill();
      doc.fillColor(COLORS.success)
        .fontSize(12)
        .text("Total Assets (کۆی دراوە)", 60, yPos + 9)
        .fontSize(14)
        .text(`$${data.assets.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 430, yPos + 9, { align: "right", width: 105 });

      // Liabilities Section
      yPos += 50;
      doc.fillColor(COLORS.danger)
        .fontSize(16)
        .text("Liabilities (قەرز)", 50, yPos);

      yPos += 30;
      data.liabilities.debts.forEach((debt, index) => {
        const bgColor = index % 2 === 0 ? COLORS.lightGray : "white";
        doc.rect(50, yPos, 495, 25)
          .fillColor(bgColor)
          .fill();
        doc.fillColor(COLORS.dark)
          .fontSize(10)
          .text(debt.name, 60, yPos + 8)
          .text(`$${debt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });
        yPos += 25;
      });

      if (data.liabilities.debts.length === 0) {
        doc.rect(50, yPos, 495, 25)
          .fillColor(COLORS.lightGray)
          .fill();
        doc.fillColor(COLORS.gray)
          .fontSize(10)
          .text("No debts recorded", 60, yPos + 8);
        yPos += 25;
      }

      doc.rect(50, yPos, 495, 30)
        .fillColor("#fee2e2")
        .fill();
      doc.fillColor(COLORS.danger)
        .fontSize(12)
        .text("Total Liabilities (کۆی قەرز)", 60, yPos + 9)
        .fontSize(14)
        .text(`$${data.liabilities.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 430, yPos + 9, { align: "right", width: 105 });

      // Equity Section
      yPos += 50;
      doc.fillColor(COLORS.primary)
        .fontSize(16)
        .text("Equity (سەرمایە)", 50, yPos);

      yPos += 30;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.lightGray)
        .fill();
      doc.fillColor(COLORS.dark)
        .fontSize(10)
        .text("Partner Capital (سەرمایەی شەریکان)", 60, yPos + 8)
        .text(`$${data.equity.partnerCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor("white")
        .fill();
      doc.fillColor(COLORS.dark)
        .text("Retained Earnings (قازانجی کۆگاکراو)", 60, yPos + 8)
        .text(`$${data.equity.retainedEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

      yPos += 30;
      doc.rect(50, yPos, 495, 30)
        .fillColor("#dbeafe")
        .fill();
      doc.fillColor(COLORS.primary)
        .fontSize(12)
        .text("Total Equity (کۆی سەرمایە)", 60, yPos + 9)
        .fontSize(14)
        .text(`$${data.equity.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 430, yPos + 9, { align: "right", width: 105 });

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

interface PartnerReportData {
  partner: {
    name: string;
    ownershipPercentage: number;
  };
  startDate: string;
  endDate: string;
  openingBalance: number;
  transactions: Array<{
    date: string;
    type: string;
    description: string;
    amount: number;
    balance: number;
  }>;
  closingBalance: number;
  profitShare: number;
}

export async function generatePartnerReportPDF(data: PartnerReportData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `partner-report-${data.partner.name.replace(/\s+/g, '-')}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`reports/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(20)
        .text("Partner Statement (حسابی شەریک)", 50, 100);

      // Partner Info Box
      doc.rect(50, 140, 495, 70)
        .fillColor(COLORS.lightGray)
        .fill();

      doc.fillColor(COLORS.dark)
        .fontSize(14)
        .text(data.partner.name, 60, 155);

      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`Ownership: ${data.partner.ownershipPercentage}%`, 60, 175)
        .text(`Period: ${data.startDate} - ${data.endDate}`, 60, 190);

      // Opening Balance
      let yPos = 230;
      doc.rect(50, yPos, 495, 30)
        .fillColor("#dbeafe")
        .fill();
      doc.fillColor(COLORS.primary)
        .fontSize(11)
        .text("Opening Balance (باڵانسی سەرەتا)", 60, yPos + 9)
        .text(`$${data.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 430, yPos + 9, { align: "right", width: 105 });

      // Transactions Table
      yPos += 50;
      doc.fillColor(COLORS.dark)
        .fontSize(14)
        .text("Transactions (گواستنەوەکان)", 50, yPos);

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(9)
        .text("Date", 60, yPos + 8)
        .text("Type", 130, yPos + 8)
        .text("Description", 220, yPos + 8)
        .text("Amount", 380, yPos + 8)
        .text("Balance", 460, yPos + 8);

      yPos += 25;
      data.transactions.forEach((txn, index) => {
        const bgColor = index % 2 === 0 ? "white" : COLORS.lightGray;
        doc.rect(50, yPos, 495, 22)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(8)
          .text(txn.date, 60, yPos + 7)
          .text(txn.type, 130, yPos + 7)
          .text(txn.description.substring(0, 25), 220, yPos + 7);

        const amountColor = txn.amount >= 0 ? COLORS.success : COLORS.danger;
        doc.fillColor(amountColor)
          .text(`${txn.amount >= 0 ? '+' : ''}$${txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 370, yPos + 7, { align: "right", width: 60 });

        doc.fillColor(COLORS.dark)
          .text(`$${txn.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 7, { align: "right", width: 85 });

        yPos += 22;
      });

      // Closing Balance
      yPos += 20;
      const closingColor = data.closingBalance >= 0 ? COLORS.success : COLORS.danger;
      const closingBg = data.closingBalance >= 0 ? "#dcfce7" : "#fee2e2";
      
      doc.rect(50, yPos, 495, 35)
        .fillColor(closingBg)
        .fill();

      doc.fillColor(closingColor)
        .fontSize(12)
        .text("Closing Balance (باڵانسی کۆتایی)", 60, yPos + 10)
        .fontSize(16)
        .text(`$${data.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 420, yPos + 10, { align: "right", width: 115 });

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 750)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

interface ExpenseReportData {
  month: string;
  year: number;
  totalExpenses: number;
  byCategory: Array<{
    category: string;
    color: string;
    amount: number;
    percentage: number;
  }>;
  expenses: Array<{
    date: string;
    category: string;
    description: string;
    vendor: string;
    amount: number;
  }>;
}

export async function generateExpenseReportPDF(data: ExpenseReportData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `expense-report-${data.year}-${data.month}-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`reports/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(20)
        .text("Expense Report (ڕاپۆرتی مەسروفات)", 50, 100);

      doc.fillColor(COLORS.gray)
        .fontSize(12)
        .text(`${data.month} ${data.year}`, 50, 128);

      // Total Box
      doc.rect(50, 160, 495, 50)
        .fillColor("#fee2e2")
        .fill();

      doc.fillColor(COLORS.danger)
        .fontSize(12)
        .text("Total Expenses (کۆی مەسروفات)", 60, 175)
        .fontSize(24)
        .text(`$${data.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 350, 170, { align: "right", width: 185 });

      // Category Breakdown
      let yPos = 230;
      doc.fillColor(COLORS.dark)
        .fontSize(14)
        .text("By Category (بە پۆل)", 50, yPos);

      yPos += 25;
      data.byCategory.forEach((cat, index) => {
        const bgColor = index % 2 === 0 ? COLORS.lightGray : "white";
        doc.rect(50, yPos, 495, 25)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(10)
          .text(cat.category, 60, yPos + 8)
          .text(`${cat.percentage.toFixed(1)}%`, 350, yPos + 8)
          .text(`$${cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 8, { align: "right", width: 85 });

        yPos += 25;
      });

      // Expense Details Table
      yPos += 30;
      doc.fillColor(COLORS.dark)
        .fontSize(14)
        .text("Expense Details (وردەکاری مەسروفات)", 50, yPos);

      yPos += 25;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(9)
        .text("Date", 60, yPos + 8)
        .text("Category", 130, yPos + 8)
        .text("Description", 230, yPos + 8)
        .text("Vendor", 350, yPos + 8)
        .text("Amount", 460, yPos + 8);

      yPos += 25;
      const maxRows = Math.min(data.expenses.length, 15);
      for (let i = 0; i < maxRows; i++) {
        const expense = data.expenses[i];
        const bgColor = i % 2 === 0 ? "white" : COLORS.lightGray;
        doc.rect(50, yPos, 495, 20)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(8)
          .text(expense.date, 60, yPos + 6)
          .text(expense.category.substring(0, 15), 130, yPos + 6)
          .text(expense.description.substring(0, 20), 230, yPos + 6)
          .text(expense.vendor.substring(0, 15), 350, yPos + 6);

        doc.fillColor(COLORS.danger)
          .text(`$${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 450, yPos + 6, { align: "right", width: 85 });

        yPos += 20;
      }

      if (data.expenses.length > 15) {
        doc.fillColor(COLORS.gray)
          .fontSize(9)
          .text(`... and ${data.expenses.length - 15} more expenses`, 50, yPos + 10);
      }

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 750)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

interface DebtScheduleData {
  totalDebt: number;
  debts: Array<{
    creditor: string;
    type: string;
    originalAmount: number;
    remainingAmount: number;
    interestRate: number;
    dueDate: string;
    monthlyPayment: number;
  }>;
}

export async function generateDebtSchedulePDF(data: DebtScheduleData): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const fileName = `debt-schedule-${nanoid(6)}.pdf`;
          const { url } = await storagePut(`reports/${fileName}`, pdfBuffer, "application/pdf");
          resolve(url);
        } catch (err) {
          reject(err);
        }
      });

      // Header
      doc.fillColor(COLORS.primary)
        .fontSize(24)
        .text(COMPANY_INFO.name, 50, 50);

      // Title
      doc.fillColor(COLORS.dark)
        .fontSize(20)
        .text("Debt Schedule (خشتەی قەرز)", 50, 100);

      doc.fillColor(COLORS.gray)
        .fontSize(10)
        .text(`As of ${new Date().toLocaleDateString()}`, 50, 128);

      // Total Debt Box
      doc.rect(50, 160, 495, 50)
        .fillColor("#fee2e2")
        .fill();

      doc.fillColor(COLORS.danger)
        .fontSize(12)
        .text("Total Outstanding Debt (کۆی قەرزی ماوە)", 60, 175)
        .fontSize(24)
        .text(`$${data.totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 350, 170, { align: "right", width: 185 });

      // Debts Table
      let yPos = 230;
      doc.rect(50, yPos, 495, 25)
        .fillColor(COLORS.primary)
        .fill();

      doc.fillColor("white")
        .fontSize(8)
        .text("Creditor", 55, yPos + 8)
        .text("Type", 130, yPos + 8)
        .text("Original", 180, yPos + 8)
        .text("Remaining", 250, yPos + 8)
        .text("Interest", 330, yPos + 8)
        .text("Due Date", 390, yPos + 8)
        .text("Monthly", 470, yPos + 8);

      yPos += 25;
      data.debts.forEach((debt, index) => {
        const bgColor = index % 2 === 0 ? "white" : COLORS.lightGray;
        doc.rect(50, yPos, 495, 25)
          .fillColor(bgColor)
          .fill();

        doc.fillColor(COLORS.dark)
          .fontSize(8)
          .text(debt.creditor.substring(0, 15), 55, yPos + 8)
          .text(debt.type, 130, yPos + 8)
          .text(`$${debt.originalAmount.toLocaleString()}`, 180, yPos + 8)
          .text(`$${debt.remainingAmount.toLocaleString()}`, 250, yPos + 8)
          .text(`${debt.interestRate}%`, 330, yPos + 8)
          .text(debt.dueDate, 390, yPos + 8)
          .text(`$${debt.monthlyPayment.toLocaleString()}`, 470, yPos + 8);

        yPos += 25;
      });

      if (data.debts.length === 0) {
        doc.fillColor(COLORS.gray)
          .fontSize(12)
          .text("No outstanding debts", 50, yPos + 20, { align: "center", width: 495 });
      }

      // Footer
      doc.fillColor(COLORS.gray)
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 750)
        .text(`${COMPANY_INFO.name} - ${COMPANY_INFO.website}`, 50, 750, { align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
