import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname);
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * A push notification is the only thing this system does that reaches a
 * customer who is not looking at it — it lights up a locked phone. Everything
 * else can be re-read; a push is heard once.
 */
describe("the phone is woken in the customer's own language", () => {
  it("sends a body per subscription, not one for everybody", () => {
    const src = read("services/push.service.ts");
    // A subscription records the language of the browser it was made from, so
    // one customer with a phone and a laptop in different languages gets each
    // in the right one.
    expect(src, "must build the payload per device").toContain("bodyFor(sub.language)");
    expect(src, "must fall back when a device reported no language")
      .toMatch(/payload\.title/);
    expect(src, "a single shared body is the bug this replaced")
      .not.toMatch(/\n\s*body,\n\s*\{ TTL/);
  });

  it("hands the stored translations to the push", () => {
    const src = read("db/portal.db.ts");
    const call = src.slice(src.indexOf("sendPushToCustomer(data.customerId"));
    for (const lang of ["ku:", "ar:", "zh:"]) {
      expect(call.slice(0, 900), `${lang} translation must be passed through`).toContain(lang);
    }
  });

  /**
   * Chinese was missing from the table itself, so a customer who chose 中文
   * had no translated row to send even if the push had wanted one.
   */
  it("stores Chinese alongside Kurdish and Arabic", () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, "../drizzle/schema/notifications.schema.ts"), "utf8");
    expect(schema).toContain('titleZh: varchar("titleZh"');
    expect(schema).toContain('messageZh: text("messageZh")');

    // The live table predates the column, so the additive patch has to be
    // there or production SELECTs the column and 500s.
    const patches = read("_core/migrations.ts");
    expect(patches).toContain("customerNotifications.titleZh");
    expect(patches).toContain("customerNotifications.messageZh");
  });

  it("names every movement a parcel can make", () => {
    const src = read("db/packages.db.ts");
    const table = src.slice(src.indexOf("const L: Record<string,"), src.indexOf("const m = L[data.status"));
    // `cancelled` was absent, so the one movement a customer most needs to
    // hear about was the one that went out silently.
    for (const status of ["received_china", "in_transit", "customs_processing",
      "received_local", "ready_for_delivery", "out_for_delivery",
      "delivered", "returned", "cancelled"]) {
      expect(table, `${status} must notify the customer`).toContain(`${status}:`);
    }
    // Four languages, on every line.
    const lines = table.split("\n").filter((l) => /^\s+\w+:\s+\{ en:/.test(l));
    expect(lines.length).toBeGreaterThanOrEqual(9);
    for (const line of lines) {
      for (const key of ["en:", "ku:", "ar:", "zh:"]) {
        expect(line, `${key} missing from: ${line.trim().slice(0, 40)}`).toContain(key);
      }
    }
  });

  it("subscribes with the language the customer chose, not the handset's", () => {
    const hook = fs.readFileSync(
      path.resolve(__dirname, "../client/src/hooks/usePushSubscription.ts"), "utf8");
    // navigator.language is the phone's setting. A Kurdish customer on an
    // English handset was being woken in English.
    expect(hook).toMatch(/language:\s*language \|\| navigator\.language/);
    expect(hook).toContain("useLanguage");
  });

  /**
   * Two screens render a notification row: the notifications centre and the
   * panel on the messages page. They had a picker each, and disagreed — so
   * the reader lives in one lib now and both must go through it.
   */
  it("renders the Chinese title wherever a notification is shown", () => {
    const lib = fs.readFileSync(
      path.resolve(__dirname, "../client/src/lib/portalNotificationText.ts"), "utf8");
    expect(lib, "must pick a Chinese translation").toMatch(/language === "zh" \? "Zh"/);
    // An empty translation is not a translation; it must fall back, not blank.
    expect(lib).toMatch(/translated\.trim\(\)/);

    for (const screen of ["PortalNotifications.tsx", "PortalMessages.tsx"]) {
      const src = fs.readFileSync(
        path.resolve(__dirname, "../client/src/pages/portal", screen), "utf8");
      expect(src, `${screen} must use the shared reader`).toContain("notificationText");
      expect(src, `${screen} must not pick a language itself`)
        .not.toMatch(/\bn\.title(?:Ku|Ar|Zh)\b/);
    }
  });
});
