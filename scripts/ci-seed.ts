/**
 * The minimum a blank database needs before the suite can run.
 *
 * Fifteen of these tests open with "No customer found in database", "No
 * warehouses found for testing" and the like — they were written against a
 * developer's populated database and assume somebody, somewhere, already
 * created the basics. On a fresh CI database they abort before asserting
 * anything, so a green run would mean nothing.
 *
 * This seeds only what those tests actually look for: one staff user, one
 * origin country and one destination, one warehouse, one customer. Nothing
 * business-specific, no fixtures the tests could accidentally come to depend
 * on for their assertions — just enough that they get past their preamble and
 * exercise the code they were written for.
 *
 * Idempotent: re-running adds nothing, so it is safe to call before every run.
 */
import { getDb, closeDb } from "../server/db/connection";
import { users, countries, warehouses, customers } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  // ---- staff user (owner of everything else) ----
  let [staff] = await db.select().from(users).where(eq(users.role, "super_admin")).limit(1);
  if (!staff) {
    await db.insert(users).values({
      username: "ci-admin",
      name: "CI Admin",
      role: "super_admin",
      isActive: true,
    });
    [staff] = await db.select().from(users).where(eq(users.username, "ci-admin")).limit(1);
    console.log("seeded: staff user");
  }

  // ---- countries: tests ask for an origin AND a destination ----
  let [origin] = await db.select().from(countries).where(eq(countries.isoCode, "CHN")).limit(1);
  if (!origin) {
    await db.insert(countries).values({
      nameEn: "China", nameKu: "چین", isoCode: "CHN",
      defaultCurrency: "CNY", isActive: true, isOrigin: true, isDestination: false,
    });
    [origin] = await db.select().from(countries).where(eq(countries.isoCode, "CHN")).limit(1);
    console.log("seeded: origin country");
  }

  let [destination] = await db.select().from(countries).where(eq(countries.isoCode, "IRQ")).limit(1);
  if (!destination) {
    await db.insert(countries).values({
      nameEn: "Iraq", nameKu: "عێراق", isoCode: "IRQ",
      defaultCurrency: "IQD", isActive: true, isOrigin: false, isDestination: true,
    });
    [destination] = await db.select().from(countries).where(eq(countries.isoCode, "IRQ")).limit(1);
    console.log("seeded: destination country");
  }

  // ---- warehouse in the origin country ----
  const [warehouse] = await db.select().from(warehouses).limit(1);
  if (!warehouse) {
    await db.insert(warehouses).values({
      nameEn: "CI Warehouse", nameKu: "کۆگای تاقیکردنەوە",
      countryId: origin.id, city: "Guangzhou", isActive: true,
    });
    console.log("seeded: warehouse");
  }

  // ---- one customer ----
  const [customer] = await db.select().from(customers).limit(1);
  if (!customer) {
    await db.insert(customers).values({
      customerCode: "CI001(CI Customer)",
      sequenceNumber: 1,
      fullName: "CI Customer",
      mobileNumber: "07500000000",
      // Not a usable credential: this database is created and destroyed inside
      // one CI job and never accepts a login.
      passwordHash: "ci-not-a-real-hash",
      isActive: true,
      createdById: staff.id,
    });
    console.log("seeded: customer");
  }

  console.log("Seed complete.");
  await closeDb();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  await closeDb().catch(() => {});
  process.exit(1);
});
