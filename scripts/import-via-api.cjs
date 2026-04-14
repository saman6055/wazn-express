/**
 * Import customers via tRPC API (no SSH needed)
 * 1. Login as admin
 * 2. Create each customer via API
 */
const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://waznexpress.com';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const CSV_PATH = process.argv[2] || 'C:/Users/saman/Downloads/PART-2 _ Wazn Main System 2026 - Customer Info (1).csv';
const CUSTOMER_PASSWORD = '12345678';

// ============ City Parser ============
const IRAQ_CITIES = {
  'erbil': 'Erbil', 'hewler': 'Erbil', 'hawler': 'Erbil',
  'sulaimaniyah': 'Sulaimaniyah', 'sulaymaniyah': 'Sulaimaniyah', 'sulaymanya': 'Sulaimaniyah',
  'baghdad': 'Baghdad',
  'basra': 'Basra', 'basrah': 'Basra',
  'kirkuk': 'Kirkuk',
  'duhok': 'Duhok', 'dahuk': 'Duhok',
  'mosul': 'Mosul', 'mousl': 'Mosul',
  'najaf': 'Najaf',
  'karbala': 'Karbala',
  'diwaniyah': 'Diwaniyah', 'al-diwaniyah': 'Diwaniyah',
  'misan': 'Misan',
  'kut': 'Kut',
  'halabja': 'Halabja',
  'shaqlawa': 'Shaqlawa',
  'zakho': 'Zakho', 'zaxo': 'Zakho',
  'diyala': 'Diyala',
  'koysinjaq': 'Koysinjaq',
  'soran': 'Soran',
  'ranya': 'Ranya',
  'tikrit': 'Tikrit',
  'sinjar': 'Sinjar',
  'permam': 'Permam',
  'bahrka': 'Erbil',
  'zanko': 'Erbil',
  '32 park': 'Erbil',
  'daratw': 'Erbil',
  'hiwa': 'Erbil',
  'farmanbaran': 'Erbil',
  'kasnazan': 'Erbil',
  'badawa': 'Erbil',
  'bazari': 'Erbil',
};

function parseAddress(raw) {
  if (!raw || raw.trim() === '') return { city: '', district: '', address: '' };
  const addr = raw.trim();
  let city = '';
  let district = '';
  const lower = addr.toLowerCase().replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, (m) => m);

  for (const [key, val] of Object.entries(IRAQ_CITIES)) {
    if (lower.includes(key)) {
      city = val;
      const parts = addr.split(/[,\-\/]/);
      if (parts.length > 1) {
        district = parts.slice(1).join(', ').trim().substring(0, 100);
      }
      break;
    }
  }

  // Arabic/Kurdish city detection
  if (!city) {
    const arabicCities = {
      'بغداد': 'Baghdad', 'البصرة': 'Basra', 'بصرة': 'Basra',
      'الموصل': 'Mosul', 'موصل': 'Mosul', 'النجف': 'Najaf',
      'كربلاء': 'Karbala', 'الديوانية': 'Diwaniyah', 'ميسان': 'Misan',
      'الكوت': 'Kut', 'كوت': 'Kut', 'ديالى': 'Diyala',
      'صلاح الدين': 'Salah al-Din', 'تكريت': 'Tikrit',
      'سنجار': 'Sinjar', 'كركوك': 'Kirkuk',
      'هەولێر': 'Erbil', 'سلێمانی': 'Sulaimaniyah',
      'دهۆک': 'Duhok', 'هەڵەبجە': 'Halabja',
      'کەرکووک': 'Kirkuk', 'مووسڵ': 'Mosul',
      'اربيل': 'Erbil',
    };
    for (const [key, val] of Object.entries(arabicCities)) {
      if (addr.includes(key)) {
        city = val;
        const parts = addr.split(/[,،\-\/]/);
        if (parts.length > 1) district = parts.slice(1).join(', ').trim().substring(0, 100);
        break;
      }
    }
  }

  if (!city) {
    const parts = addr.split(/[,،\-]/);
    city = parts[0].trim().substring(0, 100);
    district = parts.slice(1).join(', ').trim().substring(0, 100);
  }

  return { city, district, address: addr };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += line[i];
  }
  result.push(current.trim());
  return result;
}

