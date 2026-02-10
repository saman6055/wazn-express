# Complete Requirements TODO

## Phase 1: Dashboard
- [ ] Fix daily report PDF export - must work and download
- [ ] Fix date range report PDF export - must work and download
- [ ] Improve dashboard UI design - professional and comprehensive
- [ ] Ensure all system sections are accessible from dashboard

## Phase 2: Financial Hub (ناوەندی دارایی)
- [ ] Professional design for financial hub
- [ ] Include all financial sections of the system
- [ ] Single payment entry point (داخلکردنی پارە لە یەک شوێن)
- [ ] Avoid confusion between different payment sections

## Phase 3: Customers (کڕیارەکان)
- [ ] Fix settings page (ڕێکخستنەکان) - currently not working
- [ ] Add customer code prefix setting in settings page
- [ ] Add email required asterisk (*) on customer form
- [ ] Add customer code filter in advanced filters
- [ ] Add PDF export for customer list with filters
- [ ] Add Excel export for customer list with filters

## Phase 4: Customer Profile (پڕۆفایلی کڕیار)
- [ ] Add Full Package tab in customer profile
- [ ] Add Purchase Requests tab in customer profile
- [ ] Make all links clickable (packages, invoices, full package, purchase requests)
- [ ] Fix edit form - should be same as add customer form with all fields
- [ ] Fix PDF export in customer profile
- [ ] Auto-generate invoice when service is added
- [ ] Auto-generate invoice for full package/purchase requests with payment
- [ ] Record payment in wallet automatically
- [ ] Professional financial dashboard in customer profile
- [ ] Sync all changes to customer portal (invoices, transactions, packages)

## Phase 5: Packages (پاکەتەکان)
- [ ] Show all package types: regular, full package, purchase requests
- [ ] Add filters to separate package types
- [ ] Add validation: no delivery without batch assigned
- [ ] Add validation: no delivery without weight
- [ ] Add validation: no delivery without CBM (for sea shipments)
- [ ] Add tracking alerts for packages without tracking number

## Phase 6: Package Registration (تۆمارکردنی پاکەت)
- [ ] Remove standard registration from system
- [ ] Keep only quick registration and bulk registration
- [ ] Add CBM field for sea shipments
- [ ] Auto-calculate CBM from dimensions (length × width × height)
- [ ] Auto-calculate dimensions from CBM if only CBM entered
- [ ] Add image upload to quick registration
- [ ] Add image upload to bulk registration
- [ ] Make bulk registration have same fields as quick registration

## Phase 7: Batches (باچەکان)
- [ ] Professional batch dashboard design
- [ ] Fix batch analytics - currently not working
- [ ] Add shipping info: airline name for air, container/company for sea
- [ ] Add departure date and estimated arrival date
- [ ] Show estimated arrival in customer portal
- [ ] Auto-update all packages to delivered when batch is delivered
- [ ] Auto-calculate payment for all packages in batch
- [ ] Auto-generate batch invoice for each customer
- [ ] Show batch arrival date and departure date

## Phase 8: Unclaimed Packages (پاکەتە بێ خاوەنەکان)
- [ ] More professional design
- [ ] After long time period, calculate shipping cost as loss
- [ ] Loss calculation without profit margin

## Phase 9: Claim Requests (داواکاری خاوەنداری)
- [ ] Fix database issues
- [ ] Fix customer portal - claim requests not working

## Phase 10: Customer Portal
- [ ] Sync all package changes
- [ ] Show customer invoices
- [ ] Show customer transactions/wallet
- [ ] Show estimated arrival dates for batches
