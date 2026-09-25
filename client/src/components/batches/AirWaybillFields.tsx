import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { pickLang } from "@/lib/lang";
import { useTranslation } from "@/contexts/LanguageContext";
import { parseAwb } from "@shared/airWaybill";

/**
 * The waybill number, and the airline it already contains.
 *
 * The owner, 2026-09-25: "after I enter the AWB, can the system fill the
 * other fields in by searching the web?"
 *
 * Two of them need no searching. The first three digits of a waybill are the
 * airline's own IATA prefix, and the last digit of the serial is the first
 * seven modulo seven — so the airline fills itself the moment the number is
 * complete, and a number typed wrong says so on the spot.
 *
 * That second part is the one that pays: a mistyped waybill is on no board,
 * so the shipment quietly stops being watched and the first anybody hears is
 * a customer telephoning. It used to be caught by nothing at all.
 *
 * The flight number is not here and cannot be: a waybill names the airline,
 * not the aeroplane. Which flight the shipment was loaded onto lives in that
 * airline's cargo system, and reading it means a scraper per carrier. It
 * stays typed by hand.
 *
 * Uncontrolled inputs with `name`, like the rest of this form — the dialog
 * still reads them with formData, and nothing else had to change.
 */

const WORDS = {
  awb: { ku: "ژمارەی بارنامەی ئاسمانی (AWB)", en: "Air waybill (AWB)", ar: "بوليصة الشحن الجوي", zh: "航空运单 (AWB)" },
  airline: { ku: "ناوی خەتی تەیارە", en: "Airline", ar: "شركة الطيران", zh: "航空公司" },
  recognised: {
    ku: "ناسرایەوە لە ژمارەکەوە",
    en: "Recognised from the number",
    ar: "معروفة من الرقم",
    zh: "已从号码识别",
  },
  wrong: {
    ku: "ئەم ژمارەیە هەڵەیە — ژمارەی کۆتایی ناگونجێت. دووبارە بیپشکنە، چونکە ژمارەیەکی هەڵە لە هیچ تەختەیەکی فڕۆکەخانە نادۆزرێتەوە.",
    en: "This number is wrong — the check digit does not match. A wrong waybill is on no arrivals board.",
    ar: "هذا الرقم خاطئ — رقم التحقق لا يطابق. رقم خاطئ لا يظهر على أي لوحة وصول.",
    zh: "号码有误 — 校验位不符。错误的运单号在任何到达看板上都查不到。",
  },
} as const;

export function AirWaybillFields({
  defaultAwb = "",
  defaultAirline = "",
}: {
  defaultAwb?: string;
  defaultAirline?: string;
}) {
  const { language } = useTranslation();
  const L = (w: { ku: string; en: string; ar: string; zh: string }) => pickLang(language, w);

  const [awb, setAwb] = useState(defaultAwb);
  const [airline, setAirline] = useState(defaultAirline);
  // Filled from the number only while nobody has typed over it.
  const [airlineTouched, setAirlineTouched] = useState(Boolean(defaultAirline));

  const parsed = parseAwb(awb);
  const wrong = parsed !== null && !parsed.checkDigitValid;

  const onAwb = (value: string) => {
    setAwb(value);
    const next = parseAwb(value);
    if (next?.airline && !airlineTouched) setAirline(next.airline);
  };

  return (
    <>
      <div className="grid gap-1.5">
        <Label className="text-xs">{L(WORDS.airline)}</Label>
        <Input
          name="airlineName"
          value={airline}
          onChange={(e) => {
            setAirline(e.target.value);
            setAirlineTouched(e.target.value.length > 0);
          }}
          placeholder="Turkish Airlines"
          className="h-9"
          data-testid="batch-airline"
        />
        {parsed?.airline && airline === parsed.airline && (
          <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {L(WORDS.recognised)}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">{L(WORDS.awb)}</Label>
        <Input
          name="awbNumber"
          value={awb}
          onChange={(e) => onAwb(e.target.value)}
          placeholder="235-98651733"
          className={cn("h-9 font-mono", wrong && "border-red-400 dark:border-red-700")}
          dir="ltr"
          data-testid="batch-awb"
        />
        {wrong && (
          <p className="flex items-start gap-1 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {L(WORDS.wrong)}
          </p>
        )}
      </div>
    </>
  );
}
