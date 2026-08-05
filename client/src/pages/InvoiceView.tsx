import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Printer, Download, ArrowRight, ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

export default function InvoiceView() {
  const { t, direction, isRTL, language } = useTranslation();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);

  const invoiceId = parseInt(params.id || "0");

  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id: invoiceId }, { enabled: invoiceId > 0 });
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: template } = trpc.invoiceTemplates.getDefault.useQuery();
  const generatePdfMutation = trpc.invoices.generatePDF.useMutation();
  const customer = customers?.find(c => c.id === invoice?.customerId);
  const { data: customerBalance } = trpc.customers.getBalance.useQuery(
    { customerId: invoice?.customerId || 0 }, { enabled: !!invoice?.customerId }
  );

  const lineItems = invoice?.lineItems
    ? (typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) : [];

  // Dynamic company info from template — language-aware
  const templateAny = template as { companyNameAr?: string; companyAddressAr?: string; footerTextAr?: string; termsTextAr?: string } | null | undefined;
  const company = {
    name: template?.companyName || "Wazn Express",
    nameKu: template?.companyNameKu || "وەزن ئێکسپرێس",
    nameAr: templateAny?.companyNameAr || "وزن اكسبرس",
    address: template?.companyAddress || "Erbil, Kurdistan Region, Iraq",
    addressKu: template?.companyAddressKu || "هەولێر، هەرێمی کوردستان، عێراق",
    addressAr: templateAny?.companyAddressAr || "أربيل، إقليم كردستان، العراق",
    phone: template?.companyPhone || "", phone2: template?.companyPhone2 || "",
    email: template?.companyEmail || "", website: template?.companyWebsite || "",
    logoUrl: template?.logoUrl || "",
    primaryColor: template?.primaryColor || "#0f766e",
    secondaryColor: template?.secondaryColor || "#14b8a6",
    footerTextKu: template?.footerTextKu || "", footerText: template?.footerText || "", footerTextAr: templateAny?.footerTextAr || "",
    termsTextKu: template?.termsTextKu || "", termsText: template?.termsText || "", termsTextAr: templateAny?.termsTextAr || "",
    bankName: template?.bankName || "", bankAccountName: template?.bankAccountName || "",
    bankAccountNumber: template?.bankAccountNumber || "", bankIban: template?.bankIban || "",
  };

  const companyDisplayName = language === 'ar' ? company.nameAr : language === 'ku' ? company.nameKu : company.name;
  const companySecondaryName = (language === 'ku' || language === 'ar') ? company.name : company.nameKu;
  const companyDisplayAddress = language === 'ar' ? company.addressAr : language === 'ku' ? company.addressKu : company.address;
  const footerDisplay = language === 'ar' ? (company.footerTextAr || company.footerText) : language === 'ku' ? (company.footerTextKu || company.footerText) : company.footerText;
  const termsDisplay = language === 'ar' ? (company.termsTextAr || company.termsText) : language === 'ku' ? (company.termsTextKu || company.termsText) : company.termsText;

  const primaryColor = company.primaryColor;
  const secondaryColor = company.secondaryColor;
  const textStart = isRTL ? 'right' : 'left';
  const textEnd = isRTL ? 'left' : 'right';

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html dir="${direction}" lang="${language}"><head>
      <title>${t('invoiceView.invoice')} ${invoice?.invoiceNumber}</title><meta charset="utf-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Noto Sans Arabic','Noto Sans SC',Arial,sans-serif;direction:${direction};background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        @media print{body{padding:0}@page{margin:15mm;size:A4}}
      </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    try {
      const r = await generatePdfMutation.mutateAsync({ id: invoice.id });
      if (r?.url) window.open(r.url, '_blank');
    } catch (e) { console.error('PDF error:', e); }
  };

  if (isLoading) return (
    <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>
  );

  if (!invoice) return (
    <DashboardLayout><div className="flex flex-col items-center justify-center h-64 gap-4">
      <FileText className="h-16 w-16 text-muted-foreground" /><p className="text-muted-foreground">{t('invoiceView.notFound')}</p>
      <Button onClick={() => navigate('/invoices')}>{t('invoiceView.backToInvoices')}</Button>
    </div></DashboardLayout>
  );

  const subtotal = Number(invoice.subtotalUsd) || 0;
  const tax = Number(invoice.taxUsd) || 0;
  const total = Number(invoice.totalUsd) || 0;
  const advancePaid = Number((invoice as any).paidAmountUsd) || 0;
  const remainingDue = Number((invoice as any).remainingAmountUsd ?? (total - advancePaid)) || 0;
  const hasAdvancePayment = advancePaid > 0;
  const isFullyPaid = hasAdvancePayment && remainingDue <= 0;
  const balance = customerBalance ?? 0;
  const isDebt = balance > 0;
  const isCredit = balance < 0;

  const statusLabel = invoice.status === 'paid' ? t('invoiceView.paid')
    : invoice.status === 'partially_paid' ? t('invoiceView.partiallyPaid')
    : invoice.status === 'issued' ? t('invoiceView.issued')
    : invoice.status === 'draft' ? t('invoiceView.draft')
    : invoice.status === 'cancelled' ? t('invoiceView.cancelled') : invoice.status;

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}><BackArrow className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />{t('invoiceView.invoice')} #{invoice.invoiceNumber}
              </h1>
              <p className="text-sm text-muted-foreground">{t('invoiceView.viewAndPrint')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" />{t('invoiceView.print')}</Button>
            <Button onClick={handleDownloadPDF} disabled={generatePdfMutation.isPending} className="gap-2 bg-teal-600 hover:bg-teal-700">
              <Download className="h-4 w-4" />{generatePdfMutation.isPending ? t('invoiceView.generating') : t('invoiceView.downloadPdf')}
            </Button>
          </div>
        </div>

        {/* Invoice Preview — ALL INLINE STYLES for print compatibility */}
        <Card className="overflow-hidden shadow-lg">
          <CardContent className="p-0">
            <div ref={printRef} className="wazn-paper" style={{ maxWidth:'800px',margin:'0 auto',padding:'40px',background:'white',fontFamily:"'Noto Sans Arabic','Noto Sans SC',Arial,sans-serif",direction:direction,color:'#1e293b' }}>

              {/* HEADER */}
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',paddingBottom:'24px',borderBottom:`3px solid ${primaryColor}`,marginBottom:'28px' }}>
                <div>
                  {company.logoUrl && <img src={company.logoUrl} alt={company.name} style={{ height:'50px',marginBottom:'8px',objectFit:'contain' }} />}
                  <h1 style={{ fontSize:'24px',fontWeight:700,color:primaryColor,marginBottom:'2px' }}>{companyDisplayName}</h1>
                  <p style={{ fontSize:'14px',color:'#94a3b8',marginBottom:'10px' }}>{companySecondaryName}</p>
                  <div style={{ fontSize:'11px',color:'#64748b',lineHeight:'1.8' }}>
                    {companyDisplayAddress && <p>{companyDisplayAddress}</p>}
                    {company.phone && <p style={{ direction:'ltr',textAlign:textStart as "left" | "right" }}>{company.phone}{company.phone2 ? ` | ${company.phone2}` : ''}</p>}
                    {company.email && <p style={{ direction:'ltr',textAlign:textStart as "left" | "right" }}>{company.email}</p>}
                    {company.website && <p style={{ direction:'ltr',textAlign:textStart as "left" | "right" }}>{company.website}</p>}
                  </div>
                </div>
                <div style={{ textAlign:textEnd as "left" | "right",minWidth:'200px' }}>
                  <h2 style={{ fontSize:'28px',fontWeight:700,color:primaryColor,marginBottom:'4px' }}>{t('invoiceView.invoice')}</h2>
                  <p style={{ fontSize:'11px',color:'#94a3b8',marginBottom:'12px' }}>INVOICE</p>
                  <div style={{ fontSize:'12px',color:'#64748b',lineHeight:'2' }}>
                    <p><span style={{ fontWeight:600 }}>{t('invoiceView.invoiceNumber')}: </span><span style={{ fontFamily:'monospace' }}>{invoice.invoiceNumber}</span></p>
                    <p><span style={{ fontWeight:600 }}>{t('invoiceView.date')}: </span>{new Date(invoice.createdAt).toLocaleDateString('en-GB')}</p>
                    {invoice.dueDate && <p><span style={{ fontWeight:600 }}>{t('invoiceView.dueDate')}: </span>{new Date(invoice.dueDate).toLocaleDateString('en-GB')}</p>}
                  </div>
                  <div style={{ display:'inline-block',marginTop:'10px',padding:'5px 16px',borderRadius:'20px',fontSize:'12px',fontWeight:600,
                    background:invoice.status==='paid'?'#dcfce7':'#dbeafe',color:invoice.status==='paid'?'#166534':'#1e40af' }}>
                    {statusLabel}
                  </div>
                </div>
              </div>

              {/* CUSTOMER */}
              <div style={{ background:'#f8fafc',borderRadius:'10px',padding:'20px',marginBottom:'28px',border:'1px solid #e2e8f0' }}>
                <p style={{ fontSize:'11px',fontWeight:600,color:primaryColor,marginBottom:'10px',letterSpacing:'0.5px' }}>{t('invoiceView.customerInfo')}</p>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                  <div>
                    <p style={{ fontSize:'16px',fontWeight:700,color:'#1e293b' }}>{customer?.fullNameKurdish || customer?.fullName || t('invoiceView.unknown')}</p>
                    <p style={{ fontSize:'13px',color:'#64748b',fontFamily:'monospace',marginTop:'2px' }}>{customer?.customerCode || '-'}</p>
                  </div>
                  <div style={{ textAlign:textEnd as "left" | "right",fontSize:'12px',color:'#64748b',lineHeight:'1.8' }}>
                    {customer?.mobileNumber && <p style={{ direction:'ltr' }}>📞 {customer.mobileNumber}</p>}
                    {customer?.city && <p>📍 {customer.city}</p>}
                  </div>
                </div>
              </div>

              {/* TABLE */}
              <table style={{ width:'100%',borderCollapse:'collapse',marginBottom:'24px',fontSize:'13px' }}>
                <thead>
                  <tr style={{ background:primaryColor }}>
                    <th style={{ padding:'10px 14px',textAlign:textStart as "left" | "right",color:'white',fontWeight:600 }}>#</th>
                    <th style={{ padding:'10px 14px',textAlign:textStart as "left" | "right",color:'white',fontWeight:600 }}>{t('invoiceView.description')}</th>
                    <th style={{ padding:'10px 14px',textAlign:'center',color:'white',fontWeight:600 }}>{t('invoiceView.qty')}</th>
                    <th style={{ padding:'10px 14px',textAlign:'center',color:'white',fontWeight:600 }}>{t('invoiceView.unitPrice')}</th>
                    <th style={{ padding:'10px 14px',textAlign:textEnd as "left" | "right",color:'white',fontWeight:600 }}>{t('invoiceView.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? lineItems.map((item: { description?: string; quantity?: number; unitPrice?: number; total?: number }, i: number) => (
                    <tr key={i} style={{ background:i%2===0?'#fff':'#f8fafc',borderBottom:'1px solid #e2e8f0' }}>
                      <td style={{ padding:'10px 14px',color:'#94a3b8' }}>{i+1}</td>
                      <td style={{ padding:'10px 14px',color:'#334155',whiteSpace:'pre-line',lineHeight:1.6 }}>{item.description}</td>
                      <td style={{ padding:'10px 14px',textAlign:'center',color:'#64748b' }}>{item.quantity}</td>
                      <td style={{ padding:'10px 14px',textAlign:'center',fontFamily:'monospace',color:'#64748b' }}>${Number(item.unitPrice || 0).toFixed(2)}</td>
                      <td style={{ padding:'10px 14px',textAlign:textEnd as "left" | "right",fontFamily:'monospace',fontWeight:600,color:'#1e293b' }}>${Number(item.total || 0).toFixed(2)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ padding:'32px',textAlign:'center',color:'#94a3b8' }}>{t('invoiceView.noItems')}</td></tr>
                  )}
                </tbody>
              </table>

              {/* TOTALS */}
              <div style={{ display:'flex',justifyContent:isRTL?'flex-start':'flex-end',marginBottom:'28px' }}>
                <div style={{ width:'300px' }}>
                  <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #e2e8f0' }}>
                    <span style={{ color:'#64748b',fontSize:'13px' }}>{t('invoiceView.subtotal')}:</span>
                    <span style={{ fontFamily:'monospace',fontSize:'13px' }}>${subtotal.toFixed(2)}</span>
                  </div>
                  {tax > 0 && <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #e2e8f0' }}>
                    <span style={{ color:'#64748b',fontSize:'13px' }}>{t('invoiceView.tax')}:</span>
                    <span style={{ fontFamily:'monospace',fontSize:'13px' }}>${tax.toFixed(2)}</span>
                  </div>}
                  {/* Grand total (what was owed before any advance) */}
                  <div style={{ display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'2px solid #cbd5e1' }}>
                    <span style={{ color:'#334155',fontSize:'14px',fontWeight:600 }}>{t('invoiceView.grandTotal')}:</span>
                    <span style={{ fontFamily:'monospace',fontSize:'16px',fontWeight:700,color:'#1e293b' }}>${total.toFixed(2)}</span>
                  </div>
                  {/* Advance paid (only shown when there is any) */}
                  {hasAdvancePayment && (
                    <div style={{ display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #e2e8f0' }}>
                      <span style={{ color:'#059669',fontSize:'13px',fontWeight:500 }}>💰 {t('invoiceView.advancePaid')}:</span>
                      <span style={{ fontFamily:'monospace',fontSize:'13px',color:'#059669',fontWeight:600 }}>−${advancePaid.toFixed(2)}</span>
                    </div>
                  )}
                  {/* Remaining due / Fully paid — prominent box */}
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',
                    background: isFullyPaid ? 'linear-gradient(135deg,#10b981,#059669)' : `linear-gradient(135deg,${primaryColor},${secondaryColor})`,
                    color:'white',padding:'14px 18px',borderRadius:'10px',marginTop:'12px' }}>
                    <span style={{ fontWeight:600,fontSize:'15px' }}>
                      {isFullyPaid ? t('invoiceView.fullyPaid') : hasAdvancePayment ? t('invoiceView.remainingDue') : t('invoiceView.grandTotal')}:
                    </span>
                    <span style={{ fontFamily:'monospace',fontSize:'22px',fontWeight:700 }}>
                      ${hasAdvancePayment ? remainingDue.toFixed(2) : total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* NOTES */}
              {invoice.notes && <div style={{ background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'8px',padding:'14px 18px',marginBottom:'24px' }}>
                <p style={{ fontWeight:600,color:'#92400e',fontSize:'12px',marginBottom:'4px' }}>{t('invoiceView.notes')}:</p>
                <p style={{ color:'#a16207',fontSize:'12px',lineHeight:'1.6',whiteSpace:'pre-line' }}>{invoice.notes}</p>
              </div>}

              {/* BALANCE */}
              <div style={{ border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden',marginBottom:'24px' }}>
                <div style={{ background:'#f1f5f9',padding:'10px 18px',fontSize:'12px',fontWeight:600,color:'#475569' }}>{t('invoiceView.customerBalance')}</div>
                <div style={{ padding:'16px 18px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                  <div>
                    <p style={{ fontSize:'13px',color:'#64748b' }}>{t('invoiceView.currentBalance')}</p>
                    <p style={{ fontSize:'11px',color:'#94a3b8',marginTop:'2px' }}>
                      {customer?.fullNameKurdish || customer?.fullName || t('invoiceView.unknown')} — {customer?.customerCode || ''}
                    </p>
                  </div>
                  <div style={{ textAlign:textEnd as "left" | "right" }}>
                    <p style={{ fontFamily:'monospace',fontSize:'20px',fontWeight:700,color:isDebt?'#dc2626':isCredit?'#059669':'#64748b' }}>
                      ${Math.abs(balance).toFixed(2)}
                    </p>
                    <p style={{ fontSize:'11px',fontWeight:500,marginTop:'2px',color:isDebt?'#ef4444':isCredit?'#10b981':'#94a3b8' }}>
                      {isDebt ? t('invoiceView.debt') : isCredit ? t('invoiceView.credit') : t('invoiceView.settled')}
                    </p>
                  </div>
                </div>
              </div>

              {/* BANK */}
              {company.bankName && <div style={{ background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'8px',padding:'14px 18px',marginBottom:'24px',fontSize:'12px' }}>
                <p style={{ fontWeight:600,color:'#166534',marginBottom:'6px' }}>{t('invoiceView.bankInfo')}:</p>
                <p style={{ color:'#15803d' }}>{t('invoiceView.bankName')}: {company.bankName}</p>
                {company.bankAccountName && <p style={{ color:'#15803d' }}>{t('invoiceView.accountName')}: {company.bankAccountName}</p>}
                {company.bankAccountNumber && <p style={{ color:'#15803d',fontFamily:'monospace' }}>{t('invoiceView.accountNumber')}: {company.bankAccountNumber}</p>}
                {company.bankIban && <p style={{ color:'#15803d',fontFamily:'monospace' }}>IBAN: {company.bankIban}</p>}
              </div>}

              {/* TERMS */}
              {termsDisplay && <div style={{ fontSize:'11px',color:'#94a3b8',marginBottom:'20px',lineHeight:'1.6',borderTop:'1px dashed #e2e8f0',paddingTop:'12px' }}>
                <p style={{ fontWeight:600,color:'#64748b',marginBottom:'4px' }}>{t('invoiceView.terms')}:</p>
                <p>{termsDisplay}</p>
              </div>}

              {/* FOOTER */}
              <div style={{ textAlign:'center',paddingTop:'20px',borderTop:`2px solid ${primaryColor}20` }}>
                <p style={{ color:'#64748b',fontSize:'12px',marginBottom:'4px' }}>{footerDisplay || t('invoiceView.thankYou')}</p>
                <p style={{ color:'#94a3b8',fontSize:'10px' }}>{companyDisplayName} • {companySecondaryName}{company.website ? ` • ${company.website}` : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