function apiCall(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false,
    };
    if (cookie) options.headers['Cookie'] = cookie;

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        try { resolve({ status: res.statusCode, data: JSON.parse(data), cookies }); }
        catch { resolve({ status: res.statusCode, data, cookies }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Customer Import via API ===\n');

  // 1. Login as admin
  console.log('1. Logging in as admin...');
  const loginRes = await apiCall('POST', '/api/trpc/auth.staffLogin?batch=1', {
    '0': { json: { identifier: ADMIN_USER, password: ADMIN_PASS } }
  });

  if (!loginRes.cookies) {
    console.error('Login failed:', JSON.stringify(loginRes.data));
    // Try alternative password
    console.log('   Trying alternative password...');
    const loginRes2 = await apiCall('POST', '/api/trpc/auth.staffLogin?batch=1', {
      '0': { json: { identifier: ADMIN_USER, password: 'admin123' } }
    });
    if (!loginRes2.cookies) {
      console.error('Login failed with both passwords. Check admin credentials.');
      process.exit(1);
    }
    loginRes.cookies = loginRes2.cookies;
  }

  const sessionCookie = loginRes.cookies.find(c => c.includes('app_session_id') || c.includes('__session') || c.includes('manus'));
  if (!sessionCookie) {
    console.error('No session cookie received');
    process.exit(1);
  }
  const cookie = sessionCookie.split(';')[0];
  console.log('   Logged in successfully!\n');

  // 2. Read CSV
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csv.trim().split('\n');
  console.log(`2. Processing ${lines.length - 1} customers from CSV...\n`);

  let imported = 0, skipped = 0, errors = 0;
  const seenPhones = new Set();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const [_id, name, gender, code, phone1, phone2, email, address, _type, notes] = cols;
    if (!name || !code || !phone1) { skipped++; continue; }

    const cleanPhone = phone1.replace(/[\s\-]/g, '');
    const cleanCode = code.trim();

    if (seenPhones.has(cleanPhone)) {
      console.log(`  [SKIP] ${cleanCode} - duplicate phone ${cleanPhone}`);
      skipped++;
      continue;
    }
    seenPhones.add(cleanPhone);

    const { city, district } = parseAddress(address);
    const cleanPhone2 = phone2 ? phone2.replace(/[\s\-]/g, '') : undefined;
    const cleanEmail = email?.trim() || undefined;

    const body = {
      '0': {
        json: {
          fullName: name.trim(),
          gender: gender?.toLowerCase() === 'female' ? 'female' : gender?.toLowerCase() === 'male' ? 'male' : undefined,
          mobileNumber: cleanPhone,
          secondaryMobile: cleanPhone2 || undefined,
          password: CUSTOMER_PASSWORD,
          email: cleanEmail || undefined,
          country: 'Iraq',
          city: city || undefined,
          district: district || undefined,
          address: address?.trim() || undefined,
          codePrefix: 'AZ',
          notes: notes?.trim() || undefined,
        }
      }
    };

    try {
      const res = await apiCall('POST', '/api/trpc/customers.create?batch=1', body, cookie);

      if (res.data?.[0]?.result?.data) {
        imported++;
        const cust = res.data[0].result.data.json || res.data[0].result.data;
        console.log(`  [OK] ${cust.customerCode || cleanCode} - ${name.trim()} (${city || 'N/A'})`);
      } else if (res.data?.[0]?.error) {
        const errMsg = res.data[0].error.json?.message || 'Unknown error';
        if (errMsg.includes('تۆمارکراوە') || errMsg.includes('Duplicate') || errMsg.includes('exists')) {
          console.log(`  [SKIP] ${cleanCode} - ${name.trim()} (already exists)`);
          skipped++;
        } else {
          console.log(`  [ERR] ${cleanCode} - ${name.trim()}: ${errMsg}`);
          errors++;
        }
      } else if (res.status === 429) {
        console.log(`  [WAIT] Rate limited, waiting 5s...`);
        await sleep(5000);
        i--; // Retry
        continue;
      } else {
        console.log(`  [ERR] ${cleanCode} - ${name.trim()}: HTTP ${res.status}`);
        errors++;
      }
    } catch (err) {
      console.log(`  [ERR] ${cleanCode} - ${name.trim()}: ${err.message}`);
      errors++;
    }

    // Small delay to avoid rate limiting
    if (i % 10 === 0) await sleep(500);
  }

  console.log(`\n========== IMPORT COMPLETE ==========`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${imported + skipped + errors}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
