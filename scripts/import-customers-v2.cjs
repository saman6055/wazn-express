/**
 * Professional Customer Import Script v2
 * - Imports customers from CSV with proper city/district parsing
 * - Creates customer accounts (wallets)
 * - Password: 12345678 for all
 * - Handles duplicate phones gracefully
 */
const bcrypt = require('bcryptjs');
const fs = require('fs');

// ============ City/Address Parser ============
const IRAQ_CITIES = {
  'erbil': 'Erbil', 'hewler': 'Erbil', 'hawler': 'Erbil', 'هەولێر': 'Erbil', 'اربيل': 'Erbil',
  'sulaimaniyah': 'Sulaimaniyah', 'sulaymaniyah': 'Sulaimaniyah', 'sulaymanya': 'Sulaimaniyah', 'سلێمانی': 'Sulaimaniyah', 'السليمانية': 'Sulaimaniyah',
  'baghdad': 'Baghdad', 'بغداد': 'Baghdad', 'بەغدا': 'Baghdad',
  'basra': 'Basra', 'basrah': 'Basra', 'البصرة': 'Basra', 'بصرة': 'Basra', 'بەسرە': 'Basra',
  'kirkuk': 'Kirkuk', 'كركوك': 'Kirkuk', 'کەرکووک': 'Kirkuk',
  'duhok': 'Duhok', 'dahuk': 'Duhok', 'دهوك': 'Duhok', 'دهۆک': 'Duhok',
  'mosul': 'Mosul', 'mousl': 'Mosul', 'الموصل': 'Mosul', 'موصل': 'Mosul', 'مووسڵ': 'Mosul',
  'najaf': 'Najaf', 'النجف': 'Najaf', 'نەجەف': 'Najaf',
  'karbala': 'Karbala', 'كربلاء': 'Karbala',
  'diwaniyah': 'Diwaniyah', 'al-diwaniyah': 'Diwaniyah', 'الديوانية': 'Diwaniyah', 'دیوانیە': 'Diwaniyah',
  'misan': 'Misan', 'ميسان': 'Misan',
  'kut': 'Kut', 'الكوت': 'Kut', 'كوت': 'Kut',
  'halabja': 'Halabja', 'حلبجة': 'Halabja', 'هەڵەبجە': 'Halabja',
  'shaqlawa': 'Shaqlawa', 'شقلاوة': 'Shaqlawa',
  'zakho': 'Zakho', 'zaxo': 'Zakho', 'زاخو': 'Zakho',
  'diyala': 'Diyala', 'ديالى': 'Diyala',
  'koysinjaq': 'Koysinjaq', 'كويسنجق': 'Koysinjaq',
  'soran': 'Soran', 'سۆران': 'Soran',
  'ranya': 'Ranya', 'رانیە': 'Ranya',
  'tikrit': 'Tikrit', 'تكريت': 'Tikrit',
  'samarra': 'Samarra', 'سامراء': 'Samarra',
  'sinjar': 'Sinjar', 'سنجار': 'Sinjar', 'سنجار': 'Sinjar',
  'permam': 'Permam', 'پرمام': 'Permam',
  'bahrka': 'Erbil', 'بەهرکە': 'Erbil',
  'salah al-din': 'Salah al-Din', 'صلاح الدين': 'Salah al-Din',
};

function parseAddress(rawAddress) {
  if (!rawAddress || rawAddress.trim() === '') return { city: 'Iraq', district: '', address: '' };

  const addr = rawAddress.trim();
  let city = '';
  let district = '';

  // Try to match known cities
  const lowerAddr = addr.toLowerCase().replace(/[,\-\/]/g, ' ');
  for (const [key, val] of Object.entries(IRAQ_CITIES)) {
    if (lowerAddr.includes(key.toLowerCase())) {
      city = val;
      // Extract district: everything after the city name
      const parts = addr.split(/[,\-\/]/);
      if (parts.length > 1) {
        district = parts.slice(1).join(', ').trim();
      }
      break;
    }
  }

  if (!city) {
    // Fallback: first part before comma is city
    const parts = addr.split(/[,\-]/);
    city = parts[0].trim();
    district = parts.slice(1).join(', ').trim();
  }

  return { city, district, address: addr };
}

