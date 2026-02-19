/**
 * Shared label print utilities — uses label template settings (from DB/settings)
 * and generates HTML for printing. Used by LabelPrinting page and BatchFinancialReport modal.
 */

export interface LabelTemplateForPrint {
  widthMm?: number | null;
  heightMm?: number | null;
  primaryColor?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  showQrCode?: boolean | null;
  qrCodeSize?: number | null;
  qrCodePosition?: string | null;
  showLogo?: boolean | null;
  showTrackingNumber?: boolean | null;
  showCustomerName?: boolean | null;
  showCustomerCode?: boolean | null;
  showCustomerPhone?: boolean | null;
  showDestinationCity?: boolean | null;
  showWeight?: boolean | null;
  showDimensions?: boolean | null;
  showShippingType?: boolean | null;
  showBatchNumber?: boolean | null;
  showDate?: boolean | null;
  showPrice?: boolean | null;
}

export interface PackageForLabel {
  trackingNumber?: string | null;
  weightKg?: number | null;
  volumeCbm?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  calculatedCostUsd?: number | null;
  shippingType?: string | null;
}

export interface CustomerForLabel {
  name: string;
  code?: string | null;
  phone?: string | null;
  city?: string | null;
}

export interface BatchForLabel {
  batchCode?: string | null;
  shippingType?: string | null;
}

export interface CompanyForLabel {
  name: string;
}

const defaultTemplate: Required<Omit<LabelTemplateForPrint, 'fontFamily'>> & { fontFamily: string } = {
  widthMm: 100,
  heightMm: 150,
  primaryColor: "#0ea5e9",
  fontFamily: "Arial",
  fontSize: 12,
  showQrCode: true,
  qrCodeSize: 80,
  qrCodePosition: "top-right",
  showLogo: true,
  showTrackingNumber: true,
  showCustomerName: true,
  showCustomerCode: true,
  showCustomerPhone: true,
  showDestinationCity: true,
  showWeight: true,
  showDimensions: false,
  showShippingType: true,
  showBatchNumber: true,
  showDate: true,
  showPrice: false,
};

function getTemplateWithDefaults(template: LabelTemplateForPrint | null | undefined): typeof defaultTemplate {
  if (!template) return defaultTemplate;
  return {
    widthMm: template.widthMm ?? defaultTemplate.widthMm,
    heightMm: template.heightMm ?? defaultTemplate.heightMm,
    primaryColor: template.primaryColor ?? defaultTemplate.primaryColor,
    fontFamily: template.fontFamily ?? defaultTemplate.fontFamily,
    fontSize: template.fontSize ?? defaultTemplate.fontSize,
    showQrCode: template.showQrCode ?? defaultTemplate.showQrCode,
    qrCodeSize: template.qrCodeSize ?? defaultTemplate.qrCodeSize,
    qrCodePosition: template.qrCodePosition ?? defaultTemplate.qrCodePosition,
    showLogo: template.showLogo ?? defaultTemplate.showLogo,
    showTrackingNumber: template.showTrackingNumber ?? defaultTemplate.showTrackingNumber,
    showCustomerName: template.showCustomerName ?? defaultTemplate.showCustomerName,
    showCustomerCode: template.showCustomerCode ?? defaultTemplate.showCustomerCode,
    showCustomerPhone: template.showCustomerPhone ?? defaultTemplate.showCustomerPhone,
    showDestinationCity: template.showDestinationCity ?? defaultTemplate.showDestinationCity,
    showWeight: template.showWeight ?? defaultTemplate.showWeight,
    showDimensions: template.showDimensions ?? defaultTemplate.showDimensions,
    showShippingType: template.showShippingType ?? defaultTemplate.showShippingType,
    showBatchNumber: template.showBatchNumber ?? defaultTemplate.showBatchNumber,
    showDate: template.showDate ?? defaultTemplate.showDate,
    showPrice: template.showPrice ?? defaultTemplate.showPrice,
  };
}

function shippingTypeLabel(st?: string | null): string {
  if (st === "sea") return "Sea";
  if (st === "air_regular") return "Air";
  return "Air Irregular";
}

/**
 * Generates full HTML document for printing labels (one label per package)
 * using template settings. Caller must provide qrCodesMap (trackingNumber -> data URL).
 * customer: one object for all packages, or array of same length as packages (one per package).
 */
