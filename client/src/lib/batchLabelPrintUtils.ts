/**
 * Batch label print — یەک لەیبڵ بۆ هەر کڕیار لە باچ (کۆی پاکەت، حەجم، کیلۆ، بارکۆد/QR، نرخ، ناوی کڕیار)
 */

export interface BatchLabelTemplateForPrint {
  widthMm?: number | null;
  heightMm?: number | null;
  primaryColor?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  showQrCode?: boolean | null;
  qrCodeSize?: number | null;
  qrCodePosition?: string | null;
  showBarcode?: boolean | null;
  showLogo?: boolean | null;
  showCustomerName?: boolean | null;
  showCustomerCode?: boolean | null;
  showTotalPackages?: boolean | null;
  showTotalWeight?: boolean | null;
  showTotalVolume?: boolean | null;
  showTotalPrice?: boolean | null;
  showBatchNumber?: boolean | null;
  showDate?: boolean | null;
}

export interface CustomerSummaryForBatchLabel {
  customerId: number;
  name: string;
  code?: string | null;
  totalPackages: number;
  totalWeight: number;  // KG (chargeable or actual)
  totalVolume: number;  // CBM for sea
  totalPrice: number;
}

export interface BatchForBatchLabel {
  batchCode?: string | null;
  shippingType?: string | null;
}

const defaultBatchTemplate = {
  widthMm: 100,
  heightMm: 150,
  primaryColor: "#059669",
  fontFamily: "Arial",
  fontSize: 12,
  showQrCode: true,
  qrCodeSize: 80,
  qrCodePosition: "top-right" as const,
  showBarcode: true,
  showLogo: true,
  showCustomerName: true,
  showCustomerCode: true,
  showTotalPackages: true,
  showTotalWeight: true,
  showTotalVolume: true,
  showTotalPrice: true,
  showBatchNumber: true,
  showDate: true,
};

function getTemplateWithDefaults(t: BatchLabelTemplateForPrint | null | undefined): typeof defaultBatchTemplate {
  if (!t) return defaultBatchTemplate;
  return {
    widthMm: t.widthMm ?? defaultBatchTemplate.widthMm,
    heightMm: t.heightMm ?? defaultBatchTemplate.heightMm,
    primaryColor: t.primaryColor ?? defaultBatchTemplate.primaryColor,
    fontFamily: t.fontFamily ?? defaultBatchTemplate.fontFamily,
    fontSize: t.fontSize ?? defaultBatchTemplate.fontSize,
    showQrCode: t.showQrCode ?? defaultBatchTemplate.showQrCode,
    qrCodeSize: t.qrCodeSize ?? defaultBatchTemplate.qrCodeSize,
    qrCodePosition: (t.qrCodePosition ?? defaultBatchTemplate.qrCodePosition) as "top-right",
    showBarcode: t.showBarcode ?? defaultBatchTemplate.showBarcode,
    showLogo: t.showLogo ?? defaultBatchTemplate.showLogo,
    showCustomerName: t.showCustomerName ?? defaultBatchTemplate.showCustomerName,
    showCustomerCode: t.showCustomerCode ?? defaultBatchTemplate.showCustomerCode,
    showTotalPackages: t.showTotalPackages ?? defaultBatchTemplate.showTotalPackages,
    showTotalWeight: t.showTotalWeight ?? defaultBatchTemplate.showTotalWeight,
    showTotalVolume: t.showTotalVolume ?? defaultBatchTemplate.showTotalVolume,
    showTotalPrice: t.showTotalPrice ?? defaultBatchTemplate.showTotalPrice,
    showBatchNumber: t.showBatchNumber ?? defaultBatchTemplate.showBatchNumber,
    showDate: t.showDate ?? defaultBatchTemplate.showDate,
  };
}

