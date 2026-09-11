import { fmtKg, fmtNumber, fmtUsd } from "../portalFormat";
import { toPlainDigits } from "./cleanPaste";

/**
 * Texts staff send about a parcel, written the same way every time: the
 * WhatsApp note for "your parcels have arrived" and the few lines pasted into
 * a chat about one parcel. Figures are 0-9 and come from the shared
 * formatters, so a message says exactly what the screen says.
 */

export interface ArrivalNotice {
  customerName?: string | null;
  customerCode?: string | null;
  parcels: number;
  weightKg?: number | null;
  amountUsd?: number | null;
  trackingNumbers?: readonly string[];
  /** Where to collect them; the warehouse when not given. */
  place?: string | null;
  companyName?: string | null;
}

export function arrivalMessage(notice: ArrivalNotice): string {
  const company = notice.companyName?.trim() || "Wazn Express";
  const name = notice.customerName?.trim() || "بەڕێز";
  const lines = [
    `سڵاو ${name}${notice.customerCode ? ` (${notice.customerCode})` : ""}،`,
    `${Math.max(0, Math.round(notice.parcels))} بارت گەیشتووەتە ${notice.place?.trim() || `کۆگای ${company}`}.`,
  ];
  if (typeof notice.weightKg === "number" && notice.weightKg > 0) lines.push(`کێش: ${fmtKg(notice.weightKg)}`);
  if (typeof notice.amountUsd === "number" && notice.amountUsd > 0) lines.push(`بڕی ماوە: ${fmtUsd(notice.amountUsd)}`);
  if (notice.trackingNumbers?.length) lines.push(`تراکینگ: ${notice.trackingNumbers.join("، ")}`);
  lines.push(`سوپاس بۆ متمانەت بە ${company}.`);
  return lines.join("\n");
}

/**
 * The number WhatsApp wants: country code first, digits only. An Iraqi
 * mobile written the local way (0750 123 4567) gains 964 and loses the 0.
 * Null when there is no usable number.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  let digits = toPlainDigits(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("07")) digits = `964${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("7")) digits = `964${digits}`;
  return digits.length >= 11 ? digits : null;
}

/** A wa.me link that opens a chat with the text already written; nothing is sent until staff press send. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

export interface WaybillLike {
  trackingNumber?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  weightKg?: number | string | null;
  volumeCbm?: number | string | null;
  /** The status as the screen shows it, already in words. */
  statusLabel?: string | null;
  batchCode?: string | null;
  boxCode?: string | null;
}

/** The few lines about one parcel, for a chat: empty fields are left out. */
export function waybillSummary(parcel: WaybillLike): string {
  const figure = (v: number | string | null | undefined) => (v != null && Number(v) > 0 ? Number(v) : null);
  const weight = figure(parcel.weightKg);
  const volume = figure(parcel.volumeCbm);
  const rows: [string, string | null | undefined][] = [
    ["تراکینگ", parcel.trackingNumber],
    ["کڕیار", [parcel.customerCode, parcel.customerName].filter(Boolean).join(" · ") || null],
    ["کێش", weight !== null ? fmtKg(weight) : null],
    ["قەبارە", volume !== null ? `${fmtNumber(volume, 3)} CBM` : null],
    ["باچ", parcel.batchCode],
    ["بۆکس", parcel.boxCode],
    ["دۆخ", parcel.statusLabel],
  ];
  return rows
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}
