/**
 * Bulk Customer Import Script
 * Reads CSV and inserts customers directly into the database.
 * Skips duplicates by customerCode or mobileNumber.
 * Usage: npx tsx scripts/import-customers.ts
 */
import * as fs from "fs";
import * as bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { customers, customerAccounts } from "../drizzle/schema/users.schema";
import { eq, sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config();

const CSV_PATH = process.argv[2] || "C:/Users/saman/Downloads/PART-2 _ Wazn Main System 2026 - Customer Info.csv";
const DEFAULT_PASSWORD = "12345678";

// Simple CSV parser that handles quoted fields with commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set. Set it in .env or as environment variable.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const connection = await mysql.createConnection(dbUrl);
  const db = drizzle(connection);

  // Read CSV
  const csvContent = fs.readFileSync(CSV_PATH, "utf8");
  const lines = csvContent.trim().split("\n");
  const header = parseCSVLine(lines[0]);
  console.log("CSV Header:", header);
  console.log(`Found ${lines.length - 1} customers to import\n`);

  // Hash password once (reuse for all customers)
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // Get existing customer codes and phones to skip duplicates
  const existingCustomers = await db.select({
    code: customers.customerCode,
    mobile: customers.mobileNumber,
  }).from(customers);

  const existingCodes = new Set(existingCustomers.map((c) => c.code?.toUpperCase()));
  const existingPhones = new Set(existingCustomers.map((c) => c.mobile?.replace(/[\s-]/g, "")));

  console.log(`Existing customers in DB: ${existingCustomers.length}`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    // CSV columns: ID, Name, Gender, Code, Phone 1, Phone 2, Email, Address, Customer Type, Notes
    const [_id, name, gender, code, phone1, phone2, email, address, _customerType, notes] = cols;

    if (!name || !code || !phone1) {
      console.log(`  [SKIP] Row ${i}: Missing name/code/phone`);
      skipped++;
      continue;
    }

    // Clean up phone and code
    const cleanPhone = phone1.replace(/[\s-]/g, "");
    const cleanCode = code.trim();

    // Check for duplicates
    if (existingCodes.has(cleanCode.toUpperCase())) {
      console.log(`  [SKIP] ${cleanCode} - ${name} (code exists)`);
      skipped++;
      continue;
    }
    if (existingPhones.has(cleanPhone)) {
      console.log(`  [SKIP] ${cleanCode} - ${name} (phone ${cleanPhone} exists)`);
      skipped++;
      continue;
    }

    // Extract sequence number from code (e.g., AZ042 → 42)
    const seqMatch = cleanCode.match(/(\d+)/);
    const sequenceNumber = seqMatch ? parseInt(seqMatch[1], 10) : i;

    // Build customer code in system format: AZ001(Name)
    const customerCode = `${cleanCode}(${name.trim()})`;

    try {
      const result = await db.insert(customers).values({
        customerCode,
        sequenceNumber,
        fullName: name.trim(),
        gender: gender?.toLowerCase() === "female" ? "female" : gender?.toLowerCase() === "male" ? "male" : undefined,
        mobileNumber: cleanPhone,
        secondaryMobile: phone2?.replace(/[\s-]/g, "") || undefined,
        email: email?.trim() || undefined,
        address: address?.trim() || undefined,
        passwordHash,
        country: "Iraq",
        isActive: true,
        notes: notes?.trim() || undefined,
        createdById: 1, // Admin user
      });

      const insertId = (result as any)[0].insertId;

      // Create customer account (wallet)
      try {
        await db.insert(customerAccounts).values({
          customerId: insertId,
          accountNumber: `ACC-${customerCode}-${new Date().getFullYear()}`,
          currentBalanceUsd: "0",
          currentBalanceIqd: "0",
          packageDebtUsd: "0",
          fullPackageDebtUsd: "0",
          purchaseRequestDebtUsd: "0",
          commissionDebtUsd: "0",
          serviceDebtUsd: "0",
          creditBalanceUsd: "0",
          creditBalanceIqd: "0",
          totalDebitUsd: "0",
          totalCreditUsd: "0",
          totalDebitIqd: "0",
          totalCreditIqd: "0",
        });
      } catch (accErr) {
        // Account creation failure is not critical
      }

      // Track new codes/phones to avoid self-duplicates within this batch
      existingCodes.add(cleanCode.toUpperCase());
      existingPhones.add(cleanPhone);

      imported++;
      console.log(`  [OK] ${cleanCode} - ${name.trim()} (ID: ${insertId})`);
    } catch (err: any) {
      if (err.message?.includes("Duplicate")) {
        console.log(`  [SKIP] ${cleanCode} - ${name} (duplicate in DB)`);
        skipped++;
      } else {
        console.error(`  [ERROR] ${cleanCode} - ${name}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n========== IMPORT COMPLETE ==========`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${imported + skipped + errors}`);

  // Show next sequence number
  const maxSeq = await db.select({ max: sql<number>`MAX(sequenceNumber)` }).from(customers);
  console.log(`\n  Next AZ sequence will be: AZ${String((maxSeq[0]?.max || 0) + 1).padStart(3, "0")}`);

  await connection.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
