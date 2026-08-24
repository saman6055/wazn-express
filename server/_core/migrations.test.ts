/**
 * Tests for Wazn Express Auto-Migration System v2.0
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TABLE_DEFINITIONS, orderByDependencies, REQUIRED_COLUMNS } from "./migrations";

describe("Migration System", () => {
  
  describe("TABLE_DEFINITIONS", () => {
    
    // A count, so adding a table is a deliberate act rather than something
    // that slips in. Bump it in the same commit that adds the table.
    it("should have 93 table definitions", () => {
      // 93 since expenseBudgets — what the office means to spend, so the
      // screen can say how much is left while there is time to act. 92 was
      // dailySnapshots — the memory the morning brief compares
      // against. 91 was customerFeatures.
      expect(TABLE_DEFINITIONS.length).toBe(93);
    });
    
    it("should have unique table names", () => {
      const names = TABLE_DEFINITIONS.map(t => t.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });
    
    it("should have valid SQL for each table", () => {
      TABLE_DEFINITIONS.forEach(table => {
        expect(table.sql).toBeDefined();
        expect(table.sql.length).toBeGreaterThan(0);
        expect(table.sql.toUpperCase()).toContain("CREATE TABLE");
        expect(table.sql.toUpperCase()).toContain("IF NOT EXISTS");
      });
    });
    
    it("should have dependencies array for each table", () => {
      TABLE_DEFINITIONS.forEach(table => {
        expect(Array.isArray(table.dependencies)).toBe(true);
      });
    });
    
    it("should have all required core tables", () => {
      const tableNames = TABLE_DEFINITIONS.map(t => t.name);
      
      const requiredTables = [
        "users",
        "customers",
        "packages",
        "batches",
        "invoices",
        "paymentRecords",
        "customerAccounts",
        "ledgerTransactions",
        "auditLogs",
        "warehouses",
        "countries"
      ];
      
      requiredTables.forEach(required => {
        expect(tableNames).toContain(required);
      });
    });
    
    it("should have paymentRecords table with all required columns", () => {
      const paymentRecordsTable = TABLE_DEFINITIONS.find(t => t.name === "paymentRecords");
      expect(paymentRecordsTable).toBeDefined();
      
      const sql = paymentRecordsTable!.sql.toLowerCase();
      
      // Check for required columns that were missing before
      expect(sql).toContain("paymentstatus");
      expect(sql).toContain("receiptnumber");
      expect(sql).toContain("bankreference");
      expect(sql).toContain("receiptphoto");
      expect(sql).toContain("confirmedbyid");
      expect(sql).toContain("cancelledbyid");
      expect(sql).toContain("cancelreason");
      expect(sql).toContain("confirmedat");
      expect(sql).toContain("cancelledat");
    });
    
    it("should have tables ordered by dependency", () => {
      // Tables with no dependencies should come first
      const firstTables = TABLE_DEFINITIONS.slice(0, 20);
      const noDependencyTables = firstTables.filter(t => t.dependencies.length === 0);
      
      // At least 10 tables with no dependencies should be in the first 20
      expect(noDependencyTables.length).toBeGreaterThanOrEqual(10);
    });
    
    it("should reference only existing tables in dependencies", () => {
      const tableNames = TABLE_DEFINITIONS.map(t => t.name);
      
      TABLE_DEFINITIONS.forEach(table => {
        table.dependencies.forEach(dep => {
          expect(tableNames).toContain(dep);
        });
      });
    });
    
    it("should have ENGINE=InnoDB for all tables", () => {
      TABLE_DEFINITIONS.forEach(table => {
        expect(table.sql.toUpperCase()).toContain("ENGINE=INNODB");
      });
    });
    
    it("should have UTF8MB4 charset for all tables", () => {
      TABLE_DEFINITIONS.forEach(table => {
        expect(table.sql.toLowerCase()).toContain("utf8mb4");
      });
    });
    
  });
  
  describe("Table Structure Validation", () => {
    
    it("users table should have required columns", () => {
      const usersTable = TABLE_DEFINITIONS.find(t => t.name === "users");
      expect(usersTable).toBeDefined();
      
      const sql = usersTable!.sql.toLowerCase();
      expect(sql).toContain("id int auto_increment primary key");
      expect(sql).toContain("openid");
      expect(sql).toContain("role");
      expect(sql).toContain("createdat");
    });
    
    it("customers table should have required columns", () => {
      const customersTable = TABLE_DEFINITIONS.find(t => t.name === "customers");
      expect(customersTable).toBeDefined();
      
      const sql = customersTable!.sql.toLowerCase();
      expect(sql).toContain("customercode");
      expect(sql).toContain("fullname");
      expect(sql).toContain("mobilenumber");
      expect(sql).toContain("passwordhash");
    });
    
    it("packages table should have required columns", () => {
      const packagesTable = TABLE_DEFINITIONS.find(t => t.name === "packages");
      expect(packagesTable).toBeDefined();
      
      const sql = packagesTable!.sql.toLowerCase();
      expect(sql).toContain("packagecode");
      expect(sql).toContain("trackingnumber");
      expect(sql).toContain("customerid");
      expect(sql).toContain("status");
      expect(sql).toContain("weightkg");
    });
    
    it("batches table should have required columns", () => {
      const batchesTable = TABLE_DEFINITIONS.find(t => t.name === "batches");
      expect(batchesTable).toBeDefined();
      
      const sql = batchesTable!.sql.toLowerCase();
      expect(sql).toContain("batchcode");
      expect(sql).toContain("shippingtype");
      expect(sql).toContain("status");
    });
    
    it("ledgerTransactions table should have required columns", () => {
      const ledgerTable = TABLE_DEFINITIONS.find(t => t.name === "ledgerTransactions");
      expect(ledgerTable).toBeDefined();
      
      const sql = ledgerTable!.sql.toLowerCase();
      expect(sql).toContain("accountid");
      expect(sql).toContain("transactionnumber");
      expect(sql).toContain("transactiontype");
      expect(sql).toContain("debitusd");
      expect(sql).toContain("creditusd");
    });
    
  });
  
});

/**
 * A table is created before the tables it points at, and a table that will not
 * create does not silence the repairs.
 *
 * packageOrderLinks declares `dependencies: ["packages", ...]` and carries a
 * foreign key to packages(id) — but the runner created tables in array order
 * and packages sits 300 lines further down, so MySQL answered "Failed to open
 * the referenced table" on every deploy. That one failure returned out of
 * autoMigrate before runSchemaPatches, so every ALTER in SCHEMA_PATCHES was
 * dead: columns the code writes stayed missing, and the screens that used them
 * failed with an error naming a column rather than the cause.
 */
