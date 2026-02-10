import PDFDocument from "pdfkit";
import { Readable } from "stream";

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  
  // Company info
  companyName: string;
  companyNameKu?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyLogo?: string;
  
  // Customer info
  customerName: string;
  customerCode?: string;
  customerPhone?: string;
  customerAddress?: string;
  
  // Invoice items
  items: Array<{
    description: string;
    descriptionKu?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  
  // Totals
  subtotal: number;
  tax?: number;
  taxRate?: number;
  total: number;
  currency: string;
  
  // Additional info
  notes?: string;
  notesKu?: string;
  paymentMethod?: string;
  referenceNumber?: string;
}

/**
 * Generate PDF invoice and return as Buffer
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      bufferPages: true,
    });

    const buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(data.companyName, 50, 50);
    
    if (data.companyNameKu) {
      doc.fontSize(16).text(data.companyNameKu, 50, 75);
    }

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(data.companyAddress || "", 50, data.companyNameKu ? 95 : 75)
      .text(data.companyPhone || "", 50, data.companyNameKu ? 110 : 90)
      .text(data.companyEmail || "", 50, data.companyNameKu ? 125 : 105);

    // Invoice title
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("INVOICE", 400, 50, { align: "right" });
    
    doc
      .fontSize(16)
      .text("وەسڵ", 400, 80, { align: "right" });

    // Invoice details
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Invoice #: ${data.invoiceNumber}`, 400, 110, { align: "right" })
      .text(`Date: ${data.invoiceDate.toLocaleDateString()}`, 400, 125, { align: "right" });

    if (data.dueDate) {
      doc.text(`Due Date: ${data.dueDate.toLocaleDateString()}`, 400, 140, { align: "right" });
    }

    // Customer info
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Bill To:", 50, 180);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(data.customerName, 50, 200)
      .text(data.customerCode || "", 50, 215)
      .text(data.customerPhone || "", 50, 230)
      .text(data.customerAddress || "", 50, 245);

    // Table header
    const tableTop = 300;
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Description", 50, tableTop)
      .text("Qty", 300, tableTop, { width: 50, align: "right" })
      .text("Unit Price", 360, tableTop, { width: 80, align: "right" })
      .text("Total", 450, tableTop, { width: 100, align: "right" });

    // Draw line
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    // Table rows
    let yPosition = tableTop + 25;
    doc.font("Helvetica");

    for (const item of data.items) {
      doc
        .text(item.description, 50, yPosition, { width: 240 })
        .text(item.quantity.toString(), 300, yPosition, { width: 50, align: "right" })
        .text(`${data.currency} ${item.unitPrice.toFixed(2)}`, 360, yPosition, { width: 80, align: "right" })
        .text(`${data.currency} ${item.total.toFixed(2)}`, 450, yPosition, { width: 100, align: "right" });

      yPosition += 20;

      // Add Kurdish description if available
      if (item.descriptionKu) {
        doc
          .fontSize(9)
          .fillColor("#666")
          .text(item.descriptionKu, 50, yPosition, { width: 240 });
        doc.fillColor("#000").fontSize(10);
        yPosition += 15;
      }
    }

    // Draw line before totals
    yPosition += 10;
    doc
      .moveTo(350, yPosition)
      .lineTo(550, yPosition)
      .stroke();

    // Totals
    yPosition += 15;
    doc
      .font("Helvetica")
      .text("Subtotal:", 350, yPosition)
      .text(`${data.currency} ${data.subtotal.toFixed(2)}`, 450, yPosition, { width: 100, align: "right" });

    if (data.tax && data.tax > 0) {
      yPosition += 20;
      doc
        .text(`Tax (${data.taxRate || 0}%):`, 350, yPosition)
        .text(`${data.currency} ${data.tax.toFixed(2)}`, 450, yPosition, { width: 100, align: "right" });
    }

    yPosition += 20;
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Total:", 350, yPosition)
      .text(`${data.currency} ${data.total.toFixed(2)}`, 450, yPosition, { width: 100, align: "right" });

    // Payment info
    if (data.paymentMethod) {
      yPosition += 40;
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Payment Method: ${data.paymentMethod}`, 50, yPosition);
    }

    if (data.referenceNumber) {
      yPosition += 15;
      doc.text(`Reference: ${data.referenceNumber}`, 50, yPosition);
    }

    // Notes
    if (data.notes || data.notesKu) {
      yPosition += 40;
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Notes:", 50, yPosition);

      yPosition += 15;
      doc.font("Helvetica");
      if (data.notes) {
        doc.text(data.notes, 50, yPosition, { width: 500 });
        yPosition += 30;
      }
      if (data.notesKu) {
        doc.text(data.notesKu, 50, yPosition, { width: 500 });
      }
    }

    // Footer
    const footerTop = 750;
    doc
      .fontSize(8)
      .fillColor("#666")
      .text("Thank you for your business!", 50, footerTop, { align: "center", width: 500 })
      .text("سوپاس بۆ کارەکەتان!", 50, footerTop + 12, { align: "center", width: 500 });

    doc.end();
  });
}

/**
 * Generate invoice for package charge
 */
