import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { normalizePhone, phoneVariants, samePhone } from "../shared/phone";

/**
 * The failure this exists to stop.
 *
 * A customer's number is stored as `07740427884`. They type `7740427884`.
 * The lookup compared with `=`, matched nothing, and the portal answered
 * "wrong phone number or password" — which named the password. Staff reset
 * the password, the customer still could not sign in, and the password had
 * never been the problem.
 */
describe("a phone number is the same number however it is written", () => {
  it("reduces every shape to the digits that identify it", () => {
    for (const written of [
      "07740427884",
      "7740427884",
      "+9647740427884",
      "009647740427884",
      "964 774 042 7884",
      "0774-042-7884",
      "+964 774 042 7884",
    ]) {
      expect(normalizePhone(written), written).toBe("7740427884");
    }
  });

  it("says two differently-written numbers are the same", () => {
    expect(samePhone("07740427884", "7740427884")).toBe(true);
    expect(samePhone("+964 774 042 7884", "07740427884")).toBe(true);
    expect(samePhone("07740427884", "07740427885")).toBe(false);
  });

  /**
   * The same number, typed on a keyboard set to Arabic or Kurdish. It looks
   * identical written down, and `\D` counted the digits as punctuation and
   * stripped them — so the number reduced to nothing and matched nobody.
   */
  it("reads Arabic-Indic digits as digits", () => {
    expect(normalizePhone("٠٧٧٤٠٤٢٧٨٨٤")).toBe("7740427884");
    expect(normalizePhone("۰۷۷۴۰۴۲۷۸۸۴")).toBe("7740427884");
    expect(samePhone("٠٧٧٤٠٤٢٧٨٨٤", "07740427884")).toBe(true);
  });

  it("the login screen and the server agree on what a number may contain", () => {
    const schemas = fs.readFileSync(path.resolve(__dirname, "routers/schemas.ts"), "utf8");
    const page = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CustomerLogin.tsx"), "utf8");
    // A number the server would accept must not be refused by the screen in
    // front of it — that refusal never reaches the lookup, so no fix below
    // can rescue it.
    const pattern = /\/\^\[\+\]\?\[[^\]]+\]\{7,20\}\$\//;
    const server = schemas.match(pattern)?.[0];
    expect(server, "phoneSchema must still be a single pattern").toBeTruthy();
    expect(page, "CustomerLogin must mirror it").toContain(server!);
    expect(server).toContain("٠-٩");
  });

  it("never matches on nothing", () => {
    // Two empty numbers are not the same customer.
    expect(samePhone("", "")).toBe(false);
    expect(samePhone(null, undefined)).toBe(false);
    expect(normalizePhone(null)).toBe("");
    expect(phoneVariants("")).toEqual([]);
  });

  it("offers every shape a row might already be stored as", () => {
    const v = phoneVariants("0750 123 4567");
    for (const shape of ["7501234567", "07501234567", "9647501234567", "+9647501234567"]) {
      expect(v, shape).toContain(shape);
    }
    // And what was actually typed, for anything this does not predict.
    expect(v).toContain("0750 123 4567");
  });
});

describe("the login looks a customer up by the number, not the spelling", () => {
  const DB = fs.readFileSync(path.resolve(__dirname, "db/customers.db.ts"), "utf8");
  const fn = DB.slice(
    DB.indexOf("export async function getCustomerByMobile"),
    DB.indexOf("export async function getCustomerByCode"),
  );

  it("matches every stored shape", () => {
    expect(fn).toContain("phoneVariants(mobileNumber)");
    expect(fn).toContain("inArray(customers.mobileNumber, variants)");
    expect(fn, "an equality here is the bug").not.toMatch(/eq\(customers\.mobileNumber, mobileNumber\)/);
  });

  /**
   * mobileNumber is not unique in the schema. Without preferring the exact
   * match, a customer who typed their number precisely as stored could be
   * handed a different account that merely normalises to the same digits.
   */
  it("prefers the row that matches exactly", () => {
    expect(fn).toContain("rows.find(r => r.mobileNumber === mobileNumber)");
  });

  /**
   * The variant list can only find shapes it predicted. A row holding
   * `0774 042 7884`, or `07740427884 ` with a trailing space from an import,
   * or `٠٧٧٤٠٤٢٧٨٨٤`, is the same number and matched none of them — and all
   * four look identical in the admin list, so the account looked fine and the
   * login refused anyway. That is the failure that survived the first fix.
   */
  it("falls back to reducing the stored column when no predicted shape matches", () => {
    expect(fn, "must not give up on the indexed lookup alone")
      .toContain("storedDigits()");
    const helper = DB.slice(DB.indexOf("function storedDigits"), DB.indexOf("function pickAccount"));
    for (const ch of [`" "`, `"-"`, `"+"`]) {
      expect(helper, `${ch} must be stripped from the stored value`).toContain(ch);
    }
    expect(helper, "Arabic-Indic digits must be folded").toContain("0x0660");
  });

  /**
   * The LIKE is a net: `%7740427884` also catches a longer number ending in
   * those digits. One rule has to decide, or the lookup and the normaliser
   * disagree about who a number belongs to.
   */
  it("lets normalizePhone make the final call, not the SQL", () => {
    expect(fn).toContain("normalizePhone(r.mobileNumber) === bare");
  });

  /**
   * Duplicates happen, and staff reset the password on the row they can see.
   * Silently checking a different row is the failure that reads as "the reset
   * did nothing" — which is how this whole thing got blamed on passwords.
   */
  it("prefers a row that could actually sign in over one that could not", () => {
    const picker = DB.slice(DB.indexOf("function pickAccount"), DB.indexOf("export async function getCustomerByCode"));
    expect(picker).toContain("r.isActive && !!r.passwordHash");
    // Still only after an exact match: typing your number precisely as stored
    // must not hand you somebody else's account.
    expect(picker.indexOf("=== mobileNumber")).toBeLessThan(picker.indexOf("r.isActive"));
  });

  /**
   * Fixing the lookup is the real repair; the hint only saves the customer
   * wondering which shape to use.
   */
  it("the login screen says both shapes work", () => {
    const page = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/CustomerLogin.tsx"), "utf8");
    expect(page).toMatch(/0750….*750…/s);
  });
});

