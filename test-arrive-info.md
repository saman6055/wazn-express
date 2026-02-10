# Test Arrive Info Form

## Packages to test:
Looking at the packages list, all packages already have weight set (1.500 kg, 2.500 kg, etc.)

The arrive info form should trigger when:
1. Weight is 0 or missing
2. Package is scanned in Arrive tab

## Test Plan:
1. Create a new package with 0 weight
2. Scan it in Arrive tab
3. Verify the arrive info form appears

## Current packages with tracking numbers:
- g000079 - has tracking "-" (no tracking number)
- REG-TEST-1766185942293 - has tracking, 1.500 kg weight
- UNC-TEST-1766185942062 - has tracking, 2.500 kg weight

Need to find or create a package with 0 weight to test the form.
