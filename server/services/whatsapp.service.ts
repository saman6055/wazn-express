import { appLogger } from "../utils/logger";

/**
 * Sending a customer a WhatsApp message.
 *
 * In Iraq people live in WhatsApp, not in an app. A customer who gets "your
 * goods are in Erbil, come and collect" there does not phone the office to
 * ask — which is the whole reason this exists.
 *
 * Three things about WhatsApp that shape everything below.
 *
 * Outside a twenty-four hour window opened by the customer writing first,
 * Meta only delivers *template* messages: wording approved in advance, with
 * numbered placeholders. Free text is silently refused. So nothing here
 * composes a sentence — it fills in a template the company registered, and
 * the template name and its parameters are all that travel.
 *
 * Every message costs money. Not a lot, and far less than the phone call it
 * replaces, but enough that this is wired to the two or three events that
 * genuinely save a call rather than to everything that happens to a parcel.
 *
 * And it requires consent. `customerNotificationPrefs.whatsappEnabled`
 * defaults to false and stays false until somebody says otherwise; a customer
 * who never opted in is never messaged, whatever else is configured.
 */

export interface WhatsAppConfig {
  enabled: boolean;
  /** The permanent access token from the Meta app. */
  apiKey: string | null;
  /** The sending number's id, not the number itself. */
  phoneNumberId: string | null;
}

export interface WhatsAppTemplateMessage {
  /** E.164 without the plus, as Meta wants it: 9647501234567. */
  to: string;
  /** A template registered and approved in the WhatsApp Business account. */
  template: string;
  /** Which approved translation to deliver. */
  language: string;
  /** Ordered values for the template's {{1}}, {{2}}, … placeholders. */
  parameters?: string[];
}

export type WhatsAppResult =
  | { sent: true; messageId: string | null }
  | { sent: false; reason: "disabled" | "unconfigured" | "bad_number" | "rejected" | "unreachable" };

/**
 * Iraqi numbers as people actually write them, into what Meta accepts.
 *
 * Customers type 0750…, +964 750…, 00964750…, and with spaces and dashes
 * through the middle. All of them mean one number, and a message sent to a
 * malformed one is money spent on nothing.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  // A local Iraqi mobile: drop the trunk zero and prefix the country code.
  if (digits.startsWith("0")) digits = "964" + digits.slice(1);
  // Bare 7xxxxxxxxx, which is how a number is often stored here.
  else if (digits.startsWith("7") && digits.length === 10) digits = "964" + digits;

  // Long enough to be a real number, short enough to be one at all. Anything
  // outside that is a typo, and sending to it costs money for nothing.
  if (digits.length < 11 || digits.length > 15) return null;
  return digits;
}

/**
 * Send one template message.
 *
 * Never throws. WhatsApp being unreachable is not a reason for a delivery
 * scan to fail or for a screen to break — it is a reason for one message not
 * to arrive, and every caller here is doing something more important than
 * sending it.
 */
export async function sendWhatsAppTemplate(
  config: WhatsAppConfig,
  message: WhatsAppTemplateMessage,
): Promise<WhatsAppResult> {
  if (!config.enabled) return { sent: false, reason: "disabled" };
  if (!config.apiKey || !config.phoneNumberId) return { sent: false, reason: "unconfigured" };

  const to = toWhatsAppNumber(message.to);
  if (!to) return { sent: false, reason: "bad_number" };

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: message.template,
      language: { code: message.language },
      ...(message.parameters && message.parameters.length > 0
        ? {
            components: [{
              type: "body",
              parameters: message.parameters.map((text) => ({ type: "text", text })),
            }],
          }
        : {}),
    },
  };

  try {
    const controller = new AbortController();
    // Ten seconds. A caller is usually finishing something a person is
    // standing and waiting for.
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    clearTimeout(timer);

    if (!res.ok) {
      // The reply text is logged and never shown to anybody: it is written by
      // Meta, and error text from outside has no business reaching a screen.
      const detail = await res.text().catch(() => "");
      appLogger.warn("[WhatsApp] message refused", {
        status: res.status, template: message.template, detail: detail.slice(0, 400),
      });
      return { sent: false, reason: "rejected" };
    }

    const json = await res.json().catch(() => null) as any;
    return { sent: true, messageId: json?.messages?.[0]?.id ?? null };
  } catch (err) {
    appLogger.warn("[WhatsApp] could not be reached", {
      template: message.template,
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: "unreachable" };
  }
}

/**
 * The events worth the cost.
 *
 * Each is one a customer would otherwise telephone about, which is the test
 * for being on this list. Everything else stays in the portal, where it is
 * free and nobody is interrupted.
 */
export const WHATSAPP_EVENTS = {
  /** Goods are in the Erbil depot and can be collected. The big one. */
  readyForCollection: "wazn_ready_for_collection",
  /** Money taken, so nobody wonders whether it was recorded. */
  paymentReceived: "wazn_payment_received",
  /** Handed over, with what was paid. Closes the loop. */
  delivered: "wazn_delivered",
} as const;

export type WhatsAppEvent = (typeof WHATSAPP_EVENTS)[keyof typeof WHATSAPP_EVENTS];

/** Meta's language codes for the four the portal speaks. */
export function whatsappLanguageCode(language: string | null | undefined): string {
  switch (language) {
    case "ar": return "ar";
    case "en": return "en";
    case "zh": return "zh_CN";
    // Meta has no Kurdish. Arabic is the closest a reader here will accept,
    // and is what the templates are registered under.
    default: return "ar";
  }
}
