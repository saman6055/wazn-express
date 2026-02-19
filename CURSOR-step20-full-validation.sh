#!/usr/bin/env bash
# STEP 20: Final Validation — Run in project root
cd "$(dirname "$0")"

# ─────────────────────────────────────────────────────────────
# 1. SHARED UTILITIES EXIST
# ─────────────────────────────────────────────────────────────
echo "=== 1. SHARED UTILITIES ==="
for f in \
  client/src/lib/soundManager.ts \
  client/src/constants/scannerModules.ts \
  client/src/components/scanner/ScanInput.tsx \
  client/src/components/scanner/SessionStats.tsx \
  client/src/components/scanner/ScannedList.tsx; do
  [ -f "$f" ] && echo "✅ $f" || echo "❌ MISSING: $f"
done

# ─────────────────────────────────────────────────────────────
# 2. NO LOCAL SoundManager CLASS IN ANY SCANNER PAGE
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 2. NO LOCAL SoundManager ==="
result=$(grep -rl "class SoundManager" client/src/pages/*Scanner*.tsx client/src/pages/QuickRegister.tsx 2>/dev/null || true)
[ -z "$result" ] && echo "✅ No local SoundManager class found" || echo "❌ Still found in: $result"

# ─────────────────────────────────────────────────────────────
# 3. ALL SCANNER PAGES USE SHARED soundManager
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 3. SHARED soundManager IMPORT ==="
for f in \
  client/src/pages/BatchAssignmentScanner.tsx \
  client/src/pages/ArrivalVerificationScanner.tsx \
  client/src/pages/CustomerDeliveryScanner.tsx \
  client/src/pages/QuickRegister.tsx; do
  if grep -q "from.*lib/soundManager" "$f" 2>/dev/null; then
    echo "✅ $(basename $f)"
  else
    echo "❌ Missing shared import: $(basename $f)"
  fi
done

# ─────────────────────────────────────────────────────────────
# 4. ScanInput USED IN 3 SCANNER PAGES
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 4. ScanInput COMPONENT ==="
for f in \
  client/src/pages/BatchAssignmentScanner.tsx \
  client/src/pages/ArrivalVerificationScanner.tsx \
  client/src/pages/CustomerDeliveryScanner.tsx; do
  if grep -q "ScanInput" "$f" 2>/dev/null; then
    echo "✅ $(basename $f)"
  else
    echo "❌ No ScanInput: $(basename $f)"
  fi
done

# ─────────────────────────────────────────────────────────────
# 5. SCANNER_MODULES — NO DUPLICATION
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 5. SCANNER_MODULES DEDUPLICATION ==="
echo -n "Constants file exists: "
[ -f "client/src/constants/scannerModules.ts" ] && echo "✅" || echo "❌"
echo -n "Dashboard uses shared: "
grep -q "from.*constants/scannerModules" client/src/pages/ScanDashboard.tsx 2>/dev/null && echo "✅" || echo "❌"
echo -n "Reports uses shared: "
grep -q "from.*constants/scannerModules" client/src/pages/ScanReports.tsx 2>/dev/null && echo "✅" || echo "❌"
echo -n "Dashboard local SCANNER_MODULES (should be 0): "
dash_count=$( (grep -c "^const SCANNER_MODULES\|^export const SCANNER_MODULES" client/src/pages/ScanDashboard.tsx 2>/dev/null; echo "0") | head -1 | tr -d '\r\n')
echo "$dash_count"
echo -n "Reports local SCANNER_MODULES (should be 0): "
reports_count=$( (grep -c "^const SCANNER_MODULES\|^export const SCANNER_MODULES" client/src/pages/ScanReports.tsx 2>/dev/null; echo "0") | head -1 | tr -d '\r\n')
echo "$reports_count"

# ─────────────────────────────────────────────────────────────
# 6. i18n — NO HARDCODED language === "ku" TERNARIES
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 6. i18n COMPLETENESS ==="
for f in \
  client/src/pages/BatchAssignmentScanner.tsx \
  client/src/pages/ArrivalVerificationScanner.tsx \
  client/src/pages/CustomerDeliveryScanner.tsx \
  client/src/components/BarcodeScanner.tsx; do
  count=$(grep -c 'language === "ku"' "$f" 2>/dev/null || echo "0")
  count=$(echo "$count" | tr -d '\r\n' | head -1)
  count=${count:-0}
  count=$((count + 0))
  if [ "$count" -eq 0 ]; then
    echo "✅ $(basename $f) — 0 ternaries"
  else
    echo "❌ $(basename $f) — $count ternaries remaining"
  fi
done
echo -n "BarcodeScanner hardcoded Kurdish: "
count=$(grep -c 'هیچ کامێرایەک\|هەوڵبدەرەوە\|چاوەڕوان\|دەستپێکردنی کامێرا\|وەستان\|گۆڕینی کامێرا' client/src/components/BarcodeScanner.tsx 2>/dev/null || echo "0")
count=$(echo "$count" | tr -d '\r\n' | head -1)
count=${count:-0}
count=$((count + 0))
[ "$count" -eq 0 ] && echo "✅ None" || echo "❌ $count hardcoded strings"

# ─────────────────────────────────────────────────────────────
# 7. SCAN TRANSLATION KEYS EXIST
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 7. TRANSLATION KEYS ==="
for key in noCameraFound arrivalVerification customerDelivery balanceWarning deliveryReceipt verificationStats; do
  echo -n "  $key: "
  en=$(grep -c "\"$key\"" client/src/locales/en.json 2>/dev/null || echo "0")
  ku=$(grep -c "\"$key\"" client/src/locales/ku.json 2>/dev/null || echo "0")
  en=$(echo "$en" | tr -d '\r\n'); en=${en:-0}; en=$((en + 0))
  ku=$(echo "$ku" | tr -d '\r\n'); ku=${ku:-0}; ku=$((ku + 0))
  if [ "$en" -gt 0 ] && [ "$ku" -gt 0 ]; then
    echo "✅ en=$en ku=$ku"
  else
    echo "❌ en=$en ku=$ku"
  fi
done

# ─────────────────────────────────────────────────────────────
# 8. BACKEND — NO CHARGING IN scanning.router.ts
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 8. BACKEND — CHARGING REMOVED FROM SCANNING ==="
echo -n "applyCharge in scanning.router.ts (should be 0): "
grep -c "applyCharge" server/routers/scanning.router.ts 2>/dev/null || echo "0"
echo -n "isCharged in scanning.router.ts (should be 0): "
grep -c "isCharged" server/routers/scanning.router.ts 2>/dev/null || echo "0"
echo -n "createRevenueRecord in scanning.router.ts (should be 0): "
grep -c "createRevenueRecord" server/routers/scanning.router.ts 2>/dev/null || echo "0"
echo -n "'handled at batch delivery' comments: "
grep -c "handled.*batch delivery\|batch delivery" server/routers/scanning.router.ts 2>/dev/null || echo "0"
echo -n "Charging STILL in batches.router.ts (should be >0): "
grep -c "chargeAmount\|createInvoice" server/routers/batches.router.ts 2>/dev/null || echo "0"

# ─────────────────────────────────────────────────────────────
# 9. BACKEND — scanAnalytics ENDPOINT EXISTS
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 9. SCAN ANALYTICS ==="
echo -n "scanAnalytics in router: "
grep -q "scanAnalytics" server/routers/scanning.router.ts 2>/dev/null && echo "✅" || echo "❌"
echo -n "getDailyScanCounts in db: "
grep -q "getDailyScanCounts" server/db/scanning.db.ts 2>/dev/null && echo "✅" || echo "❌"
echo -n "getScanCountsByType in db: "
grep -q "getScanCountsByType" server/db/scanning.db.ts 2>/dev/null && echo "✅" || echo "❌"
echo -n "getTopScanners in db: "
grep -q "getTopScanners" server/db/scanning.db.ts 2>/dev/null && echo "✅" || echo "❌"

# ─────────────────────────────────────────────────────────────
# 10. SESSION PERSISTENCE
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 10. SESSION PERSISTENCE ==="
for f in \
  client/src/pages/BatchAssignmentScanner.tsx \
  client/src/pages/ArrivalVerificationScanner.tsx \
  client/src/pages/CustomerDeliveryScanner.tsx; do
  if grep -q "sessionStorage" "$f" 2>/dev/null; then
    key=$(grep "SESSION_KEY" "$f" 2>/dev/null | head -1 | sed 's/.*=\s*"\([^"]*\)".*/\1/')
    echo "✅ $(basename $f) — $key"
  else
    echo "⚠️  $(basename $f) — No session persistence"
  fi
done

# ─────────────────────────────────────────────────────────────
# 11. LINE COUNT COMPARISON
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 11. LINE COUNTS ==="
echo "File                              | Lines | Original | Saved"
echo "----------------------------------|-------|----------|------"
for pair in \
  "client/src/pages/QuickRegister.tsx:1195" \
  "client/src/pages/BatchAssignmentScanner.tsx:930" \
  "client/src/pages/ArrivalVerificationScanner.tsx:1199" \
  "client/src/pages/CustomerDeliveryScanner.tsx:1199" \
  "client/src/pages/ScanDashboard.tsx:527" \
  "client/src/pages/ScanReports.tsx:575" \
  "client/src/components/BarcodeScanner.tsx:249" \
  "server/routers/scanning.router.ts:1037"; do
  file=$(echo $pair | cut -d: -f1)
  orig=$(echo $pair | cut -d: -f2)
  if [ -f "$file" ]; then
    now=$(wc -l < "$file" | tr -d '\r\n ')
    now=${now:-0}
    saved=$((orig - now))
    printf "%-34s | %5d | %8d | %+d\n" "$(basename $file)" "$now" "$orig" "-$saved"
  else
    printf "%-34s | %-5s | %8d | ?\n" "$(basename $file)" "N/A" "$orig"
  fi
done

echo ""
echo -n "Shared utilities total lines: "
total=0
for f in \
  client/src/lib/soundManager.ts \
  client/src/constants/scannerModules.ts \
  client/src/components/scanner/ScanInput.tsx \
  client/src/components/scanner/SessionStats.tsx \
  client/src/components/scanner/ScannedList.tsx; do
  [ -f "$f" ] && lines=$(wc -l < "$f" | tr -d '\r\n ') && total=$((total + lines))
done
echo "$total (new shared code)"

# ─────────────────────────────────────────────────────────────
# 12. TYPESCRIPT BUILD — MOST IMPORTANT
# ─────────────────────────────────────────────────────────────
echo ""
echo "=== 12. TYPESCRIPT BUILD ==="
tsc_out=$(npx tsc --noEmit 2>&1) || true
error_count=$(echo "$tsc_out" | grep -ic "error" || echo "0")
error_count=${error_count:-0}
if [ "$error_count" -eq 0 ]; then
  echo "✅ TypeScript compiles with ZERO errors"
else
  echo "❌ TypeScript errors found: $error_count"
  echo "$tsc_out" | grep -i "error" | head -15
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  STEP 20 VALIDATION COMPLETE"
echo "═══════════════════════════════════════════════════"
