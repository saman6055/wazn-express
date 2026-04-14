const bcrypt = require('bcryptjs');
const fs = require('fs');

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

const csv = fs.readFileSync('C:/Users/saman/Downloads/PART-2 _ Wazn Main System 2026 - Customer Info.csv', 'utf8');
const lines = csv.trim().split('\n');
const hash = bcrypt.hashSync('12345678', 12);

function esc(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

const sqls = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const [_id, name, gender, code, phone1, phone2, email, address, _type, notes] = cols;
  if (!name || !code || !phone1) continue;

  const cleanPhone = phone1.replace(/[\s-]/g, '');
  const cleanCode = code.trim();
  const seqMatch = cleanCode.match(/(\d+)/);
  const seq = seqMatch ? parseInt(seqMatch[1], 10) : i;
  const customerCode = cleanCode + '(' + name.trim() + ')';
  const g = gender?.toLowerCase() === 'female' ? 'female' : gender?.toLowerCase() === 'male' ? 'male' : null;
  const cleanPhone2 = phone2 ? phone2.replace(/[\s-]/g, '') : null;
  const cleanEmail = email?.trim() || null;
  const cleanAddress = address?.trim() || null;
  const cleanNotes = notes?.trim() || null;

  sqls.push(
    `INSERT IGNORE INTO customers (customerCode, sequenceNumber, fullName, gender, mobileNumber, secondaryMobile, email, address, passwordHash, country, isActive, notes, createdById, createdAt, updatedAt) VALUES (${esc(customerCode)},${seq},${esc(name.trim())},${esc(g)},${esc(cleanPhone)},${esc(cleanPhone2)},${esc(cleanEmail)},${esc(cleanAddress)},${esc(hash)},${esc('Iraq')},1,${esc(cleanNotes)},1,NOW(),NOW());`
  );
}

// Also generate account creation SQL
const accountSqls = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const [_id, name, gender, code] = cols;
  if (!name || !code) continue;
  const cleanCode = code.trim();
  const customerCode = cleanCode + '(' + name.trim() + ')';
  accountSqls.push(
    `INSERT IGNORE INTO customerAccounts (customerId, accountNumber, currentBalanceUsd, currentBalanceIqd, packageDebtUsd, fullPackageDebtUsd, purchaseRequestDebtUsd, commissionDebtUsd, serviceDebtUsd, creditBalanceUsd, creditBalanceIqd, totalDebitUsd, totalCreditUsd, totalDebitIqd, totalCreditIqd, createdAt, updatedAt) SELECT id, CONCAT('ACC-',customerCode,'-2026'), '0','0','0','0','0','0','0','0','0','0','0','0','0', NOW(), NOW() FROM customers WHERE customerCode=${esc(customerCode)} AND id NOT IN (SELECT customerId FROM customerAccounts);`
  );
}

const fullSql = '-- Customer Import Script\nSET NAMES utf8mb4;\n\n' + sqls.join('\n') + '\n\n-- Create customer accounts\n' + accountSqls.join('\n') + '\n';
fs.writeFileSync('scripts/import-customers.sql', fullSql);
console.log('Generated ' + sqls.length + ' customer INSERTs');
console.log('Generated ' + accountSqls.length + ' account INSERTs');
console.log('SQL file: scripts/import-customers.sql');