export async function generatePackageInvoice(params: {
  invoiceNumber: string;
  customerName: string;
  customerCode: string;
  packageTracking: string;
  weight: number;
  priceUsd: number;
  currency: string;
}): Promise<Buffer> {
  const data: InvoiceData = {
    invoiceNumber: params.invoiceNumber,
    invoiceDate: new Date(),
    companyName: "Wazn Express",
    companyNameKu: "وەزن ئێکسپرێس",
    companyAddress: "Iraq, Kurdistan",
    companyPhone: "+964 XXX XXX XXXX",
    companyEmail: "info@waznexpress.com",
    customerName: params.customerName,
    customerCode: params.customerCode,
    items: [
      {
        description: `Package Delivery - ${params.packageTracking}`,
        descriptionKu: `گەیاندنی پاکێج - ${params.packageTracking}`,
        quantity: 1,
        unitPrice: params.priceUsd,
        total: params.priceUsd,
      },
    ],
    subtotal: params.priceUsd,
    total: params.priceUsd,
    currency: params.currency,
    notes: `Weight: ${params.weight} kg`,
    notesKu: `کێش: ${params.weight} کیلۆگرام`,
  };

  return generateInvoicePDF(data);
}

/**
 * Generate receipt for payment received
 */
export async function generatePaymentReceipt(params: {
  invoiceNumber: string;
  customerName: string;
  customerCode: string;
  amountUsd: number;
  currency: string;
  paymentMethod: string;
  referenceNumber?: string;
  balanceAfter: number;
}): Promise<Buffer> {
  const data: InvoiceData = {
    invoiceNumber: params.invoiceNumber,
    invoiceDate: new Date(),
    companyName: "Wazn Express",
    companyNameKu: "وەزن ئێکسپرێس",
    companyAddress: "Iraq, Kurdistan",
    companyPhone: "+964 XXX XXX XXXX",
    companyEmail: "info@waznexpress.com",
    customerName: params.customerName,
    customerCode: params.customerCode,
    items: [
      {
        description: "Payment Received",
        descriptionKu: "پارەدان وەرگیراوە",
        quantity: 1,
        unitPrice: params.amountUsd,
        total: params.amountUsd,
      },
    ],
    subtotal: params.amountUsd,
    total: params.amountUsd,
    currency: params.currency,
    paymentMethod: params.paymentMethod,
    referenceNumber: params.referenceNumber,
    notes: `Balance After Payment: ${params.currency} ${params.balanceAfter.toFixed(2)}`,
    notesKu: `باڵانس دوای پارەدان: ${params.currency} ${params.balanceAfter.toFixed(2)}`,
  };

  return generateInvoicePDF(data);
}
