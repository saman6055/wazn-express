# Test Findings - Delivery Validation

## Packages with $0.00 Cost that are DELIVERED (Bug):
1. PKG-MJDIMJBK - Tracking: 32 - Air Irregular - 2.000 kg - $0.00 - DELIVERED
2. PRICE-TEST-1766185942325 - sasa - Air Regular - 3.000 kg - $0.00 - DELIVERED

## Packages with $0.00 Cost that are REGISTERED (Should be blocked from delivery):
- g000079 - Air Regular - 1.500 kg - $0.00 - registered
- g000078 - Air Regular - 2.500 kg - $0.00 - registered
- UNC-000025 - Air Regular - 2.500 kg - $0.00 - registered

## Test Plan:
1. Go to Warehouse Operations > Deliver tab
2. Try to scan tracking number "32" (PKG-MJDIMJBK) - should show error since it's already delivered
3. Try to scan a registered package with $0.00 cost - should show "Price not set" error
