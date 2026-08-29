import { appLogger } from "../utils/logger";
import * as db from "../db";
import {
  sendWhatsAppTemplate,
  whatsappLanguageCode,
  WHATSAPP_EVENTS,
  type WhatsAppResult,
} from "./whatsapp.service";

/**
 * Sending one customer a WhatsApp message about their own goods.
 *
 * The layer between the raw sender and the places that want to use it. It
 * exists so that every caller gets the same three checks without having to
 * remember them: the company has it switched on, this customer asked for it,
 * and there is a number to send to.
 *
 * Consent is checked here rather than trusted from the caller. A customer who
 * never opted in must be unreachable by this channel even if somebody adds a
 * new call site in a hurry.
 */

/** Who may be messaged, and how. Null when any of the three checks fails. */
async function recipientFor(customerId: number): Promise<{
  to: string; language: string; code: string;
} | null> {
  const [customer, prefs] = await Promise.all([
    db.getCustomerById(customerId),
    db.getCustomerNotificationPrefs(customerId),
  ]);
  if (!customer) return null;

  // Opt-in, and only opt-in. Absent preferences mean absent consent.
  if (!prefs || (prefs as any).whatsappEnabled !== true) return null;

  const number = (customer as any).mobileNumber ?? null;
  if (!number) return null;

  return {
    to: number,
    language: whatsappLanguageCode((customer as any).preferredLanguage ?? null),
    code: (customer as any).customerCode ?? "",
  };
}

/**
 * The company's settings for one kind of message.
 *
 * Per event rather than global, because the table is: an admin can switch on
 * "your goods are in Erbil" without also switching on everything else that
 * might one day want this channel.
 */
async function companyConfig(eventType: string) {
  const row = await db.getNotificationSettingFor(eventType);
  return {
    enabled: Boolean(row?.whatsappEnabled),
    apiKey: row?.whatsappApiKey ?? null,
    phoneNumberId: row?.whatsappPhoneNumberId ?? null,
  };
}

/**
 * "Your goods are in Erbil, come and collect."
 *
 * The single message most worth sending: it is the one a customer telephones
 * the office to ask about, and the reason this channel is here at all.
 *
 * Never throws. A message failing must not fail the scan that triggered it —
 * the scan is the record, and a message can be sent again.
 */
export async function notifyReadyForCollection(
  customerId: number,
  parcelCount: number,
): Promise<WhatsAppResult> {
  try {
    const [config, who] = await Promise.all([
      companyConfig("ready_for_collection"),
      recipientFor(customerId),
    ]);
    if (!who) return { sent: false, reason: "disabled" };
    return await sendWhatsAppTemplate(config, {
      to: who.to,
      template: WHATSAPP_EVENTS.readyForCollection,
      language: who.language,
      parameters: [who.code, String(parcelCount)],
    });
  } catch (err) {
    appLogger.warn("[WhatsApp] ready-for-collection notice failed", {
      customerId, error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: "unreachable" };
  }
}

/** "We have your money." Sent once a box is settled, so nobody wonders. */
export async function notifyPaymentReceived(
  customerId: number,
  amountUsd: number,
  boxCode: string,
): Promise<WhatsAppResult> {
  try {
    const [config, who] = await Promise.all([
      companyConfig("payment_received"),
      recipientFor(customerId),
    ]);
    if (!who) return { sent: false, reason: "disabled" };
    return await sendWhatsAppTemplate(config, {
      to: who.to,
      template: WHATSAPP_EVENTS.paymentReceived,
      language: who.language,
      parameters: [amountUsd.toFixed(2), boxCode],
    });
  } catch (err) {
    appLogger.warn("[WhatsApp] payment notice failed", {
      customerId, error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: "unreachable" };
  }
}
