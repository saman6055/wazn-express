/**
 * Unified PDF service — single entry point for all PDF generation.
 * Re-exports: package label/invoice/batch financial, dashboard, and report PDFs.
 */

export {
  generateBatchFinancialPDF,
  generateInvoicePDF,
  generateCustomerStatementPDF,
  generateProfitLossPDF,
  generateBalanceSheetPDF,
  generatePartnerReportPDF,
  generateExpenseReportPDF,
  generateDebtSchedulePDF,
} from "./pdf-generator";

export {
  getDashboardReportData,
  generateDashboardPDF,
  getTemplateSettings,
  applyTemplateHeader,
  applyTemplateFooter,
} from "./pdfGenerator";

export {
  getCustomerReportData,
  generateCustomerPDF,
  getBatchReportData,
  generateBatchPDF,
  getDateFilteredDashboardData,
  generateDateFilteredDashboardPDF,
} from "./pdfReports";