describe("the migration runner finishes its work", () => {
  it("creates every table after the tables it depends on", () => {
    const position = new Map<string, number>();
    orderByDependencies(TABLE_DEFINITIONS).forEach((t, i) => position.set(t.name, i));

    expect(position.size, "ordering dropped or duplicated a table").toBe(TABLE_DEFINITIONS.length);

    for (const table of TABLE_DEFINITIONS) {
      for (const dep of table.dependencies) {
        if (!position.has(dep)) continue; // checked separately below
        expect(
          position.get(dep)!,
          `${table.name} is created before ${dep}, which it depends on`,
        ).toBeLessThan(position.get(table.name)!);
      }
    }
  });

  it("actually creates them in that order", () => {
    // The ordering above is only worth anything if the runner uses it. It sat
    // unread in every definition for as long as the file has existed.
    const src = fs.readFileSync(path.join(__dirname, "migrations.ts"), "utf8");
    expect(src, "runMigrations must loop over the dependency-ordered list")
      .toContain("for (const table of orderByDependencies(TABLE_DEFINITIONS))");
  });

  it("names a real table in every dependency", () => {
    // A typo here reads as "no dependency" and silently restores the old order.
    const names = new Set(TABLE_DEFINITIONS.map((t) => t.name));
    for (const table of TABLE_DEFINITIONS) {
      for (const dep of table.dependencies) {
        expect(names.has(dep), `${table.name} depends on "${dep}", which is not a table`).toBe(true);
      }
    }
  });

  it("still runs the schema patches when a table failed to create", () => {
    const src = fs.readFileSync(path.join(__dirname, "autoMigrate.ts"), "utf8");

    const start = src.indexOf("const migrationResult = await runMigrations");
    expect(start, "runMigrations call not found in autoMigrate").toBeGreaterThan(-1);
    const end = src.indexOf("runSchemaPatches", start);
    expect(end, "runSchemaPatches call not found after runMigrations").toBeGreaterThan(start);

    const between = src.slice(start, end);
    expect(between.length, "slice between the two calls is empty").toBeGreaterThan(50);
    expect(between, "a failed table must not return before the patches run").not.toContain("return result");
  });
});

