import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import type { CompanyInfo } from "@/hooks/useCompanyInfo";
import { getCompanyInfoFromSettings } from "@/hooks/useCompanyInfo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Scale,
  Box,
  Percent,
  AlertTriangle,
  CheckCircle,
  Download,
  Loader2,
  Ship,
  Plane,
  Calendar,
  BarChart3,
  Wallet,
  Calculator,
  FileText,
  FileSpreadsheet,
  Eye,
  ShoppingBag,
  Printer,
  Tag,
  Settings2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "@/contexts/LanguageContext";
import { generateLabelsHtml, openLabelPrintWindow } from "@/lib/labelPrintUtils";
import { generateBatchLabelsHtml, openBatchLabelPrintWindow } from "@/lib/batchLabelPrintUtils";
import { BatchPrintBoxesSection } from "@/components/delivery/BatchPrintBoxesSection";

function DownloadPDFButton({ batchId }: { batchId: number }) {
  const generatePDF = trpc.batches.generateFinancialPDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success('PDF دروستکرا');
    },
    onError: (error) => {
      toast.error(`هەڵە لە دروستکردنی PDF: ${error.message}`);
    },
  });
  
  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => generatePDF.mutate({ batchId })}
      disabled={generatePDF.isPending}
      className="gap-2"
    >
      {generatePDF.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      داونلۆدی PDF
    </Button>
  );
}

// Helper function to generate print content
function generatePrintContent(
  title: string,
  packages: Array<{
    trackingNumber?: string | null;
    weightKg?: number | null;
    volumeCbm?: number | null;
    calculatedCostUsd?: number | null;
    isFullPackage?: boolean;
    fullPackageOrderType?: string | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
  }>,
  batch: { batchCode?: string; shippingType?: string } | null | undefined,
  customer: { name: string; code: string } | null,
  company: CompanyInfo
) {
  const unit = batch?.shippingType === 'sea' ? 'CBM' : 'KG';
  const totalActualWeight = batch?.shippingType === 'sea'
    ? packages.reduce((s, p) => s + (p.volumeCbm || 0), 0)
    : packages.reduce((s, p) => s + (p.weightKg || 0), 0);
  
  // Calculate chargeable weight (max of actual weight and volumetric weight for each package)
  const totalChargeableWeight = batch?.shippingType === 'sea'
    ? packages.reduce((s, p) => s + (p.volumeCbm || 0), 0)
    : packages.reduce((s, p) => {
        const actualKg = p.weightKg || 0;
        const lengthCm = p.lengthCm || 0;
        const widthCm = p.widthCm || 0;
        const heightCm = p.heightCm || 0;
        const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
        return s + Math.max(actualKg, volumetricKg);
      }, 0);
  
  const totalWeight = totalActualWeight;
  const totalCost = packages.reduce((s, p) => s + (p.calculatedCostUsd || 0), 0);
  
  return `
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title} - ${customer?.name}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, sans-serif; 
          padding: 0; 
          margin: 0;
          direction: rtl; 
          color: #1f2937;
          font-size: 12px;
        }
        .header {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .header h1 { 
          font-size: 24px; 
          margin: 0 0 5px 0;
          font-weight: 700;
        }
        .header .subtitle {
          font-size: 14px;
          opacity: 0.9;
        }
        .header .batch-code {
          background: rgba(255,255,255,0.2);
          padding: 4px 12px;
          border-radius: 20px;
          display: inline-block;
          margin-top: 10px;
          font-size: 13px;
        }
        .customer-info {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 15px 20px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .customer-info .name {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
        }
        .customer-info .code {
          background: #e0e7ff;
          color: #4338ca;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .stats {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }
        .stat-card {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
        }
        .stat-card .label {
          color: #64748b;
          font-size: 11px;
          margin-bottom: 5px;
        }
        .stat-card .value {
          font-size: 20px;
          font-weight: 700;
          color: #1e293b;
        }
        .stat-card.highlight {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border-color: #a7f3d0;
        }
        .stat-card.highlight .value {
          color: #059669;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 10px;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        th { 
          background: #1e293b; 
          color: white; 
          padding: 12px 10px; 
          text-align: right; 
          font-weight: 600;
          font-size: 11px;
        }
        td { 
          padding: 10px; 
          border-bottom: 1px solid #e5e7eb; 
          font-size: 11px;
        }
        tr:nth-child(even) { background: #f9fafb; }
        tr:last-child td { border-bottom: none; }
        .badge { 
          display: inline-block; 
          padding: 3px 8px; 
          border-radius: 4px; 
          font-size: 10px;
          font-weight: 600;
        }
        .badge-full { background: #dbeafe; color: #1d4ed8; }
        .badge-commission { background: #fef3c7; color: #d97706; }
        .badge-normal { background: #f1f5f9; color: #475569; }
        .total-row {
          background: #f1f5f9 !important;
          font-weight: 700;
        }
        .total-row td {
          border-top: 2px solid #cbd5e1;
          padding: 12px 10px;
        }
        .footer { 
          margin-top: 25px; 
          padding-top: 15px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #94a3b8; 
          font-size: 10px; 
        }
        .footer .company {
          font-weight: 600;
          color: #059669;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${company.name}</h1>
        <div class="subtitle">ڕاپۆرتی ${title}</div>
        <div class="batch-code">باچ: ${batch?.batchCode || '-'}</div>
      </div>
      
      <div class="customer-info">
        <div>
          <div class="name">${customer?.name || '-'}</div>
        </div>
        <div class="code">${customer?.code || '-'}</div>
      </div>
      
      <div class="stats">
        <div class="stat-card">
          <div class="label">کۆی پاکەت</div>
          <div class="value">${packages.length}</div>
        </div>
        <div class="stat-card" style="background: #fff7ed; border-color: #fdba74;">
          <div class="label" style="color: #c2410c;">${batch?.shippingType === 'sea' ? 'CBM' : 'KG'} حسابکراو</div>
          <div class="value" style="color: #ea580c;">${batch?.shippingType === 'sea' ? totalActualWeight.toFixed(3) : totalChargeableWeight.toFixed(2)}</div>
        </div>
        <div class="stat-card highlight">
          <div class="label">کۆی نرخ</div>
          <div class="value">$${totalCost.toFixed(2)}</div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>تراک نەمبەر</th>
            <th style="width: 80px;">${batch?.shippingType === 'sea' ? 'CBM' : 'KG'} حسابکراو</th>
            <th style="width: 80px;">نرخ ($)</th>
            <th style="width: 100px;">جۆر</th>
          </tr>
        </thead>
        <tbody>
          ${packages.map((pkg, idx) => {
            const actualKg = pkg.weightKg || 0;
            const lengthCm = pkg.lengthCm || 0;
            const widthCm = pkg.widthCm || 0;
            const heightCm = pkg.heightCm || 0;
            const volumetricKg = (lengthCm * widthCm * heightCm) / 6000;
            const chargeableKg = Math.max(actualKg, volumetricKg);
            return `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td>${pkg.trackingNumber || '-'}</td>
              <td style="text-align: center; color: #ea580c; font-weight: bold;">${batch?.shippingType === 'sea' ? (pkg.volumeCbm?.toFixed(3) || '0') : chargeableKg.toFixed(2)}</td>
              <td style="text-align: center;">$${(pkg.calculatedCostUsd || 0).toFixed(2)}</td>
              <td>
                <span class="badge ${pkg.isFullPackage ? (pkg.fullPackageOrderType === 'commission' ? 'badge-commission' : 'badge-full') : 'badge-normal'}">
                  ${pkg.isFullPackage ? (pkg.fullPackageOrderType === 'commission' ? 'کڕین بە تێچوو' : 'پاکێجی تەواو') : 'ئاسایی'}
                </span>
              </td>
            </tr>
          `}).join('')}
          <tr class="total-row">
            <td colspan="2" style="text-align: right;">کۆی گشتی</td>
            <td style="text-align: center; color: #ea580c; font-weight: bold;">${batch?.shippingType === 'sea' ? totalActualWeight.toFixed(3) : totalChargeableWeight.toFixed(2)}</td>
            <td style="text-align: center;">$${totalCost.toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      
      <div class="footer">
        <span class="company">${company.name} - ${company.nameKu}</span>
        <span>${new Date().toLocaleDateString('ku-IQ')} - ${new Date().toLocaleTimeString('ku-IQ')}</span>
      </div>
    </body>
    </html>
  `;
}

