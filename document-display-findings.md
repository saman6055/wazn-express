# Document Display Findings

## Customer Profile - Documents Tab

**Current State:**
- Documents tab shows three document types: Passport, National ID, Contract
- Each has an "ئەپڵۆدکردن" (Upload) button
- Currently showing "پاسپۆرت" (Passport), "کارتی نیشتمانی" (National ID), "گرێبەست" (Contract)
- The customer "wer" (AZ0069) was created with documents but they're not showing

**Issue:**
- Documents were uploaded during customer creation but the URLs are not being displayed
- The UI shows "No file selected" or upload buttons instead of showing the uploaded documents

**Fix Needed:**
1. Check if document URLs are being saved to database
2. Check if document URLs are being returned from getCustomerById
3. Update UI to show document preview/link when URL exists
