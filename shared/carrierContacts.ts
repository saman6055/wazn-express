import { whatsappNumber } from "./receiptWhatsApp";

/**
 * Who to ask at the carriers about a parcel. Kept in a setting, one person a
 * line as "name: number", because these are people's numbers and the
 * repository is public (owner, 2026-11-01).
 */
export const CARRIER_CONTACTS_KEY = "carrier_contacts";

export function parseCarrierContacts(raw: string | null | undefined): Array<{ name: string; number: string }> {
  return String(raw ?? "")
    .split(/\r?\n/)
    .map((line) => {
      const at = line.lastIndexOf(":");
      if (at <= 0) return null;
      const number = whatsappNumber(line.slice(at + 1).replace(/^\s*\+/, "00"));
      const name = line.slice(0, at).trim();
      return number && name ? { name, number } : null;
    })
    .filter((c): c is { name: string; number: string } => c !== null);
}

/** Ready for a person to read and send. */
export function customerAskMessage(tracking: string): string {
  return `سڵاو، پاکێجی ${tracking} گەیشتووەتە دەستت؟ تکایە پێمان بڵێ بۆ ئەوەی لە سیستەم چاکی بکەین. سوپاس`;
}

export function carrierAskMessage(tracking: string, weightKg?: string | null): string {
  const kg = Number(weightKg) > 0 ? ` (${Number(weightKg)} kg)` : "";
  return `سڵاو، پاکێجی ${tracking}${kg} لە بارەکەدا نەگەیشتووە. تکایە بپشکنن لای ئێوە ماوە یان نا. سوپاس`;
}