// Helper function to generate beautiful professional CONSOLIDATED label content for printing
// Shows ALL packages in ONE single label instead of separate labels per package
function generateLabelContent(
  packages: Array<{
    trackingNumber?: string | null;
    weightKg?: number | null;
    volumeCbm?: number | null;
    calculatedCostUsd?: number | null;
    isFullPackage?: boolean;
    fullPackageOrderType?: string | null;
  }>,
  batch: { batchCode?: string; shippingType?: string; pricePerKg?: number | string | null; pricePerCbm?: number | string | null } | null | undefined,
  customer: { name: string; code: string } | null,
  company: CompanyInfo
) {
  const isSea = batch?.shippingType === 'sea';
  const unit = isSea ? 'CBM' : 'KG';
  const pricePerUnit = isSea 
    ? (Number(batch?.pricePerCbm) || 0) 
    : (Number(batch?.pricePerKg) || 0);
  const totalPackages = packages.length;
  const totalWeight = isSea 
    ? packages.reduce((sum, p) => sum + (p.volumeCbm || 0), 0)
    : packages.reduce((sum, p) => sum + (p.weightKg || 0), 0);
  const totalCost = packages.reduce((sum, p) => sum + (p.calculatedCostUsd || 0), 0);
  const customerInitial = customer?.name?.charAt(0) || '?';
  
  return `
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>لەیبڵ - ${customer?.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @page { 
          size: A4; 
          margin: 15mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif; 
          direction: rtl; 
          background: #ffffff;
          padding: 20px;
        }
        .label {
          border: 4px solid #0f172a;
          border-radius: 20px;
          background: #ffffff;
          overflow: hidden;
          position: relative;
          max-width: 100%;
        }
        /* Top accent bar */
        .label::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 8px;
          background: linear-gradient(90deg, #10b981 0%, #059669 50%, #047857 100%);
        }
        .label-header {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          padding: 20px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }
        .label-logo {
          font-weight: 900;
          font-size: 28px;
          letter-spacing: 3px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #10b981, #34d399);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .label-batch {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .label-batch-label {
          font-size: 11px;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .label-batch-code {
          font-size: 20px;
          font-weight: 800;
          color: #10b981;
        }
        .label-body {
          padding: 28px;
        }
        /* Customer Section - Prominent */
        .label-customer {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 3px dashed #e2e8f0;
        }
        .customer-avatar {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 36px;
          font-weight: 900;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
        }
        .customer-info {
          flex: 1;
        }
        .customer-name {
          font-size: 32px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 8px;
          line-height: 1.2;
        }
        .customer-code {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 800;
          color: #475569;
          border: 2px solid #cbd5e1;
        }
        /* Stats Row */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          border: 2px solid #e2e8f0;
        }
        .stat-card.highlight {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border-color: #a7f3d0;
        }
        .stat-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .stat-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .stat-value {
          font-size: 26px;
          font-weight: 900;
          color: #0f172a;
        }
        .stat-card.highlight .stat-value {
          color: #059669;
        }
        /* Packages Table */
        .packages-section {
          margin-bottom: 24px;
        }
        .packages-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .packages-table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #e2e8f0;
        }
        .packages-table th {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .packages-table td {
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 600;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .packages-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .packages-table tr:last-child td {
          border-bottom: none;
        }
        .tracking-cell {
          font-family: 'Courier New', monospace;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.5px;
        }
        .type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .type-regular {
          background: #dbeafe;
          color: #1e40af;
        }
        .type-commission {
          background: #fce7f3;
          color: #be185d;
        }
        /* Price Section - Golden */
        .price-section {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%);
          border-radius: 20px;
          padding: 28px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 3px solid #f59e0b;
          position: relative;
          overflow: hidden;
        }
        .price-section::before {
          content: '';
          position: absolute;
          top: -60%;
          right: -15%;
          width: 150px;
          height: 150px;
          background: rgba(255,255,255,0.4);
          border-radius: 50%;
        }
        .price-label {
          font-size: 18px;
          color: #92400e;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .price-value {
          font-size: 42px;
          font-weight: 900;
          color: #b45309;
          text-shadow: 2px 2px 0 rgba(255,255,255,0.5);
        }
        /* Footer */
        .label-footer {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          color: white;
          padding: 20px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-info {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .footer-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .footer-label {
          font-size: 10px;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .footer-value {
          font-size: 16px;
          font-weight: 700;
        }
        .shipping-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          padding: 12px 20px;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
        }
        .shipping-icon {
          font-size: 24px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
          .label { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="label-header">
          <span class="label-logo">${company.name.toUpperCase()}</span>
          <div class="label-batch">
            <span class="label-batch-label">کۆدی باچ</span>
            <span class="label-batch-code">${batch?.batchCode || '-'}</span>
          </div>
        </div>
        <div class="label-body">
          <div class="label-customer">
            <div class="customer-avatar">${customerInitial}</div>
            <div class="customer-info">
              <div class="customer-name">${customer?.name || '-'}</div>
              <span class="customer-code">📋 ${customer?.code || '-'}</span>
            </div>
          </div>
          
          <div class="stats-row">
            <div class="stat-card">
              <div class="stat-icon">📦</div>
              <div class="stat-label">کۆی پاکەت</div>
              <div class="stat-value">${totalPackages}</div>
            </div>
            <div class="stat-card highlight">
              <div class="stat-icon">${isSea ? '📐' : '⚖️'}</div>
              <div class="stat-label">کۆی ${isSea ? 'قەبارە' : 'کێش'}</div>
              <div class="stat-value">${totalWeight.toFixed(isSea ? 3 : 2)} ${unit}</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">💵</div>
              <div class="stat-label">نرخی ${unit}</div>
              <div class="stat-value">$${pricePerUnit.toFixed(2)}</div>
            </div>
          </div>
          
          <div class="packages-section">
            <div class="packages-title">📋 لیستی پاکەتەکان</div>
            <table class="packages-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>تراکینگ نەمبەر</th>
                  <th>${isSea ? 'قەبارە (CBM)' : 'کێش (KG)'}</th>
                  <th>نرخ</th>
                  <th>جۆر</th>
                </tr>
              </thead>
              <tbody>
                ${packages.map((pkg, idx) => {
                  const weight = isSea ? (pkg.volumeCbm || 0) : (pkg.weightKg || 0);
                  const pkgType = pkg.isFullPackage 
                    ? (pkg.fullPackageOrderType === 'commission' ? 'کرین بە عمولە' : 'پاکێجی تەواو')
                    : 'ئاسایی';
                  const typeClass = pkg.isFullPackage && pkg.fullPackageOrderType === 'commission' 
                    ? 'type-commission' 
                    : 'type-regular';
                  return `
                    <tr>
                      <td style="font-weight: 800; color: #10b981;">${idx + 1}</td>
                      <td class="tracking-cell">${pkg.trackingNumber || '-'}</td>
                      <td>${weight.toFixed(isSea ? 3 : 2)}</td>
                      <td style="color: #059669; font-weight: 800;">$${(pkg.calculatedCostUsd || 0).toFixed(2)}</td>
                      <td><span class="type-badge ${typeClass}">${pkgType}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="price-section">
            <span class="price-label">💰 کۆی نرخی کۆتایی</span>
            <span class="price-value">$${totalCost.toFixed(2)}</span>
          </div>
        </div>
        <div class="label-footer">
          <div class="footer-info">
            <div class="footer-item">
              <span class="footer-label">بەروار</span>
              <span class="footer-value">${new Date().toLocaleDateString('en-GB')}</span>
            </div>
            <div class="footer-item">
              <span class="footer-label">کۆی پاکەت</span>
              <span class="footer-value">${totalPackages} پاکەت</span>
            </div>
          </div>
          <div class="shipping-badge">
            <span class="shipping-icon">${isSea ? '🚢' : '✈️'}</span>
            <span>${isSea ? 'گواستنەوەی دەریایی' : 'گواستنەوەی ئاسمانی'}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to open print window
function openPrintWindow(content: string) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  }
}

