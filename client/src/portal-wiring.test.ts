import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Nothing built and left unconnected.
 *
 * Four things were, and every one of them was written by me in a single day:
 * a share link a customer could create and never turn off, a WhatsApp test
 * endpoint with no button after I had told the owner to press it, and a
 * payment notice written and never called.
 *
 * None of them failed. None of them appeared in a test. They simply did
 * nothing, quietly, which is the only kind of bug that survives a green
 * suite — so this walks the seams between the two halves and refuses a
 * procedure with nobody calling it.
 */

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

/** Every .tsx under client/src, which is where a caller would live. */
function clientFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".tsx")) out.push(full);
    }
  };
  walk(path.join(ROOT, "client", "src"));
  return out;
}

const clientSource = (() => {
  let all = "";
  for (const f of clientFiles()) all += fs.readFileSync(f, "utf8");
  return all;
})();

describe("every procedure a customer needs has something calling it", () => {
  const PROCEDURES = [
    "getGreeting",
    "createShareLink",
    "revokeShareLink",
    "myShareLinks",
    "settlementView",
    "customerSummary",
    "discountReport",
    "testWhatsapp",
  ];

  it.each(PROCEDURES)("%s is reachable from a screen", (proc) => {
    expect(clientSource, `${proc} exists on the server and nothing calls it`)
      .toContain(`.${proc}.`);
  });
});

describe("a share link can be closed as well as opened", () => {
  const manager = read("client/src/components/portal/MyShareLinks.tsx");
  const home = read("client/src/pages/portal/PortalHome.tsx");

  it("is on the page, not only in the router", () => {
    // A link that cannot be seen cannot be turned off, and one sent to the
    // wrong chat is then out in the world for ninety days.
    expect(home).toContain("<MyShareLinks");
  });

  it("offers the revocation the server already supported", () => {
    expect(manager).toContain("revokeShareLink.useMutation");
    expect(manager).toContain('data-testid={`share-link-revoke-${link.id}`}');
  });

  it("says how far the link has travelled", () => {
    // A link sent to one person and opened forty times has gone further than
    // its owner meant, and only they can decide whether that matters.
    expect(manager).toContain("link.viewCount");
  });

  it("takes no space when nothing has been shared", () => {
    expect(manager).toContain("if (isLoading || !data || data.length === 0) return null;");
  });
});

describe("the WhatsApp setup can be proved rather than hoped", () => {
  const settings = read("client/src/pages/NotificationSettings.tsx");

  it("has the button, not only the endpoint", () => {
    expect(settings).toContain('data-testid="whatsapp-test-send"');
    expect(settings).toContain("notifications.testWhatsapp.useMutation");
  });

  it("says which failure it was, not that it failed", () => {
    // A wrong token and an unapproved template look identical from outside
    // and need completely different fixing.
    expect(settings).toContain("WHATSAPP_TEST_REASONS");
    for (const reason of ["unconfigured", "bad_number", "rejected", "unreachable"]) {
      expect(settings, `${reason} has no explanation`).toContain(`${reason}:`);
    }
  });
});

describe("money reaches the customer on both channels", () => {
  const settle = read("server/db/boxSettlement.db.ts");

  it("writes the portal notice", () => {
    expect(settle).toContain("createCustomerNotification({");
  });

  it("and sends the WhatsApp one, which was written and never called", () => {
    expect(settle).toContain("notifyPaymentReceived(customer.id, result.paidUsd, box.boxCode)");
  });

  it("waits for neither", () => {
    // The money is committed by then. Meta's reply time is its own problem.
    expect(settle).toContain("notifyPaymentReceived(customer.id, result.paidUsd, box.boxCode).catch(() => {});");
  });
});
