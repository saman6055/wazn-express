# Weight Display Fix Verification

## Issue
When a package is registered with volumetric weight (dimensions entered), the package list was showing 0 kg instead of the calculated volumetric weight.

## Fix Applied
Updated the weight column in Packages.tsx to:
1. Calculate actual weight from `weightKg` field
2. Calculate volumetric weight from dimensions: (L × W × H) / 6000
3. Display the maximum of the two (chargeable weight)
4. Show a "قەبارەیی" (volumetric) badge when volumetric weight is used

## Verification Results
From the screenshot, we can see the fix is working correctly:

| Package | Weight Displayed | Badge |
|---------|-----------------|-------|
| g000141 | 7.29 kg | قەبارەیی (volumetric) |
| g000140 | 2.49 kg | قەبارەیی (volumetric) |
| g000139 | 2.00 kg | (no badge - actual weight) |
| g000138 | 0.63 kg | قەبارەیی (volumetric) |
| g000137 | 1.33 kg | (no badge - actual weight) |
| g000136 | 0.63 kg | قەبارەیی (volumetric) |
| g000134 | 1.00 kg | قەبارەیی (volumetric) |

The fix correctly:
- Shows volumetric weight when it's higher than actual weight
- Shows actual weight when it's higher than volumetric weight
- Displays a purple "قەبارەیی" badge to indicate volumetric weight is being used
- Shows "-" for packages with no weight data