export function generateLabelsHtml(options: {
  template: LabelTemplateForPrint | null | undefined;
  packages: PackageForLabel[];
  customer: CustomerForLabel | CustomerForLabel[];
  batch: BatchForLabel;
  company: CompanyForLabel;
  qrCodesMap: Record<string, string>;
}): string {
  const { template, packages, customer, batch, company, qrCodesMap } = options;
  const t = getTemplateWithDefaults(template);
  const batchCode = batch.batchCode ?? "N/A";
  const shipType = batch.shippingType ?? "";
  const isArray = Array.isArray(customer);
  const getCustomer = (i: number): CustomerForLabel =>
    isArray ? (customer as CustomerForLabel[])[i] ?? { name: "N/A" } : (customer as CustomerForLabel);

  const labelsHtml = packages
    .map((pkg, i) => {
      const cust = getCustomer(i);
      const tracking = pkg.trackingNumber || "N/A";
      const qrData = tracking !== "N/A" ? qrCodesMap[tracking] : null;
      const weight = pkg.weightKg ?? 0;
      const pkgShipType = pkg.shippingType ?? shipType;
      const dimensions =
        t.showDimensions && pkg.lengthCm != null && pkg.widthCm != null && pkg.heightCm != null
          ? `${pkg.lengthCm}×${pkg.widthCm}×${pkg.heightCm} cm`
          : "";

      return `
      <div class="label" style="
        width: ${t.widthMm}mm;
        height: ${t.heightMm}mm;
        border: 1px solid #ccc;
        padding: 4mm;
        margin: 2mm;
        page-break-inside: avoid;
        display: inline-block;
        vertical-align: top;
        box-sizing: border-box;
        font-family: ${t.fontFamily}, sans-serif;
        font-size: ${t.fontSize}pt;
        position: relative;
      ">
        ${t.showLogo ? `
          <div style="display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${t.primaryColor}" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span style="font-weight: bold; color: ${t.primaryColor};">${company.name}</span>
          </div>
        ` : ""}
        
        ${t.showQrCode && qrData ? `
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
        
        ${t.showTrackingNumber ? `
          <div style="text-align: center; padding: 2mm 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; margin: 2mm 0;">
            <div style="font-size: 8pt; color: #666;">Tracking Number</div>
            <div style="font-weight: bold; font-size: 12pt; color: ${t.primaryColor};">${tracking}</div>
          </div>
        ` : ""}
        
        <div style="margin-top: 2mm;">
          ${t.showCustomerName ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">👤</span>
              <span style="font-weight: 500;">${cust.name || "N/A"}</span>
            </div>
          ` : ""}
          
          ${t.showCustomerCode ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">#</span>
              <span>${cust.code ?? "N/A"}</span>
            </div>
          ` : ""}
          
          ${t.showCustomerPhone ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">📱</span>
              <span>${cust.phone ?? "N/A"}</span>
            </div>
          ` : ""}
          
          ${t.showDestinationCity ? `
            <div style="display: flex; align-items: center; gap: 1mm; margin-bottom: 1mm;">
              <span style="color: #666;">📍</span>
              <span style="font-weight: 500;">${cust.city ?? "N/A"}</span>
            </div>
          ` : ""}
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1mm; font-size: 9pt; border-top: 1px solid #eee; padding-top: 2mm; margin-top: 2mm;">
          ${t.showWeight ? `<div>⚖️ ${weight} kg</div>` : ""}
          ${t.showShippingType ? `<div>🚚 ${shippingTypeLabel(pkgShipType)}</div>` : ""}
          ${t.showBatchNumber ? `<div>📦 ${batchCode}</div>` : ""}
          ${t.showDate ? `<div>📅 ${new Date().toLocaleDateString()}</div>` : ""}
          ${t.showPrice && pkg.calculatedCostUsd != null ? `<div>$${Number(pkg.calculatedCostUsd).toFixed(2)}</div>` : ""}
          ${dimensions ? `<div>📐 ${dimensions}</div>` : ""}
        </div>
      </div>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Labels - ${company.name}</title>
      <style>
        @page {
          size: A4;
          margin: 5mm;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: ${t.fontFamily}, sans-serif;
        }
        .labels-container {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
        }
      </style>
    </head>
    <body>
      <div class="labels-container">
        ${labelsHtml}
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `;
}

/**
 * Opens a new window and prints the label HTML (same as existing openPrintWindow pattern).
 */
export function openLabelPrintWindow(html: string): void {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  }
}