/** key: customerId or "code-{code}" for QR data URL */
export function generateBatchLabelsHtml(options: {
  template: BatchLabelTemplateForPrint | null | undefined;
  customers: CustomerSummaryForBatchLabel[];
  batch: BatchForBatchLabel;
  company: { name: string };
  qrCodesMap: Record<string, string>;
}): string {
  const { template, customers, batch, company, qrCodesMap } = options;
  const t = getTemplateWithDefaults(template);
  const batchCode = batch.batchCode ?? "N/A";
  const isSea = batch.shippingType === "sea";

  const labelsHtml = customers
    .map((cust) => {
      const qrKey = `${cust.customerId}`;
      const qrData = qrCodesMap[qrKey] ?? qrCodesMap[cust.code ?? ""] ?? null;
      const showQr = (t.showQrCode || t.showBarcode) && qrData;

      return `
      <div class="label" style="
        width: ${t.widthMm}mm;
        height: ${t.heightMm}mm;
        border: 2px solid ${t.primaryColor};
        padding: 4mm;
        margin: 2mm;
        page-break-inside: avoid;
        display: inline-block;
        vertical-align: top;
        box-sizing: border-box;
        font-family: ${t.fontFamily}, sans-serif;
        font-size: ${t.fontSize}pt;
        position: relative;
        border-radius: 8px;
      ">
        ${t.showLogo ? `
          <div style="display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm;">
            <span style="font-weight: bold; color: ${t.primaryColor};">${company.name}</span>
          </div>
        ` : ""}
        
        ${showQr ? `
          <div style="
            position: absolute;
            ${t.qrCodePosition === "top-left" ? "top: 4mm; left: 4mm;" : ""}
            ${t.qrCodePosition === "top-right" ? "top: 4mm; right: 4mm;" : ""}
            ${t.qrCodePosition === "bottom-left" ? "bottom: 4mm; left: 4mm;" : ""}
            ${t.qrCodePosition === "bottom-right" ? "bottom: 4mm; right: 4mm;" : ""}
            ${t.qrCodePosition === "center" ? "top: 50%; left: 50%; transform: translate(-50%, -50%);" : ""}
          ">
            <img src="${qrData}" style="width: ${t.qrCodeSize}px; height: ${t.qrCodeSize}px;" />
          </div>
        ` : ""}
        
        <div style="margin-top: 2mm; padding-top: 2mm;">
          ${t.showCustomerName ? `
            <div style="margin-bottom: 2mm;">
              <div style="font-size: 8pt; color: #666;">ناوی کڕیار</div>
              <div style="font-weight: bold; font-size: 11pt; color: ${t.primaryColor};">${cust.name || "N/A"}</div>
            </div>
          ` : ""}
          ${t.showCustomerCode ? `
            <div style="margin-bottom: 2mm;">
              <div style="font-size: 8pt; color: #666;">کۆد</div>
              <div style="font-weight: 600;">${cust.code ?? "N/A"}</div>
            </div>
          ` : ""}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; font-size: 9pt; border-top: 1px solid #eee; padding-top: 2mm; margin-top: 2mm;">
          ${t.showTotalPackages ? `<div>📦 کۆی پاکەت: <strong>${cust.totalPackages}</strong></div>` : ""}
          ${t.showTotalWeight && !isSea ? `<div>⚖️ کیلۆ: <strong>${cust.totalWeight.toFixed(2)}</strong></div>` : ""}
          ${t.showTotalVolume && isSea ? `<div>📐 حەجم (CBM): <strong>${cust.totalVolume.toFixed(3)}</strong></div>` : ""}
          ${t.showTotalWeight && isSea ? `<div>⚖️ کیلۆ: <strong>${cust.totalWeight.toFixed(2)}</strong></div>` : ""}
          ${t.showTotalPrice ? `<div>💰 نرخ: <strong>$${cust.totalPrice.toFixed(2)}</strong></div>` : ""}
          ${t.showBatchNumber ? `<div>📋 باچ: <strong>${batchCode}</strong></div>` : ""}
          ${t.showDate ? `<div>📅 ${new Date().toLocaleDateString("ku-IQ")}</div>` : ""}
        </div>
      </div>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>لەیبڵی باچ - ${company.name}</title>
      <style>
        @page { size: A4; margin: 5mm; }
        body { margin: 0; padding: 0; font-family: ${t.fontFamily}, sans-serif; }
        .labels-container { display: flex; flex-wrap: wrap; justify-content: flex-start; }
      </style>
    </head>
    <body>
      <div class="labels-container">${labelsHtml}</div>
      <script>
        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
      </script>
    </body>
    </html>
  `;
}

export function openBatchLabelPrintWindow(html: string): void {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }
}
