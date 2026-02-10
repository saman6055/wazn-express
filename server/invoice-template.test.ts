import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Invoice Template System', () => {
  
  describe('getInvoiceTemplates', () => {
    it('should return an array of templates', async () => {
      const templates = await db.getInvoiceTemplates();
      expect(Array.isArray(templates)).toBe(true);
    });
  });

  describe('ensureDefaultInvoiceTemplate', () => {
    it('should create or return a default template', async () => {
      const template = await db.ensureDefaultInvoiceTemplate();
      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.isDefault).toBe(true);
    });

    it('should return the same template on subsequent calls', async () => {
      const template1 = await db.ensureDefaultInvoiceTemplate();
      const template2 = await db.ensureDefaultInvoiceTemplate();
      expect(template1.id).toBe(template2.id);
    });
  });

  describe('getDefaultInvoiceTemplate', () => {
    it('should return the default template after ensureDefault', async () => {
      await db.ensureDefaultInvoiceTemplate();
      const template = await db.getDefaultInvoiceTemplate();
      expect(template).toBeDefined();
      expect(template?.isDefault).toBe(true);
    });
  });

  describe('getInvoiceTemplateById', () => {
    it('should return a template by ID', async () => {
      const defaultTemplate = await db.ensureDefaultInvoiceTemplate();
      const template = await db.getInvoiceTemplateById(defaultTemplate.id);
      expect(template).toBeDefined();
      expect(template?.id).toBe(defaultTemplate.id);
    });

    it('should return null for non-existent ID', async () => {
      const template = await db.getInvoiceTemplateById(999999);
      expect(template).toBeNull();
    });
  });

  describe('updateInvoiceTemplate', () => {
    it('should update template fields', async () => {
      const defaultTemplate = await db.ensureDefaultInvoiceTemplate();
      const newCompanyName = 'Updated Company ' + Date.now();
      
      const updated = await db.updateInvoiceTemplate(defaultTemplate.id, {
        companyName: newCompanyName,
      });
      
      expect(updated).toBeDefined();
      expect(updated?.companyName).toBe(newCompanyName);
    });

    it('should update colors', async () => {
      const defaultTemplate = await db.ensureDefaultInvoiceTemplate();
      const newColor = '#ff5500';
      
      const updated = await db.updateInvoiceTemplate(defaultTemplate.id, {
        primaryColor: newColor,
      });
      
      expect(updated?.primaryColor).toBe(newColor);
    });

    it('should update style', async () => {
      const defaultTemplate = await db.ensureDefaultInvoiceTemplate();
      
      const updated = await db.updateInvoiceTemplate(defaultTemplate.id, {
        style: 'classic',
      });
      
      expect(updated?.style).toBe('classic');
      
      // Reset to modern for other tests
      await db.updateInvoiceTemplate(defaultTemplate.id, { style: 'modern' });
    });
  });

  describe('Template fields validation', () => {
    it('should have all required fields in default template', async () => {
      const template = await db.ensureDefaultInvoiceTemplate();
      
      // Check essential fields exist
      expect(template.name).toBeDefined();
      expect(template.style).toBeDefined();
      expect(template.primaryColor).toBeDefined();
      expect(template.secondaryColor).toBeDefined();
      expect(template.textColor).toBeDefined();
      expect(template.fontSize).toBeDefined();
      expect(template.invoicePrefix).toBeDefined();
    });

    it('should have valid color format', async () => {
      const template = await db.ensureDefaultInvoiceTemplate();
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      
      expect(template.primaryColor).toMatch(hexColorRegex);
      expect(template.secondaryColor).toMatch(hexColorRegex);
      expect(template.textColor).toMatch(hexColorRegex);
    });

    it('should have valid style value', async () => {
      const template = await db.ensureDefaultInvoiceTemplate();
      expect(['modern', 'classic', 'minimal']).toContain(template.style);
    });
  });
});