/**
 * A named ALTER is a guess at what the live table is missing, and a guess can
 * be wrong more than once: the patches said `exchangeRate`, and what the live
 * expenses table actually lacked was `categoryId`. MySQL names only the first
 * column it cannot find, so each deploy revealed one and the next was waiting
 * behind it. REQUIRED_COLUMNS says what the table must end up with instead,
 * and the reconciler reads the live table to work out the difference.
 *
 * This test is the thing that keeps the list honest as the schema grows.
 */
describe("the columns the code writes all have somewhere to go", () => {
  const schemaColumns = (table: string, file: string) => {
    const src = fs.readFileSync(
      path.join(__dirname, "..", "..", "drizzle", "schema", file),
      "utf8",
    );
    const start = src.indexOf(`export const ${table} = mysqlTable("${table}", {`);
    expect(start, `${table} not found in ${file}`).toBeGreaterThan(-1);
    // The declaration ends at the first line that closes the object, whether
    // the table has an index block after it or not.
    const withIndexes = src.indexOf("}, (table)", start);
    const plain = src.indexOf("\n});", start);
    const end = withIndexes > -1 && (plain === -1 || withIndexes < plain) ? withIndexes : plain;
    expect(end, `could not find the end of ${table}`).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body.length, "schema slice is empty").toBeGreaterThan(100);
    return [...body.matchAll(/^ {2}(\w+): /gm)].map((m) => m[1]!);
  };

  for (const table of Object.keys(REQUIRED_COLUMNS)) {
    it(`${table}: every declared column is in REQUIRED_COLUMNS`, () => {
      const declared = schemaColumns(table, "finance.schema.ts");
      const required = new Set(REQUIRED_COLUMNS[table]!.map((c) => c.name));
      for (const column of declared) {
        // `id` is the auto-increment key; it cannot be added after the fact
        // and a table without one is not repairable by widening.
        if (column === "id") continue;
        expect(required.has(column), `${table}.${column} is written by the code but not in REQUIRED_COLUMNS`).toBe(true);
      }
    });

    it(`${table}: nothing in REQUIRED_COLUMNS was invented`, () => {
      const declared = new Set(schemaColumns(table, "finance.schema.ts"));
      for (const column of REQUIRED_COLUMNS[table]!) {
        expect(declared.has(column.name), `${table}.${column.name} is not a column the code writes`).toBe(true);
      }
    });

    it(`${table}: every added column is nullable or carries a default`, () => {
      // A column added NOT NULL with no default cannot be added to a table
      // that already has rows — MySQL has nothing to put in them.
      for (const column of REQUIRED_COLUMNS[table]!) {
        const ddl = column.ddl.toUpperCase();
        const safe = !ddl.includes("NOT NULL") || ddl.includes("DEFAULT");
        expect(safe, `${table}.${column.name} would fail on a table with rows: ${column.ddl}`).toBe(true);
      }
    });
  }

  it("runs after the patches, on every boot", () => {
    const src = fs.readFileSync(path.join(__dirname, "autoMigrate.ts"), "utf8");
    const patches = src.indexOf("runSchemaPatches({");
    const reconcile = src.indexOf("reconcileColumns({");
    expect(patches, "runSchemaPatches not called").toBeGreaterThan(-1);
    expect(reconcile, "reconcileColumns is not called at boot").toBeGreaterThan(patches);
  });
});