// ============ CSV Parser ============
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

// ============ Main ============
function main() {
  const csvPath = process.argv[2] || 'C:/Users/saman/Downloads/PART-2 _ Wazn Main System 2026 - Customer Info (1).csv';
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.trim().split('\n');

  console.log(`Processing ${lines.length - 1} customers...`);

  const hash = bcrypt.hashSync('12345678', 12);

  const sqls = [];
  const accountSqls = [];
  const seenPhones = new Set();
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const [_id, name, gender, code, phone1, phone2, email, address, _type, notes] = cols;
    if (!name || !code || !phone1) { skipped++; continue; }

    const cleanPhone = phone1.replace(/[\s\-]/g, '');
    const cleanCode = code.trim();

    // Skip duplicate phones within CSV
    if (seenPhones.has(cleanPhone)) {
      console.log(`  SKIP duplicate phone: ${cleanCode} ${name} (${cleanPhone})`);
      skipped++;
      continue;
    }
    seenPhones.add(cleanPhone);

    const seqMatch = cleanCode.match(/(\d+)/);
    const seq = seqMatch ? parseInt(seqMatch[1], 10) : i;
    const customerCode = `${cleanCode}(${name.trim()})`;
    const g = gender?.toLowerCase() === 'female' ? 'female' : gender?.toLowerCase() === 'male' ? 'male' : null;
    const cleanPhone2 = phone2 ? phone2.replace(/[\s\-]/g, '') : null;
    const cleanEmail = email?.trim() || null;
    const cleanNotes = notes?.trim() || null;

    // Parse address into city/district
    const { city, district, address: fullAddress } = parseAddress(address);

    const esc = (v) => {
      if (v === null || v === undefined || v === '') return 'NULL';
      return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    };

    sqls.push(
      `INSERT IGNORE INTO customers (customerCode, sequenceNumber, fullName, gender, mobileNumber, secondaryMobile, email, country, city, district, address, passwordHash, isActive, notes, createdById, createdAt, updatedAt) VALUES (${esc(customerCode)},${seq},${esc(name.trim())},${esc(g)},${esc(cleanPhone)},${esc(cleanPhone2)},${esc(cleanEmail)},${esc('Iraq')},${esc(city)},${esc(district)},${esc(fullAddress)},${esc(hash)},1,${esc(cleanNotes)},1,NOW(),NOW());`
    );

    accountSqls.push(
      `INSERT IGNORE INTO customerAccounts (customerId, accountNumber, currentBalanceUsd, currentBalanceIqd, packageDebtUsd, fullPackageDebtUsd, purchaseRequestDebtUsd, commissionDebtUsd, serviceDebtUsd, creditBalanceUsd, creditBalanceIqd, totalDebitUsd, totalCreditUsd, totalDebitIqd, totalCreditIqd, createdAt, updatedAt) SELECT id, CONCAT('ACC-',customerCode,'-2026'), '0','0','0','0','0','0','0','0','0','0','0','0','0', NOW(), NOW() FROM customers WHERE customerCode=${esc(customerCode)} AND id NOT IN (SELECT customerId FROM customerAccounts);`
    );
  }

  const fullSql = '-- Customer Import v2 (with city/district parsing)\nSET NAMES utf8mb4;\n\n'
    + sqls.join('\n')
    + '\n\n-- Create customer accounts\n'
    + accountSqls.join('\n') + '\n';

  const outPath = 'scripts/import-customers.sql';
  fs.writeFileSync(outPath, fullSql);
  console.log(`\nGenerated ${sqls.length} customer INSERTs (${skipped} skipped)`);
  console.log(`SQL file: ${outPath}`);
}

main();
