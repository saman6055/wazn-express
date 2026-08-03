import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, ImageIcon, Loader2, X, CheckCircle2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { prohibitedItemOptions } from "@/constants/prohibitedItems";
import { compressImage } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";

export default function ProhibitedRegister() {
  const { language } = useTranslation();
  const label = (v: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, v);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Customer autocomplete — same live suggestions as Quick Register.
  const { data: customers } = trpc.customers.list.useQuery();
  const filteredCustomers = useMemo(() => {
    if (!customers || !customerCode.trim()) return [];
    const s = customerCode.toLowerCase();
    return (customers as any[]).filter((c) =>
      c.customerCode?.toLowerCase().includes(s) ||
      c.fullName?.toLowerCase().includes(s) ||
      c.mobileNumber?.includes(customerCode),
    ).slice(0, 10);
  }, [customers, customerCode]);

  const uploadMutation = trpc.storage.upload.useMutation();
  const registerMutation = trpc.prohibited.register.useMutation({
    onSuccess: (created) => {
      toast.success(label({ ku: "تۆمارکرا و ئاگاداری موشتەری کرا", en: "Registered and customer notified", ar: "تم التسجيل وإشعار العميل", zh: "已登记并通知客户" }));
      setLastCode(created.trackingNumber);
      setTrackingNumber(""); setReasonId(""); setReasonNote(""); setPhotos([]);
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
      const bytes = new Uint8Array(await compressed.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const res = await uploadMutation.mutateAsync({ fileName: compressed.name, contentType: compressed.type, base64Data: btoa(binary) });
      if (res.success && res.url) setPhotos((p) => [...p, res.url!]);
      else toast.error(res.error || "upload failed");
    } catch {
      toast.error(label({ ku: "بارکردنی وێنە سەرکەوتوو نەبوو", en: "Photo upload failed", ar: "فشل رفع الصورة", zh: "图片上传失败" }));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = () => {
    if (!trackingNumber.trim()) { toast.error(label({ ku: "ژمارەی تراک بنووسە", en: "Enter tracking number", ar: "أدخل رقم التتبع", zh: "输入运单号" })); return; }
    if (!customerCode.trim()) { toast.error(label({ ku: "کۆدی موشتەری بنووسە", en: "Enter customer code", ar: "أدخل رمز العميل", zh: "输入客户代码" })); return; }
    registerMutation.mutate({
      trackingNumber: trackingNumber.trim(),
      customerCode: customerCode.trim(),
      reasonId: reasonId || undefined,
      reasonNote: reasonNote.trim() || undefined,
      photos: photos.length ? photos : undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg">
            <Ban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{label({ ku: "تۆماری کەل و پەلی قەدەغە", en: "Register prohibited item", ar: "تسجيل بضاعة ممنوعة", zh: "登记违禁物品" })}</h1>
            <p className="text-sm text-muted-foreground">{label({ ku: "تراک + کۆدی موشتەری + وێنە + هۆکار", en: "Tracking + customer code + photo + reason", ar: "التتبع + رمز العميل + صورة + السبب", zh: "运单号 + 客户代码 + 图片 + 原因" })}</p>
          </div>
        </div>

        {lastCode && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            {label({ ku: "دواتر تۆمارکرا", en: "Last registered", ar: "آخر تسجيل", zh: "上次登记" })}: <span className="font-mono font-medium">{lastCode}</span>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">{label({ ku: "زانیاری", en: "Details", ar: "التفاصيل", zh: "详情" })}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{label({ ku: "ژمارەی تراک", en: "Tracking number", ar: "رقم التتبع", zh: "运单号" })} *</Label>
              <div className="relative mt-1.5">
                <ScanLine className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="ps-9 font-mono" autoFocus placeholder="SF1234567890" />
              </div>
            </div>

            <div>
              <Label>{label({ ku: "کۆدی موشتەری", en: "Customer code", ar: "رمز العميل", zh: "客户代码" })} *</Label>
              <div className="relative mt-1.5">
                <Input
                  value={customerCode}
                  onChange={(e) => { setCustomerCode(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                  className="font-mono"
                  placeholder="AZ002"
                  autoComplete="off"
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg max-h-52 overflow-auto">
                    {filteredCustomers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-4 py-2.5 text-sm text-start hover:bg-muted transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setCustomerCode(c.customerCode || ""); setShowCustomerDropdown(false); }}
                      >
                        <span className="font-bold font-mono text-primary">{c.customerCode}</span>
                        <span className="text-muted-foreground ms-2">— {c.fullName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>{label({ ku: "هۆکاری قەدەغە", en: "Prohibited reason", ar: "سبب المنع", zh: "禁运原因" })}</Label>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder={label({ ku: "لە لیست هەڵبژێرە...", en: "Choose from list...", ar: "اختر من القائمة...", zh: "从列表选择..." })} /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {prohibitedItemOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{pickLang(language, o.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{label({ ku: "تێبینی (ئارەزوومەندانە)", en: "Note (optional)", ar: "ملاحظة (اختياري)", zh: "备注（可选）" })}</Label>
              <Textarea value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} rows={2} className="mt-1.5" />
            </div>

            <div>
              <Label>{label({ ku: "وێنە", en: "Photos", ar: "الصور", zh: "图片" })}</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} className="absolute top-1 end-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
                  </div>
                ))}
                <label className={cn("w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted", uploading && "opacity-60 pointer-events-none")}>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                </label>
              </div>
            </div>

            <Button onClick={submit} disabled={registerMutation.isPending} className="w-full gap-2">
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {label({ ku: "تۆمارکردن و ئاگادارکردنی موشتەری", en: "Register & notify customer", ar: "تسجيل وإشعار العميل", zh: "登记并通知客户" })}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
