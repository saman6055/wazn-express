import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { 
  Printer, 
  Download, 
  ArrowRight, 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  MapPin,
  FileText,
  Calendar,
  User,
  Package,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useRef } from "react";

// Company Information
const COMPANY_INFO = {
  name: "Wazn Express",
  nameKu: "وەزن ئێکسپرێس",
  address: "Erbil, Kurdistan Region, Iraq",
  addressKu: "هەولێر، هەرێمی کوردستان، عێراق",
  phone: "+964 750 XXX XXXX",
  email: "info@waznexpress.com",
  website: "www.waznexpress.com",
};

export default function InvoiceView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);
  
  const invoiceId = parseInt(params.id || "0");
  
  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery(
    { id: invoiceId },
    { enabled: invoiceId > 0 }
  );
  
  const { data: customers } = trpc.customers.list.useQuery();
  const generatePdfMutation = trpc.invoices.generatePDF.useMutation();
  
  const customer = customers?.find(c => c.id === invoice?.customerId);
  
  const lineItems = invoice?.lineItems 
    ? (typeof invoice.lineItems === 'string' 
        ? JSON.parse(invoice.lineItems) 
        : invoice.lineItems)
    : [];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>Invoice ${invoice?.invoiceNumber}</title>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Noto Sans Arabic', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #1e293b;
            padding: 20px;
          }
          
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
          }
          
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 3px solid #0f766e;
            margin-bottom: 30px;
          }
          
          .company-info h1 {
            font-size: 28px;
            color: #0f766e;
            margin-bottom: 5px;
          }
          
          .company-info h2 {
            font-size: 16px;
            color: #64748b;
            font-weight: normal;
            margin-bottom: 10px;
          }
          
          .company-info p {
            font-size: 12px;
            color: #64748b;
            margin: 3px 0;
          }
          
          .invoice-title {
            text-align: left;
          }
          
          .invoice-title h3 {
            font-size: 32px;
            color: #0f766e;
            margin-bottom: 10px;
          }
          
          .invoice-title p {
            font-size: 12px;
            color: #64748b;
            margin: 3px 0;
          }
          
          .status-badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 10px;
          }
          
          .status-paid {
            background: #dcfce7;
            color: #166534;
          }
          
          .status-unpaid {
            background: #fee2e2;
            color: #991b1b;
          }
          
          .customer-section {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          
          .customer-section h4 {
            color: #0f766e;
            font-size: 14px;
            margin-bottom: 10px;
          }
          
          .customer-section .name {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 5px;
          }
          
          .customer-section .code {
            font-size: 14px;
            color: #64748b;
            font-family: monospace;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          
          .items-table th {
            background: #0f766e;
            color: white;
            padding: 12px 15px;
            text-align: right;
            font-weight: 600;
            font-size: 13px;
          }
          
          .items-table th:last-child {
            text-align: left;
          }
          
          .items-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
          }
          
          .items-table td:last-child {
            text-align: left;
            font-family: monospace;
          }
          
          .items-table tr:nth-child(even) {
            background: #f8fafc;
          }
          
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          
          .totals-box {
            width: 300px;
          }
          
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .totals-row.total {
            background: #0f766e;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            font-size: 18px;
            font-weight: 700;
          }
          
          .footer {
            text-align: center;
            padding-top: 30px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
          }
          
          .footer p {
            margin: 5px 0;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .invoice-container {
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    
    try {
      const result = await generatePdfMutation.mutateAsync({ id: invoice.id });
      if (result?.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <FileText className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">پسوولە نەدۆزرایەوە</p>
          <Button onClick={() => navigate('/invoices')}>گەڕانەوە بۆ پسوولەکان</Button>
        </div>
      </DashboardLayout>
    );
  }

  const isPaid = invoice.status === 'paid';
  const subtotal = Number(invoice.subtotalUsd) || 0;
  const tax = Number(invoice.taxUsd) || 0;
  const total = Number(invoice.totalUsd) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              پسوولە #{invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground">بینینی پسوولە بە شێوەیەکی پڕۆفیشناڵ</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              چاپکردن
            </Button>
            <Button 
              onClick={handleDownloadPDF}
              disabled={generatePdfMutation.isPending}
            >
              <Download className="h-4 w-4 ml-2" />
              {generatePdfMutation.isPending ? 'چاوەڕوان بە...' : 'داگرتنی PDF'}
            </Button>
          </div>
        </div>

        {/* Invoice Preview Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div ref={printRef} className="invoice-container bg-white p-8" dir="rtl">
              {/* Header with Gradient */}
              <div className="flex justify-between items-start pb-6 border-b-4 border-emerald-600 mb-8">
                {/* Company Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Package className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-emerald-700">{COMPANY_INFO.name}</h1>
                      <h2 className="text-lg text-slate-500">{COMPANY_INFO.nameKu}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" />
                    <span>{COMPANY_INFO.addressKu}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{COMPANY_INFO.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="h-4 w-4" />
                    <span dir="ltr">{COMPANY_INFO.email}</span>
                  </div>
                </div>

                {/* Invoice Info */}
                <div className="text-left space-y-2">
                  <h3 className="text-3xl font-bold text-emerald-700">پسوولە</h3>
                  <p className="text-sm text-slate-500">
                    <span className="font-medium">ژمارەی پسوولە:</span>{' '}
                    <span className="font-mono">{invoice.invoiceNumber}</span>
                  </p>
                  <p className="text-sm text-slate-500">
                    <span className="font-medium">بەروار:</span>{' '}
                    {new Date(invoice.createdAt).toLocaleDateString('ku-Arab')}
                  </p>
                  {invoice.dueDate && (
                    <p className="text-sm text-slate-500">
                      <span className="font-medium">دوا وادە:</span>{' '}
                      {new Date(invoice.dueDate).toLocaleDateString('ku-Arab')}
                    </p>
                  )}
                  <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold mt-2 ${
                    isPaid 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {isPaid ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        پارەدراو
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        پارەنەدراو
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-xl p-6 mb-8">
                <h4 className="text-emerald-700 font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  زانیاری کڕیار
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      {customer?.fullNameKurdish || customer?.fullName || 'نەناسراو'}
                    </p>
                    <p className="text-slate-500 font-mono text-sm">
                      {customer?.customerCode || '-'}
                    </p>
                  </div>
                  <div className="text-left">
                    {customer?.mobileNumber && (
                      <p className="text-sm text-slate-500" dir="ltr">
                        <Phone className="h-3 w-3 inline ml-1" />
                        {customer.mobileNumber}
                      </p>
                    )}
                    {customer?.city && (
                      <p className="text-sm text-slate-500">
                        <MapPin className="h-3 w-3 inline ml-1" />
                        {customer.city}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white">
                      <th className="py-3 px-4 text-right font-semibold rounded-tr-lg">#</th>
                      <th className="py-3 px-4 text-right font-semibold">وەسف</th>
                      <th className="py-3 px-4 text-center font-semibold">بڕ</th>
                      <th className="py-3 px-4 text-center font-semibold">نرخی یەکە</th>
                      <th className="py-3 px-4 text-left font-semibold rounded-tl-lg">کۆ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length > 0 ? (
                      lineItems.map((item: any, index: number) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="py-3 px-4 text-slate-500">{index + 1}</td>
                          <td className="py-3 px-4 text-slate-800">{item.description}</td>
                          <td className="py-3 px-4 text-center text-slate-600">{item.quantity}</td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">${item.unitPrice?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-left font-mono font-semibold text-slate-800">${item.total?.toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          هیچ بابەتێک نییە
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end mb-8">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-600">کۆی ناوەکی:</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between py-2 border-b border-slate-200">
                      <span className="text-slate-600">باج:</span>
                      <span className="font-mono">${tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center bg-gradient-to-l from-emerald-600 to-teal-600 text-white p-4 rounded-xl mt-4">
                    <span className="font-semibold text-lg">کۆی گشتی:</span>
                    <span className="font-mono text-2xl font-bold">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
                  <h4 className="font-semibold text-amber-800 mb-2">تێبینی:</h4>
                  <p className="text-amber-700 text-sm">{invoice.notes}</p>
                </div>
              )}

              {/* Footer */}
              <div className="text-center pt-6 border-t border-slate-200">
                <p className="text-slate-500 text-sm mb-1">سوپاس بۆ کارکردنتان لەگەڵمان!</p>
                <p className="text-slate-400 text-xs">
                  {COMPANY_INFO.name} • {COMPANY_INFO.website}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
