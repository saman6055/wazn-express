import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download } from "lucide-react";

interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  title?: string;
  subtitle?: string;
}

// Export to Excel
export function exportToExcel(data: ExportData, filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([
    data.title ? [data.title] : [],
    data.subtitle ? [data.subtitle] : [],
    [],
    data.headers,
    ...data.rows
  ].filter(row => row.length > 0));

  // Set column widths
  const colWidths = data.headers.map((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...data.rows.map(row => String(row[i] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Export to CSV
export function exportToCSV(data: ExportData, filename: string) {
  let csv = '';
  
  if (data.title) {
    csv += data.title + '\n';
  }
  if (data.subtitle) {
    csv += data.subtitle + '\n';
  }
  if (data.title || data.subtitle) {
    csv += '\n';
  }
  
  csv += data.headers.join(',') + '\n';
  csv += data.rows.map(row => 
    row.map(cell => {
      const str = String(cell);
      // Escape quotes and wrap in quotes if contains comma
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

// Generate PDF (using print)
export function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>${filename}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          direction: rtl;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: right;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          color: #333;
        }
        .header p {
          color: #666;
          margin: 5px 0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        .stat-card {
          border: 1px solid #ddd;
          padding: 15px;
          text-align: center;
          border-radius: 8px;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      ${element.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

// Export buttons component
interface ExportButtonsProps {
  data: ExportData;
  filename: string;
  pdfElementId?: string;
  showPDF?: boolean;
}

export function ExportButtons({ data, filename, pdfElementId, showPDF = true }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToExcel(data, filename)}
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToCSV(data, filename)}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        CSV
      </Button>
      {showPDF && pdfElementId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToPDF(pdfElementId, filename)}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          PDF
        </Button>
      )}
    </div>
  );
}

// Format currency for export
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
}

// Format date for export
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
