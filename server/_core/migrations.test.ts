/**
 * Tests for Wazn Express Auto-Migration System v2.0
 */

import { describe, it, expect } from "vitest";
import { TABLE_DEFINITIONS } from "./migrations";

describe("Migration System", () => {
  
  describe("TABLE_DEFINITIONS", () => {
    
    // A count, so adding a table is a deliberate act rather than something
    // that slips in. Bump it in the same commit that adds the table.
    it("should have 91 table definitions", () => {
      // 91 since customerFeatures — features handed to one customer at a
      // time, granted from Portal Center.
      expect(TABLE_DEFINITIONS.length).toBe(91);
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