export default function BatchFinancialReport() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const batchId = parseInt(params.id || "0");
  
  // Customer modal state
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string; code: string } | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [selectedLabelTemplateId, setSelectedLabelTemplateId] = useState<number | null>(null);
  const [selectedBatchLabelTemplateId, setSelectedBatchLabelTemplateId] = useState<number | null>(null);

  const { data: batch, isLoading: batchLoading } = trpc.batches.getById.useQuery({ id: batchId }, {
    enabled: batchId > 0
  });

  const { data: financial, isLoading: financialLoading } = trpc.batches.getFinancialSummary.useQuery({ batchId }, {
    enabled: batchId > 0
  });

  const { data: customers } = trpc.customers.list.useQuery();
  const { data: settings } = trpc.settings.list.useQuery();
  const { data: labelTemplatesList } = trpc.labelTemplates.list.useQuery(undefined, { enabled: isCustomerModalOpen });
  const defaultLabelTemplate = labelTemplatesList?.find((t) => t.isDefault) ?? labelTemplatesList?.[0] ?? null;

  const { data: batchLabelTemplatesList } = trpc.batchLabelTemplates.list.useQuery(undefined, { enabled: batchId > 0 });
  const defaultBatchLabelTemplate = batchLabelTemplatesList?.find((t) => t.isDefault) ?? batchLabelTemplatesList?.[0] ?? null;

  useEffect(() => {
    if (selectedLabelTemplateId == null && defaultLabelTemplate) {
      setSelectedLabelTemplateId(defaultLabelTemplate.id);
    }
  }, [defaultLabelTemplate, selectedLabelTemplateId]);

  useEffect(() => {
    if (selectedBatchLabelTemplateId == null && defaultBatchLabelTemplate) {
      setSelectedBatchLabelTemplateId(defaultBatchLabelTemplate.id);
    }
  }, [defaultBatchLabelTemplate, selectedBatchLabelTemplateId]);

  const selectedLabelTemplate = selectedLabelTemplateId != null
    ? (labelTemplatesList?.find((t) => t.id === selectedLabelTemplateId) ?? defaultLabelTemplate)
    : defaultLabelTemplate;

  const selectedBatchLabelTemplate = selectedBatchLabelTemplateId != null
    ? (batchLabelTemplatesList?.find((t) => t.id === selectedBatchLabelTemplateId) ?? defaultBatchLabelTemplate)
    : defaultBatchLabelTemplate;

  const company = getCompanyInfoFromSettings(settings || []);

  // Fetch customer packages when modal is open
  const { data: customerPackages, isLoading: packagesLoading } = trpc.batches.getCustomerPackages.useQuery(
    { batchId, customerId: selectedCustomer?.id || 0 },
    { enabled: !!selectedCustomer && isCustomerModalOpen }
  );
  
  const isLoading = batchLoading || financialLoading;
  
  const getCustomerName = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.fullNameKurdish || customer?.fullName || `کڕیار #${customerId}`;
  };
  
  const getCustomerCode = (customerId: number) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.customerCode || '';
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  const statusLabels: Record<string, string> = {
    preparing: "ئامادەکاری",
    in_transit: "لە ڕێگادایە",
    arrived: "گەیشتووە",
    customs: "گومرگ",
    delivered: "گەیەندراوە",
    closed: "داخراوە"
  };
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }
  
  if (!batch || !financial) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">باچ نەدۆزرایەوە</p>
              <Link href="/batches">
                <Button variant="outline" className="mt-4">
                  <ArrowLeft className="me-2 h-4 w-4" />
                  گەڕانەوە بۆ باچەکان
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }
  
  const isProfitable = financial.profit >= 0;
  const unit = batch.shippingType === 'sea' ? 'CBM' : 'KG';
  const shippingTypeLabel = batch.shippingType === 'sea' ? 'دەریایی' : batch.shippingType === 'air_regular' ? 'ئاسمانی ئاسایی' : 'ئاسمانی تایبەت';
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header with gradient background */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-6 text-white">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/10" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/batches">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  {batch.shippingType === 'sea' ? (
                    <Ship className="h-8 w-8" />
                  ) : (
                    <Plane className="h-8 w-8" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">ئەنەلایزی باچ</h1>
                  <p className="text-white/80 flex items-center gap-2 mt-1">
                    <span className="font-semibold">{batch.batchCode}</span>
                    <span>•</span>
                    <span>{shippingTypeLabel}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                className={`text-sm px-3 py-1 ${
                  batch.status === 'delivered' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/20 text-white'
                }`}
              >
                {statusLabels[batch.status] || batch.status}
              </Badge>
              <Link href={`/reports/batch-financial/${batchId}`}>
                <Button variant="secondary" size="sm" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-0">
                  <BarChart3 className="h-4 w-4" />
                  ڕاپۆرتی دارایی تەواو
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Quick Stats in Header */}
          <div className="relative mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-white/70 text-sm">کۆی پاکەت</p>
              <p className="text-2xl font-bold">{financial.totalPackages}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-white/70 text-sm">{batch.shippingType === 'sea' ? 'کۆی CBM' : 'کۆی کێش'}</p>
              <p className="text-2xl font-bold">
                {batch.shippingType === 'sea' 
                  ? `${financial.actualCbm?.toFixed(2) || 0}`
                  : `${financial.customerBreakdown?.reduce((sum, c) => sum + (c.chargeableWeight || 0), 0).toFixed(2) || 0} KG`
                }
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-white/70 text-sm">کۆی کڕیار</p>
              <p className="text-2xl font-bold">{financial.customerBreakdown?.length || 0}</p>
            </div>

          </div>
        </div>
        

        
        {/* Details & Pricing — Professional cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-slate-200/80 shadow-sm overflow-hidden transition-shadow hover:shadow-md duration-200">
            <CardHeader className="pb-3 border-b bg-slate-50/60">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                {batch.shippingType === 'sea' ? <Box className="h-5 w-5 text-cyan-600" /> : <Scale className="h-5 w-5 text-blue-600" />}
                وردەکاری {batch.shippingType === 'sea' ? 'قەبارە' : 'کێش'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex justify-between items-center p-4 bg-amber-50/80 border border-amber-200/60 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-200/80 rounded-xl">
                    <Calculator className="h-5 w-5 text-amber-700" />
                  </div>
                  <span className="font-medium text-amber-800">{unit} حسابکراو</span>
                </div>
                <span className="font-bold text-xl tabular-nums text-amber-800">
                  {batch.shippingType === 'sea'
                    ? financial.chargedCbm?.toFixed(3)
                    : financial.customerBreakdown?.reduce((sum, c) => sum + (c.chargeableWeight || 0), 0).toFixed(2)}
                  {" "}{unit}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm overflow-hidden transition-shadow hover:shadow-md duration-200">
            <CardHeader className="pb-3 border-b bg-slate-50/60">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <DollarSign className="h-5 w-5 text-green-600" />
                نرخەکان
              </CardTitle>
              <CardDescription className="text-slate-500 text-sm">نرخی کڕین، فرۆشتن و قازانج بۆ هەر {unit}</CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="flex justify-between items-center p-4 bg-red-50/80 border border-red-200/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-200/80 rounded-xl">
                    <TrendingDown className="h-5 w-5 text-red-700" />
                  </div>
                  <span className="font-medium text-red-800">نرخی کڕین</span>
                </div>
                <span className="font-bold text-lg tabular-nums text-red-700">
                  ${batch.shippingType === 'sea' ? financial.costPerCbm : financial.costPerKg}/{unit}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50/80 border border-green-200/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-green-200/80 rounded-xl">
                    <TrendingUp className="h-5 w-5 text-green-700" />
                  </div>
                  <span className="font-medium text-green-800">نرخی فرۆشتن (تێکڕا)</span>
                </div>
                <span className="font-bold text-lg tabular-nums text-green-700">
                  ${(() => {
                    const totalChargeableWeight = financial.customerBreakdown?.reduce((sum, c) => sum + (c.chargeableWeight || 0), 0) || 0;
                    const divisor = batch.shippingType === 'sea' ? financial.actualCbm : totalChargeableWeight;
                    return financial.totalRevenue > 0 && divisor > 0
                      ? (financial.totalRevenue / divisor).toFixed(2)
                      : '0.00';
                  })()}/{unit}
                </span>
              </div>
              <div className={`flex justify-between items-center p-4 rounded-xl border ${isProfitable ? 'bg-blue-50/80 border-blue-200/50' : 'bg-red-50/80 border-red-200/50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isProfitable ? 'bg-blue-200/80' : 'bg-red-200/80'}`}>
                    <Wallet className={`h-5 w-5 ${isProfitable ? 'text-blue-700' : 'text-red-700'}`} />
                  </div>
                  <span className={`font-medium ${isProfitable ? 'text-blue-800' : 'text-red-800'}`}>قازانج بۆ هەر {unit}</span>
                </div>
                <span className={`font-bold text-lg tabular-nums ${isProfitable ? 'text-blue-700' : 'text-red-700'}`}>
                  ${(() => {
                    const totalChargeableWeight = financial.customerBreakdown?.reduce((sum, c) => sum + (c.chargeableWeight || 0), 0) || 0;
                    const divisor = batch.shippingType === 'sea' ? financial.actualCbm : totalChargeableWeight;
                    return divisor > 0
                      ? (financial.profit / divisor).toFixed(2)
                      : '0.00';
                  })()}/{unit}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Customer Breakdown — Professional table */}
        <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-slate-50/60">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Users className="h-5 w-5 text-indigo-600" />
              شیکاری بەپێی کڕیار
            </CardTitle>
            <CardDescription className="text-slate-500">
              داهات و وردەکاری هەر کڕیارێک لەم باچەدا — کلیک بکە بۆ بینینی پاکەت و پرینتی لەیبڵ
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {financial.customerBreakdown?.length === 0 ? (
              <div className="text-center py-12 px-6 text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">هیچ زانیارییەک بەردەست نییە</p>
                <p className="text-sm mt-2">هێشتا هیچ پاکەتێک لەم باچەدا نییە</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80">
                      <th className="text-right py-4 px-4 font-semibold text-slate-700 text-sm">کڕیار</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700 text-sm">پاکەت</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700 text-sm">
                        {batch.shippingType === 'sea' ? 'CBM' : 'کێش حسابکراو'}
                      </th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700 text-sm">داهات</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700 text-sm">ڕێژە</th>
                      <th className="text-center py-4 px-4 font-semibold text-slate-700 text-sm w-16">وردەکاری</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.customerBreakdown
                      ?.sort((a, b) => b.revenue - a.revenue)
                      .map((item, index) => (
                        <tr
                          key={item.customerId}
                          className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/60 transition-colors duration-200 cursor-pointer"
                          onClick={() => {
                            setSelectedCustomer({
                              id: item.customerId,
                              name: getCustomerName(item.customerId),
                              code: getCustomerCode(item.customerId)
                            });
                            setIsCustomerModalOpen(true);
                          }}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-semibold">{getCustomerName(item.customerId)}</p>
                                <p className="text-xs text-muted-foreground">{getCustomerCode(item.customerId)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-4 px-4">
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {item.packages}
                            </Badge>
                          </td>
                          <td className="text-center py-4 px-4 font-mono">
                            {batch.shippingType === 'sea' 
                              ? item.cbm?.toFixed(3)
                              : <span className="text-amber-600 font-bold">{item.chargeableWeight?.toFixed(2)}</span>
                            }
                          </td>
                          <td className="text-center py-4 px-4">
                            <span className="font-bold text-green-600">{formatCurrency(item.revenue)}</span>
                          </td>
                          <td className="text-center py-4 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                                  style={{ width: `${financial.totalRevenue > 0 ? (item.revenue / financial.totalRevenue * 100) : 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-slate-600 w-12">
                                {financial.totalRevenue > 0 ? (item.revenue / financial.totalRevenue * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-4 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomer({
                                  id: item.customerId,
                                  name: getCustomerName(item.customerId),
                                  code: getCustomerCode(item.customerId)
                                });
                                setIsCustomerModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold">
                      <td className="py-4 px-4 text-slate-800">کۆی گشتی</td>
                      <td className="text-center py-4 px-4">
                        <Badge className="bg-indigo-600">{financial.totalPackages}</Badge>
                      </td>
                      <td className="text-center py-4 px-4 font-mono">
                        {batch.shippingType === 'sea' 
                          ? financial.actualCbm?.toFixed(3)
                          : <span className="text-amber-600 font-bold">
                              {financial.customerBreakdown?.reduce((sum, c) => sum + (c.chargeableWeight || 0), 0).toFixed(2)}
                            </span>
                        }
                      </td>
                      <td className="text-center py-4 px-4 text-green-600">
                        {formatCurrency(financial.totalRevenue)}
                      </td>
                      <td className="text-center py-4 px-4">100%</td>
                      <td className="text-center py-4 px-4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* بۆکسەکانی پرینت بۆ باچ — خۆکارانە بۆ هەر کڕیار بۆکسێک */}
        {batch && <BatchPrintBoxesSection batchId={batch.id} batchCode={batch.batchCode} />}

        {/* پرینتی لەیبڵی باچ — یەک لەیبڵ بۆ هەر کڕیار */}
        <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-slate-50/60">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Layers className="h-5 w-5 text-emerald-600" />
              پرینتی لەیبڵی باچ
            </CardTitle>
            <CardDescription className="text-slate-500">
              یەک لەیبڵ بۆ هەر کڕیار — کۆی پاکەت، حەجم، کیلۆ، بارکۆد/QR، نرخ و ناوی کڕیار
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">تێمپلەیت:</span>
              <Select
                value={selectedBatchLabelTemplateId?.toString() ?? ""}
                onValueChange={(v) => setSelectedBatchLabelTemplateId(v ? parseInt(v, 10) : null)}
              >
                <SelectTrigger className="w-[220px] border-slate-300">
                  <SelectValue placeholder="هەڵبژێرە..." />
                </SelectTrigger>
                <SelectContent>
                  {batchLabelTemplatesList?.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name} {t.isDefault ? "(بنەڕەت)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/settings/batch-label-template">
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600">
                <Settings2 className="h-4 w-4" />
                داڕشتەی تێمپلەیت
              </Button>
            </Link>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={!financial?.customerBreakdown?.length || !batch}
              onClick={async () => {
                if (!batch || !financial?.customerBreakdown?.length) return;
                const breakdown = financial.customerBreakdown!;
                const qrCodesMap: Record<string, string> = {};
                for (const item of breakdown) {
                  const code = getCustomerCode(item.customerId);
                  const key = `${batch.batchCode}-${code}`;
                  qrCodesMap[item.customerId.toString()] = await QRCode.toDataURL(key, { width: 200, margin: 1 });
                }
                const customers = breakdown.map((item) => ({
                  customerId: item.customerId,
                  name: getCustomerName(item.customerId),
                  code: getCustomerCode(item.customerId),
                  totalPackages: item.packages,
                  totalWeight: item.chargeableWeight ?? 0,
                  totalVolume: item.cbm ?? 0,
                  totalPrice: item.revenue,
                }));
                const html = generateBatchLabelsHtml({
                  template: selectedBatchLabelTemplate ?? undefined,
                  customers,
                  batch: { batchCode: batch.batchCode, shippingType: batch.shippingType },
                  company: { name: company.name },
                  qrCodesMap,
                });
                openBatchLabelPrintWindow(html);
                toast.success(`${customers.length} لەیبڵی باچ ئامادەن بۆ پرینت`);
              }}
            >
              <Layers className="h-4 w-4" />
              چاپکردنی لەیبڵی باچ ({financial?.customerBreakdown?.length ?? 0} کڕیار)
            </Button>
          </CardContent>
        </Card>

      </div>
      
      {/* Customer Packages Modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <span className="text-lg">{selectedCustomer?.name}</span>
                <Badge variant="outline" className="me-2 text-xs">{selectedCustomer?.code}</Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              پاکەتەکانی ئەم کڕیارە لەم باچەدا
            </DialogDescription>
          </DialogHeader>
          
          {packagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : customerPackages && customerPackages.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-blue-600">کۆی پاکەت</p>
                    <p className="text-2xl font-bold text-blue-700">{customerPackages.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-green-600">
                      {batch?.shippingType === 'sea' ? 'کۆی CBM' : 'کۆی کێش'}
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                      {batch?.shippingType === 'sea' 
                        ? customerPackages.reduce((sum, p) => sum + (p.volumeCbm || 0), 0).toFixed(3)
                        : customerPackages.reduce((sum, p) => {
                            const actualWeight = p.weightKg || 0;
                            const volumetricWeight = (p.lengthCm && p.widthCm && p.heightCm) 
                              ? (p.lengthCm * p.widthCm * p.heightCm) / 6000 
                              : 0;
                            return sum + Math.max(actualWeight, volumetricWeight);
                          }, 0).toFixed(2)
                      }
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-purple-600">پاکێجی تەواو</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {customerPackages.filter(p => p.isFullPackage && p.fullPackageOrderType === 'full_package').length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-amber-600">کڕین بە تێچوو</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {customerPackages.filter(p => p.isFullPackage && p.fullPackageOrderType === 'commission').length}
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Packages Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">#</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">تراک نەمبەر</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">
                        {batch?.shippingType === 'sea' ? 'CBM' : 'کێش (KG)'}
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">نرخ</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">جۆر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerPackages.map((pkg, idx) => (
                      <tr key={pkg.id} className="border-t hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-600">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                            {pkg.trackingNumber || '-'}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 font-mono">
                          {batch?.shippingType === 'sea' 
                            ? pkg.volumeCbm?.toFixed(3)
                            : (() => {
                                const actualWeight = pkg.weightKg || 0;
                                const volumetricWeight = (pkg.lengthCm && pkg.widthCm && pkg.heightCm) 
                                  ? (pkg.lengthCm * pkg.widthCm * pkg.heightCm) / 6000 
                                  : 0;
                                const chargeableWeight = Math.max(actualWeight, volumetricWeight);
                                const isVolumetric = volumetricWeight > actualWeight && volumetricWeight > 0;
                                return (
                                  <div className="flex flex-col items-center">
                                    <span>{chargeableWeight.toFixed(2)}</span>
                                    {isVolumetric && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 text-purple-600 border-purple-200">
                                        قەبارەیی
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })()
                          }
                        </td>
                        <td className="text-center py-3 px-4">
                          <span className="font-bold text-green-600">
                            {formatCurrency(pkg.calculatedCostUsd || 0)}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          {pkg.isFullPackage ? (
                            pkg.fullPackageOrderType === 'commission' ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200">
                                <DollarSign className="h-3 w-3 ms-1" />
                                کڕین بە تێچوو
                              </Badge>
                            ) : (
                              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                                <ShoppingBag className="h-3 w-3 ms-1" />
                                پاکێجی تەواو
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-slate-600">
                              <Package className="h-3 w-3 ms-1" />
                              ئاسایی
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100">
                    <tr>
                      <td colSpan={2} className="py-3 px-4 font-bold">کۆی گشتی</td>
                      <td className="text-center py-3 px-4 font-bold font-mono">
                        {batch?.shippingType === 'sea' 
                          ? customerPackages.reduce((sum, p) => sum + (p.volumeCbm || 0), 0).toFixed(3)
                          : customerPackages.reduce((sum, p) => {
                              const actualWeight = p.weightKg || 0;
                              const volumetricWeight = (p.lengthCm && p.widthCm && p.heightCm) 
                                ? (p.lengthCm * p.widthCm * p.heightCm) / 6000 
                                : 0;
                              return sum + Math.max(actualWeight, volumetricWeight);
                            }, 0).toFixed(2)
                        }
                      </td>
                      <td className="text-center py-3 px-4 font-bold text-green-600">
                        {formatCurrency(customerPackages.reduce((sum, p) => sum + (p.calculatedCostUsd || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              {/* Label template selection — uses settings */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-700">تێمپلەیتی لەیبڵ:</span>
                <Select
                  value={selectedLabelTemplateId?.toString() ?? ""}
                  onValueChange={(v) => setSelectedLabelTemplateId(v ? parseInt(v, 10) : null)}
                >
                  <SelectTrigger className="w-[220px] border-slate-300">
                    <SelectValue placeholder="هەڵبژێرە..." />
                  </SelectTrigger>
                  <SelectContent>
                    {labelTemplatesList?.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {t.name} {t.isDefault ? "(بنەڕەت)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link href="/settings/label-templates">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600">
                    <Settings2 className="h-4 w-4" />
                    داڕشتەی تێمپلەیتەکان
                  </Button>
                </Link>
              </div>

              {/* Print & Label section — Professional layout */}
              <div className="pt-4 border-t border-slate-200 space-y-6">
                <div>
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                    <Printer className="h-4 w-4 text-slate-600" />
                    بژاردەکانی پرینت
                  </h4>
                  <p className="text-sm text-slate-500 mb-4">ڕاپۆرتی پرینت بەپێی جۆری پاکەت هەڵبژێرە</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const regularAndCommission = customerPackages?.filter(p => !p.isFullPackage || p.fullPackageOrderType === 'commission') || [];
                        if (regularAndCommission.length === 0) {
                          toast.error('هیچ پاکەتێکی ئاسایی یان عمولە نییە');
                          return;
                        }
                        openPrintWindow(generatePrintContent('پاکەتی ئاسایی + کڕین بە تێچوو', regularAndCommission, batch, selectedCustomer, company));
                        toast.success('پرینت ئامادەیە');
                      }}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 text-right min-h-[100px]"
                    >
                      <div className="p-2.5 rounded-xl bg-blue-100">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">پاکەتی ئاسایی + عمولە</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-medium">
                        {(customerPackages?.filter(p => !p.isFullPackage || p.fullPackageOrderType === 'commission')?.length || 0)} پاکەت
                      </Badge>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const fullPackages = customerPackages?.filter(p => p.isFullPackage && p.fullPackageOrderType !== 'commission') || [];
                        if (fullPackages.length === 0) {
                          toast.error('هیچ پاکێجی تەواو نییە');
                          return;
                        }
                        openPrintWindow(generatePrintContent('پاکێجی تەواو', fullPackages, batch, selectedCustomer, company));
                        toast.success('پرینت ئامادەیە');
                      }}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 text-right min-h-[100px]"
                    >
                      <div className="p-2.5 rounded-xl bg-purple-100">
                        <ShoppingBag className="h-6 w-6 text-purple-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">پاکێجی تەواو بەتەنیا</span>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 font-medium">
                        {(customerPackages?.filter(p => p.isFullPackage && p.fullPackageOrderType !== 'commission')?.length || 0)} پاکەت
                      </Badge>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!customerPackages || customerPackages.length === 0) {
                          toast.error('هیچ پاکەتێک نییە');
                          return;
                        }
                        openPrintWindow(generatePrintContent('هەموو پاکەتەکان', customerPackages, batch, selectedCustomer, company));
                        toast.success('پرینت ئامادەیە');
                      }}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-slate-200 bg-slate-50/50 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200 text-right min-h-[100px]"
                    >
                      <div className="p-2.5 rounded-xl bg-emerald-100">
                        <Box className="h-6 w-6 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">هەموو (هەرسێ شیواز)</span>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 font-medium">
                        {customerPackages?.length || 0} پاکەت
                      </Badge>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                    <Tag className="h-4 w-4 text-slate-600" />
                    پرینتی لەیبڵ (بەپێی تێمپلەیتی سیتینگ)
                  </h4>
                  <p className="text-sm text-slate-500 mb-4">هەر پاکەتێک لەیبڵێکی تاک بە تێمپلەیتی هەڵبژێردراو</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={async () => {
                        const regularAndCommission = customerPackages?.filter(p => !p.isFullPackage || p.fullPackageOrderType === 'commission') || [];
                        if (regularAndCommission.length === 0) {
                          toast.error('هیچ پاکەتێکی ئاسایی یان عمولە نییە');
                          return;
                        }
                        const fullCustomer = customers?.find(c => c.id === selectedCustomer?.id);
                        const qrCodesMap: Record<string, string> = {};
                        for (const p of regularAndCommission) {
                          if (p.trackingNumber) {
                            qrCodesMap[p.trackingNumber] = await QRCode.toDataURL(p.trackingNumber, { width: 200, margin: 1 });
                          }
                        }
                        const html = generateLabelsHtml({
                          template: selectedLabelTemplate ?? undefined,
                          packages: regularAndCommission.map((p) => ({
                            trackingNumber: p.trackingNumber,
                            weightKg: p.weightKg,
                            volumeCbm: p.volumeCbm,
                            lengthCm: p.lengthCm,
                            widthCm: p.widthCm,
                            heightCm: p.heightCm,
                            calculatedCostUsd: p.calculatedCostUsd,
                            shippingType: batch?.shippingType,
                          })),
                          customer: {
                            name: selectedCustomer?.name ?? fullCustomer?.fullNameKurdish ?? fullCustomer?.fullName ?? '',
                            code: selectedCustomer?.code ?? fullCustomer?.customerCode ?? undefined,
                            phone: (fullCustomer as any)?.phone ?? undefined,
                            city: fullCustomer?.city ?? undefined,
                          },
                          batch: { batchCode: batch?.batchCode, shippingType: batch?.shippingType },
                          company: { name: company.name },
                          qrCodesMap,
                        });
                        openLabelPrintWindow(html);
                        toast.success('لەیبڵەکان ئامادەن بۆ پرینت');
                      }}
                      className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-50 to-white hover:border-emerald-400 hover:shadow-lg transition-all duration-200 text-right min-h-[120px] group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <Tag className="h-8 w-8 text-white" />
                      </div>
                      <div className="text-center">
                        <span className="text-base font-bold text-slate-800 block">پاکەتی ئاسایی + کڕین بە تێچوو</span>
                        <span className="text-sm text-emerald-700 font-medium mt-1 block">
                          {(customerPackages?.filter(p => !p.isFullPackage || p.fullPackageOrderType === 'commission')?.length || 0)} لەیبڵ
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const fullPackages = customerPackages?.filter(p => p.isFullPackage && p.fullPackageOrderType !== 'commission') || [];
                        if (fullPackages.length === 0) {
                          toast.error('هیچ پاکێجی تەواو نییە');
                          return;
                        }
                        const fullCustomer = customers?.find(c => c.id === selectedCustomer?.id);
                        const qrCodesMap: Record<string, string> = {};
                        for (const p of fullPackages) {
                          if (p.trackingNumber) {
                            qrCodesMap[p.trackingNumber] = await QRCode.toDataURL(p.trackingNumber, { width: 200, margin: 1 });
                          }
                        }
                        const html = generateLabelsHtml({
                          template: selectedLabelTemplate ?? undefined,
                          packages: fullPackages.map((p) => ({
                            trackingNumber: p.trackingNumber,
                            weightKg: p.weightKg,
                            volumeCbm: p.volumeCbm,
                            lengthCm: p.lengthCm,
                            widthCm: p.widthCm,
                            heightCm: p.heightCm,
                            calculatedCostUsd: p.calculatedCostUsd,
                            shippingType: batch?.shippingType,
                          })),
                          customer: {
                            name: selectedCustomer?.name ?? fullCustomer?.fullNameKurdish ?? fullCustomer?.fullName ?? '',
                            code: selectedCustomer?.code ?? fullCustomer?.customerCode ?? undefined,
                            phone: (fullCustomer as any)?.phone ?? undefined,
                            city: fullCustomer?.city ?? undefined,
                          },
                          batch: { batchCode: batch?.batchCode, shippingType: batch?.shippingType },
                          company: { name: company.name },
                          qrCodesMap,
                        });
                        openLabelPrintWindow(html);
                        toast.success('لەیبڵەکان ئامادەن بۆ پرینت');
                      }}
                      className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-violet-200 bg-gradient-to-b from-violet-50 to-white hover:border-violet-400 hover:shadow-lg transition-all duration-200 text-right min-h-[120px] group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <Tag className="h-8 w-8 text-white" />
                      </div>
                      <div className="text-center">
                        <span className="text-base font-bold text-slate-800 block">پاکێجی تەواو</span>
                        <span className="text-sm text-violet-700 font-medium mt-1 block">
                          {(customerPackages?.filter(p => p.isFullPackage && p.fullPackageOrderType !== 'commission')?.length || 0)} لەیبڵ
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-300 hover:bg-slate-100"
                    onClick={() => {
                      const headers = ['#', 'تراک نەمبەر', batch?.shippingType === 'sea' ? 'CBM' : 'کێش (KG)', 'نرخ ($)', 'جۆر'];
                      const rows = customerPackages?.map((pkg, idx) => [
                        idx + 1,
                        pkg.trackingNumber || '-',
                        batch?.shippingType === 'sea' ? pkg.volumeCbm?.toFixed(3) : pkg.weightKg?.toFixed(2),
                        pkg.calculatedCostUsd?.toFixed(2),
                        pkg.isFullPackage ? (pkg.fullPackageOrderType === 'commission' ? 'کڕین بە تێچوو' : 'پاکێجی تەواو') : 'ئاسایی'
                      ]) || [];
                      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
                      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${selectedCustomer?.code}_${batch?.batchCode}_packages.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('فایلی Excel داونلۆد کرا');
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    داونلۆدی Excel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p>هیچ پاکەتێک نەدۆزرایەوە</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