describe("both reset screens set the same password", () => {
  const SHARED = fs.readFileSync(path.resolve(__dirname, "../shared/resetPassword.ts"), "utf8");
  const CENTRE = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/PortalCenter.tsx"), "utf8");
  const LIST = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Customers.tsx"), "utf8");

  /**
   * There are two places staff can reset a customer's password. The one thing
   * worse than a weak default is two different weak defaults, with staff
   * reading out whichever one they last saw — which is exactly the confusion
   * that made this look like a broken password feature in the first place.
   */
  it("the default lives in one place", () => {
    expect(SHARED).toContain('export const DEFAULT_RESET_PASSWORD = "123456"');
    for (const [name, src] of [["portal centre", CENTRE], ["customers list", LIST]] as const) {
      expect(src, `${name} must import it`).toContain("DEFAULT_RESET_PASSWORD");
      expect(src, `${name} must not restate it`).not.toMatch(/DEFAULT_RESET_PASSWORD\s*=\s*"/);
    }
  });

  it("both screens start with it filled in", () => {
    expect(CENTRE).toContain("useState(DEFAULT_RESET_PASSWORD)");
    expect(LIST).toContain("defaultValue={DEFAULT_RESET_PASSWORD}");
  });

  /**
   * Six digits is the shortest the server accepts. If that rule ever
   * tightens, this default stops working and staff find out by a reset
   * failing — so the two are pinned together here.
   */
  it("the default satisfies the server's own minimum", () => {
    const portalCentre = fs.readFileSync(
      path.resolve(__dirname, "routers/portalCenter.router.ts"), "utf8");
    const customers = fs.readFileSync(
      path.resolve(__dirname, "routers/customers.router.ts"), "utf8");
    expect(portalCentre).toMatch(/newPassword: z\.string\(\)\.min\(6\)/);
    expect(customers).toMatch(/newPassword: z\.string\(\)\.min\(6\)/);
    expect("123456".length).toBeGreaterThanOrEqual(6);
  });

  /**
   * A password that cannot be read back is a second phone call. Staff have to
   * be able to see what they are about to read out.
   */
  it("the customers list shows the password rather than masking it", () => {
    const at = LIST.indexOf('name="newPassword"');
    expect(LIST.slice(at - 200, at + 200)).not.toContain('type="password"');
  });
});

describe("why a customer cannot sign in is answerable", () => {
  const ROUTER = fs.readFileSync(path.resolve(__dirname, "routers/portalCenter.router.ts"), "utf8");
  const proc = ROUTER.slice(
    ROUTER.indexOf("diagnoseCustomerLogin"),
    ROUTER.indexOf("resetCustomerPassword: adminProcedure"),
  );

  /**
   * The login refuses in four ways and two of them print the same sentence:
   * "wrong phone number or password" covers both "no account with that
   * number" and "that password does not match". So staff reset the password,
   * the customer still cannot get in, staff reset it again, and nobody learns
   * anything. This separates them.
   */
  it("distinguishes every way the login refuses", () => {
    for (const step of ["no_account", "inactive", "no_password", "wrong_password", "ok"]) {
      expect(proc, `${step} must be reported`).toContain(`"${step}"`);
    }
  });

  it("looks the number up exactly as the login does", () => {
    // Same function, so a fix to one is a fix to both. Re-implementing the
    // lookup here would let the diagnostic disagree with the thing it
    // diagnoses.
    expect(proc).toContain("db.getCustomerByMobile(typed)");
  });

  it("says when the stored number is written differently", () => {
    // The number stored one way and typed another is the most common cause,
    // and it is invisible unless somebody says it out loud.
    expect(proc).toContain("storedDiffersFromTyped");
  });

  /**
   * Checking a password is the only way to tell the two identical messages
   * apart, so it must be possible — and recorded, because it is a password
   * check on somebody else's account even though it changes nothing.
   */
  it("is admin-only and audited", () => {
    expect(proc.slice(0, 200)).toContain("adminProcedure");
    expect(proc).toContain("bcrypt.compare");
    expect(proc).toContain('action: "diagnose_customer_login"');
  });

  /**
   * The hash may be compared against, never handed back. Reading it is how a
   * diagnostic becomes an offline cracking target.
   */
  it("never returns the hash", () => {
    // Comparing is fine; putting it in a returned object is not.
    expect(proc).toContain("bcrypt.compare(input.password, customer.passwordHash)");
    expect(proc, "must not be part of any return value")
      .not.toMatch(/(passwordHash|hash):\s*customer\.passwordHash/);
    expect(proc).not.toMatch(/return[^;]*customer\.passwordHash/s);
  });

  it("treats an empty password as 'do not test one'", () => {
    // Otherwise pressing the button with the field blank would report "wrong
    // password" for every account, which is worse than saying nothing.
    expect(proc).toContain("input.password === undefined");
    const page = fs.readFileSync(
      path.resolve(__dirname, "../client/src/pages/PortalCenter.tsx"), "utf8");
    expect(page).toContain("password: pw ? pw : undefined");
  });
});
