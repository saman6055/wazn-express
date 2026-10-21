import type { ReactNode } from "react";
import { Download, FileDown, Image as ImageIcon, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import type { ReceiptLanguage } from "@shared/receiptWhatsApp";
import type { ReceiptShareDestination, ReceiptShareFormat } from "@/lib/receiptShare";

/**
 * How a receipt goes to the customer: the language of the paper and the
 * message, then WhatsApp as a picture or a PDF, another app, or a file.
 *
 * One menu for the box's «ناردنی وەسڵ» and for the window before printing
 * (owner, 2026-10-21: «ناردن بە تەواوی وەکو ئەوەی ئێستا هەیە بیهێنە بۆ بەشی
 * چاپ لە تەنیشت دوگمەی چاپ»), so the two cannot drift apart.
 */
export function ReceiptSendMenu({
  uiLanguage,
  sendLanguage,
  onSendLanguage,
  onPick,
  trigger,
  align = "end",
}: {
  uiLanguage: string;
  sendLanguage: ReceiptLanguage;
  onSendLanguage: (code: ReceiptLanguage) => void;
  onPick: (format: ReceiptShareFormat, destination: ReceiptShareDestination) => void;
  trigger: ReactNode;
  align?: "start" | "end" | "center";
}) {
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(uiLanguage, w);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} data-testid="receipt-send-menu">
        <DropdownMenuLabel>
          {L({ ku: "ناردن بۆ وەتسئاپ", en: "Send on WhatsApp", ar: "إرسال عبر واتساب", zh: "通过 WhatsApp 发送" })}
        </DropdownMenuLabel>
        {/* The language the paper and the message will both be in. It comes
            from the customer's nationality and can be changed here (owner,
            2026-09-24). */}
        <div className="px-2 pb-1.5">
          <p className="mb-1 text-[11px] text-muted-foreground">
            {L({ ku: "زمانی وەسڵ و پەیام", en: "Receipt and message language", ar: "لغة الإيصال والرسالة", zh: "收据与消息语言" })}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {(["ku", "ar", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={(e) => { e.preventDefault(); onSendLanguage(code); }}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                  sendLanguage === code
                    ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
                data-testid={`receipt-language-${code}`}
              >
                {code === "ku" ? "کوردی" : code === "ar" ? "عربي" : "English"}
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onPick("image", "whatsapp")} data-testid="send-whatsapp-image">
          <ImageIcon className="me-2 h-4 w-4 opacity-70" />
          {L({ ku: "وەتسئاپ — وەک وێنە", en: "WhatsApp — as a picture", ar: "واتساب — كصورة", zh: "WhatsApp — 图片" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("pdf", "whatsapp")} data-testid="send-whatsapp-pdf">
          <FileDown className="me-2 h-4 w-4 opacity-70" />
          {L({ ku: "وەتسئاپ — وەک PDF", en: "WhatsApp — as a PDF", ar: "واتساب — كملف PDF", zh: "WhatsApp — PDF" })}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onPick("image", "share")}>
          <Share2 className="me-2 h-4 w-4 opacity-70" />
          {L({ ku: "شێر بۆ بەرنامەیەکی تر", en: "Share with another app", ar: "مشاركة مع تطبيق آخر", zh: "分享到其他应用" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("image", "save")}>
          <Download className="me-2 h-4 w-4 opacity-70" />
          {L({ ku: "خەزنکردن — وێنە", en: "Save the picture", ar: "حفظ الصورة", zh: "保存图片" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("pdf", "save")}>
          <Download className="me-2 h-4 w-4 opacity-70" />
          {L({ ku: "خەزنکردن — PDF", en: "Save the PDF", ar: "حفظ ملف PDF", zh: "保存 PDF" })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
