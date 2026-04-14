/**
 * Import Full Package Orders via tRPC API
 * Handles: multi-tracking numbers, duplicate tracking numbers, proper CSV parsing
 */
const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://waznexpress.com';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const CSV_PATH = process.argv[2] || 'C:/Users/saman/Downloads/PART-2 _ Wazn Main System 2026 - Orders and Tracking_ Zainab.csv';

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
      hostname: url.hostname, port: 443,
      path: url.pathname + url.search,
      method, headers: { 'Content-Type': 'application/json' },
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function parsePrice(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$¥,din\s]/g, '')) || 0;
}

async function main() {
  console.log('=== Full Package Order Import (14 orders) ===\n');

  // 1. Login
  console.log('1. Logging in...');
  const loginRes = await apiCall('POST', '/api/trpc/auth.staffLogin?batch=1', {
    '0': { json: { identifier: ADMIN_USER, password: ADMIN_PASS } }
  });
  const sessionCookie = loginRes.cookies?.find(c => c.includes('app_session_id'));
  if (!sessionCookie) { console.error('Login failed:', JSON.stringify(loginRes.data).substring(0, 200)); process.exit(1); }
  const cookie = sessionCookie.split(';')[0];
  console.log('   Logged in!\n');

  // 2. Get customer ID
  console.log('2. Finding customer AZ001...');
  const searchRes = await apiCall('GET', '/api/trpc/customers.list?batch=1&input=' + encodeURIComponent(JSON.stringify({
    '0': { json: { search: 'AZ001', page: 1, pageSize: 5 } }
  })), null, cookie);

  let customerId = null;
  const resData = searchRes.data?.[0]?.result?.data?.json;
  const customers = Array.isArray(resData) ? resData : resData?.data;
  if (customers?.length) {
    const found = customers.find(c => c.customerCode?.includes('AZ001') || c.fullName?.includes('Zainab'));
    if (found) { customerId = found.id; console.log(`   Found: ${found.fullName} (ID: ${customerId})\n`); }
  }
  if (!customerId) {
    const altRes = await apiCall('GET', '/api/trpc/customers.list?batch=1&input=' + encodeURIComponent(JSON.stringify({
      '0': { json: { search: 'Zainab', page: 1, pageSize: 5 } }
    })), null, cookie);
    const altData = altRes.data?.[0]?.result?.data?.json;
    const altCustomers = Array.isArray(altData) ? altData : altData?.data;
    if (altCustomers?.length) { customerId = altCustomers[0].id; console.log(`   Found: ${altCustomers[0].fullName} (ID: ${customerId})\n`); }
  }
  if (!customerId) { console.error('Customer not found!'); process.exit(1); }

  // 3. Parse CSV — handle multi-line tracking numbers
  const rawCsv = fs.readFileSync(CSV_PATH, 'utf8');
  const rawLines = rawCsv.trim().split('\n');

  // Merge lines that are continuation of a quoted field (multi-line tracking)
  const mergedLines = [rawLines[0]]; // header
  for (let i = 1; i < rawLines.length; i++) {
    const quoteCount = (rawLines[i].match(/"/g) || []).length;
    // If odd number of quotes, this line continues on the next line
    if (quoteCount % 2 !== 0 && i + 1 < rawLines.length) {
      mergedLines.push(rawLines[i] + '\n' + rawLines[i + 1]);
      i++; // skip next line
    } else {
      mergedLines.push(rawLines[i]);
    }
  }

  console.log(`3. Processing ${mergedLines.length - 1} orders...\n`);

  // Track used tracking numbers to handle duplicates
  const usedTrackingNumbers = new Set();
  let imported = 0, errors = 0;

  for (let i = 1; i < mergedLines.length; i++) {
    const cols = parseCSVLine(mergedLines[i]);
    if (cols.length < 20) { console.log(`   [SKIP] Row ${i}: too few columns`); continue; }

    const productName = (cols[3] || 'Product').replace(/[👚👟🏠]/g, '').trim();
    const quantity = parseInt(cols[4]) || 1;
    const purchasePriceCny = parsePrice(cols[5]);
    const purchasePriceUsd = parsePrice(cols[7]);
    const sellingPriceUsd = parsePrice(cols[9]);
    const productLink = (cols[15] || '').substring(0, 500);
    const supplierOrderNumber = cols[17] || '';
    const rawTrack = cols[19] || '';
    const shippingWay = cols[21] || '';

    // Parse tracking numbers (may have multiple separated by newline)
    const trackingNumbers = rawTrack.split('\n').map(t => t.trim()).filter(Boolean);

    // Primary tracking — use first one, handle duplicates
    let primaryTracking = trackingNumbers[0] || '';
    if (primaryTracking && usedTrackingNumbers.has(primaryTracking)) {
      // Duplicate tracking — append order number to make unique
      primaryTracking = primaryTracking + '-' + (supplierOrderNumber || i);
      console.log(`   [NOTE] Duplicate tracking, using: ${primaryTracking}`);
    }
    if (primaryTracking) usedTrackingNumbers.add(primaryTracking);

    const shippingType = shippingWay.toLowerCase().includes('sea') ? 'sea' : 'air_regular';

    const orderData = {
      customerId,
      orderType: 'full_package',
      productName,
      productLink: productLink || undefined,
      quantity,
      purchasePriceUsd: purchasePriceUsd.toFixed(2),
      purchasePriceCny: purchasePriceCny.toFixed(2),
      sellingPriceUsd: sellingPriceUsd.toFixed(2),
      supplierOrderNumber: supplierOrderNumber || undefined,
      trackingNumber: primaryTracking || undefined,
      trackingNumbers: trackingNumbers.length > 1 ? trackingNumbers : undefined,
      shippingType,
      priority: 'normal',
      notes: cols[14] ? `Order date: ${cols[14]}` : undefined,
    };

    try {
      const res = await apiCall('POST', '/api/trpc/fullPackage.create?batch=1', {
        '0': { json: orderData }
      }, cookie);

      if (res.data?.[0]?.result?.data) {
        imported++;
        const order = res.data[0].result.data.json || res.data[0].result.data;
        const trackInfo = trackingNumbers.length > 1
          ? `Tracks: ${trackingNumbers.join(' + ')}`
          : `Track: ${primaryTracking || 'N/A'}`;
        console.log(`  [${i}] ✓ ${order.orderCode || 'FP-?'} | ${productName} x${quantity} | Buy:$${purchasePriceUsd.toFixed(2)} Sell:$${sellingPriceUsd.toFixed(2)} | ${trackInfo}`);
      } else if (res.status === 429) {
        console.log(`  [${i}] ⏳ Rate limited, waiting 5s...`);
        await sleep(5000); i--; continue;
      } else {
        const errMsg = res.data?.[0]?.error?.json?.message || JSON.stringify(res.data).substring(0, 300);
        console.log(`  [${i}] ✗ ${productName}: ${errMsg}`);
        errors++;
      }
    } catch (err) {
      console.log(`  [${i}] ✗ ${productName}: ${err.message}`);
      errors++;
    }

    await sleep(200); // Small delay between requests
  }

  console.log(`\n========== IMPORT COMPLETE ==========`);
  console.log(`  ✓ Imported: ${imported}`);
  console.log(`  ✗ Errors:   ${errors}`);
  console.log(`  Total:      ${imported + errors} / ${mergedLines.length - 1}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
