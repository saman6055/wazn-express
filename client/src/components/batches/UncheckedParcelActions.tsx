import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ArrowLeftRight, CheckCircle2, MessageCircle, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { pickLang } from "@/lib/lang";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { whatsappChatUrl, whatsappNumber } from "@shared/receiptWhatsApp";
import { CARRIER_CONTACTS_KEY, carrierAskMessage, customerAskMessage, parseCarrierContacts } from "@shared/carrierContacts";

/**
 * What to do about a parcel with no arrival scan, from the sheet that names it
 * (owner, 2026-11-01: «خودی کێشەکەی چارەسەر نەکرد»). Found: its arrival is
 * recorded. Not found: ask the customer, ask the carrier, or move its batch.
 * Messages open ready to send; a person presses send.
 *
 * The carriers' numbers live in a setting, not here: the repository is public.
 */
export function UncheckedParcelActions({
  parcel,
  mobile,
  action,
  onDone,
}: {
  parcel: { id: number; packageCode: string; trackingNumber: string | null; weightKg?: string | null };
  mobile: string | null | undefined;
  /** The sheet's own button look. */
  action: string;
  onDone: () => void;
}) {
  const { language } = useLanguage();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const utils = trpc.useUtils();

  const code = parcel.trackingNumber || parcel.packageCode;
  const found = trpc.scanning.registerScan.useMutation({
    onSuccess: () => {
      toast.success(L({ ku: "گەیشتنی پاکێجەکە تۆمار کرا", en: "Arrival recorded", ar: "تم تسجيل الوصول", zh: "已记录到达" }));
      void utils.batches.invalidate();
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const number = whatsappNumber(mobile);
  const setting = trpc.settings.get.useQuery({ key: CARRIER_CONTACTS_KEY }, { enabled: isAdmin, retry: false });
  const raw = setting.data ?? "";
  const contacts = parseCarrierContacts(raw);
  const [picked, setPicked] = useState("");
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const save = trpc.settings.set.useMutation({
    onSuccess: () => { toast.success(L({ ku: "پاشەکەوت کرا", en: "Saved", ar: "تم الحفظ", zh: "已保存" })); setTyping(false); void setting.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <button type="button" disabled={found.isPending} onClick={() => found.mutate({ trackingNumber: code, packageId: parcel.id, scanType: "received_local" })} className={action} data-testid="unchecked-found">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        {L({ ku: "لە کۆگا دۆزرایەوە", en: "Found in the depot", ar: "وُجد في المخزن", zh: "在仓库找到" })}
      </button>
      {number && (
        <a href={whatsappChatUrl(number, customerAskMessage(code))} target="_blank" rel="noreferrer" className={action} data-testid="unchecked-ask-customer">
          <MessageCircle className="h-3.5 w-3.5" />
          {L({ ku: "پرسیار لە کڕیار", en: "Ask the customer", ar: "اسأل العميل", zh: "询问客户" })}
        </a>
      )}
      <Link href="/batch-assignment-scanner" className={action} data-testid="unchecked-move">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {L({ ku: "گواستنەوە بۆ باچی تر", en: "Move to another batch", ar: "انقل إلى دفعة أخرى", zh: "移到其他批次" })}
      </Link>

      {isAdmin && (
        <div className="col-span-2 grid gap-2 rounded-lg border p-2" data-testid="unchecked-carrier">
          <span className="flex items-center gap-1.5 text-xs font-medium"><Truck className="h-3.5 w-3.5" />{L({ ku: "پرسیار لە کۆمپانیا", en: "Ask the carrier", ar: "اسأل الشركة", zh: "询问承运商" })}</span>
          {contacts.length > 0 && !typing && (
            <div className="flex gap-2">
              <select value={picked} onChange={(e) => setPicked(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" data-testid="unchecked-contact">
                <option value="">{L({ ku: "کەسێک هەڵبژێرە", en: "Choose someone", ar: "اختر شخصاً", zh: "选择联系人" })}</option>
                {contacts.map((c) => <option key={c.number} value={c.number}>{c.name}</option>)}
              </select>
              <Button asChild={!!picked} size="sm" variant="outline" disabled={!picked} className="h-8">
                {picked
                  ? <a href={whatsappChatUrl(picked, carrierAskMessage(code, parcel.weightKg))} target="_blank" rel="noreferrer">{L({ ku: "بینێرە", en: "Send", ar: "أرسل", zh: "发送" })}</a>
                  : <span>{L({ ku: "بینێرە", en: "Send", ar: "أرسل", zh: "发送" })}</span>}
              </Button>
            </div>
          )}
          {(contacts.length === 0 || typing) ? (
            <>
              <p className="text-xs text-muted-foreground">{L({ ku: "هەر کەسێک لە ڕیزێک: ناو: ژمارە", en: "One person a line: name: number", ar: "شخص في كل سطر: الاسم: الرقم", zh: "每行一人：姓名：号码" })}</p>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} dir="auto" className="text-sm" data-testid="unchecked-contacts-text" />
              <Button type="button" size="sm" className="justify-self-start" disabled={save.isPending} onClick={() => save.mutate({ key: CARRIER_CONTACTS_KEY, value: draft })}>
                {L({ ku: "پاشەکەوت بکە", en: "Save", ar: "حفظ", zh: "保存" })}
              </Button>
            </>
          ) : (
            <button type="button" className="justify-self-start text-xs text-muted-foreground underline" onClick={() => { setDraft(raw); setTyping(true); }}>
              {L({ ku: "گۆڕینی ژمارەکان", en: "Change the numbers", ar: "تغيير الأرقام", zh: "修改号码" })}
            </button>
          )}
        </div>
      )}
    </>
  );
}
