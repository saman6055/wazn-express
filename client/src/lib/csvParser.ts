/**
 * CSV Parser utility for importing data
 * Supports both JSON and CSV file formats
 */

export interface ParsedCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  rawData: string[][];
}

/**
 * Parse CSV string into structured data
 */
export function parseCSV(csvString: string): ParsedCSVResult {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [], rawData: [] };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rawData: string[][] = [];
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > 0) {
      rawData.push(values);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows, rawData };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Convert CSV data to category-specific format for import
 */
export function convertCSVToImportFormat(
  csvData: ParsedCSVResult,
  category: string
): any[] {
  const { rows } = csvData;
  
  // Map CSV columns to database fields based on category
  const fieldMappings: Record<string, Record<string, string>> = {
    customers: {
      // English variations
      'name': 'name',
      'Name': 'name',
      'NAME': 'name',
      'full_name': 'name',
      'fullName': 'name',
      'customer_name': 'name',
      'customerName': 'name',
      // Kurdish variations
      'ناو': 'name',
      // Phone variations
      'phone': 'phone',
      'Phone': 'phone',
      'PHONE': 'phone',
      'phone1': 'phone',
      'Phone 1': 'phone',
      'phone_1': 'phone',
      'mobile': 'phone',
      'Mobile': 'phone',
      'ژمارەی مۆبایل': 'phone',
      'تەلەفۆن': 'phone',
      // Phone 2 variations
      'phone2': 'phone2',
      'Phone 2': 'phone2',
      'phone_2': 'phone2',
      'secondary_phone': 'phone2',
      // Email variations
      'email': 'email',
      'Email': 'email',
      'EMAIL': 'email',
      'e-mail': 'email',
      'E-mail': 'email',
      'ئیمەیڵ': 'email',
      // Address variations
      'address': 'address',
      'Address': 'address',
      'ADDRESS': 'address',
      'ناونیشان': 'address',
      // City variations
      'city': 'city',
      'City': 'city',
      'CITY': 'city',
      'شار': 'city',
      // Code/ID variations
      'code': 'code',
      'Code': 'code',
      'CODE': 'code',
      'customer_code': 'code',
      'customerCode': 'code',
      'id': 'externalId',
      'ID': 'externalId',
      'customer_id': 'externalId',
      // Gender variations
      'gender': 'gender',
      'Gender': 'gender',
      'GENDER': 'gender',
      'ڕەگەز': 'gender',
      // Customer Type variations
      'customer_type': 'customerType',
      'customerType': 'customerType',
      'Customer Type': 'customerType',
      'type': 'customerType',
      'Type': 'customerType',
      'جۆری کڕیار': 'customerType',
      // Balance variations
      'balance': 'balance',
      'Balance': 'balance',
      'BALANCE': 'balance',
      'باڵانس': 'balance',
      // Notes variations
      'notes': 'notes',
      'Notes': 'notes',
      'NOTES': 'notes',
      'note': 'notes',
      'Note': 'notes',
      'تێبینی': 'notes',
    },
    packages: {
      'tracking_number': 'trackingNumber',
      'trackingNumber': 'trackingNumber',
      'ژمارەی تراک': 'trackingNumber',
      'customer_id': 'customerId',
      'customerId': 'customerId',
      'weight': 'weight',
      'کێش': 'weight',
      'description': 'description',
      'وەسف': 'description',
      'status': 'status',
      'بارودۆخ': 'status',
    },
    invoices: {
      'invoice_number': 'invoiceNumber',
      'invoiceNumber': 'invoiceNumber',
      'ژمارەی وەسڵ': 'invoiceNumber',
      'customer_id': 'customerId',
      'customerId': 'customerId',
      'amount': 'amount',
      'بڕ': 'amount',
      'status': 'status',
      'بارودۆخ': 'status',
      'description': 'description',
      'وەسف': 'description',
    },
    payments: {
      'customer_id': 'customerId',
      'customerId': 'customerId',
      'amount': 'amount',
      'بڕ': 'amount',
      'payment_method': 'paymentMethod',
      'paymentMethod': 'paymentMethod',
      'شێوازی پارەدان': 'paymentMethod',
      'notes': 'notes',
      'تێبینی': 'notes',
    },
    expenses: {
      'amount': 'amount',
      'بڕ': 'amount',
      'category': 'category',
      'جۆر': 'category',
      'description': 'description',
      'وەسف': 'description',
      'date': 'date',
      'بەروار': 'date',
    },
    suppliers: {
      'name': 'name',
      'ناو': 'name',
      'phone': 'phone',
      'تەلەفۆن': 'phone',
      'email': 'email',
      'ئیمەیڵ': 'email',
      'address': 'address',
      'ناونیشان': 'address',
    },
    fullPackages: {
      'customer_id': 'customerId',
      'customerId': 'customerId',
      'product_name': 'productName',
      'productName': 'productName',
      'ناوی کاڵا': 'productName',
      'product_link': 'productLink',
      'productLink': 'productLink',
      'لینکی کاڵا': 'productLink',
      'quantity': 'quantity',
      'ژمارە': 'quantity',
      'total_price': 'totalPrice',
      'totalPrice': 'totalPrice',
      'کۆی نرخ': 'totalPrice',
    },
  };

  const mapping = fieldMappings[category] || {};
  
  return rows.map(row => {
    const convertedRow: Record<string, any> = {};
    
    Object.entries(row).forEach(([key, value]) => {
      // Try to find the mapped field name
      const mappedKey = mapping[key] || mapping[key.toLowerCase()] || key;
      
      // Convert numeric values
      if (['balance', 'weight', 'amount', 'quantity', 'totalPrice', 'price'].includes(mappedKey)) {
        convertedRow[mappedKey] = parseFloat(value) || 0;
      } else if (['customerId', 'supplierId'].includes(mappedKey)) {
        convertedRow[mappedKey] = parseInt(value) || null;
      } else {
        convertedRow[mappedKey] = value;
      }
    });
    
    return convertedRow;
  });
}

/**
 * Generate CSV template for a category
 */
export function generateCSVTemplate(category: string): string {
  const templates: Record<string, string[]> = {
    customers: ['name', 'phone', 'email', 'address', 'city', 'balance', 'notes'],
    packages: ['trackingNumber', 'customerId', 'weight', 'description', 'status'],
    invoices: ['invoiceNumber', 'customerId', 'amount', 'status', 'description'],
    payments: ['customerId', 'amount', 'paymentMethod', 'notes'],
    expenses: ['amount', 'category', 'description', 'date'],
    suppliers: ['name', 'phone', 'email', 'address'],
    fullPackages: ['customerId', 'productName', 'productLink', 'quantity', 'totalPrice'],
    batches: ['name', 'description', 'status'],
  };

  const headers = templates[category] || ['field1', 'field2', 'field3'];
  return headers.join(',') + '\n';
}

/**
 * Detect if file content is JSON or CSV
 */
export function detectFileFormat(content: string): 'json' | 'csv' {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }
  return 'csv';
}
