# Debug Notes - Customer Profile Issues

## Issue 1: Edit Button Not Working
- The Edit button exists at line 321 and sets `isEditOpen` to true
- However, there is NO Dialog component that uses `isEditOpen` state
- The dialog for editing customer was never created
- Need to add a full Edit Customer Dialog

## Issue 2: Document Upload Not Working
- File input refs exist (passportInputRef, nationalIdInputRef, contractInputRef)
- Need to check if the upload handlers are properly connected
- Need to verify the uploadDocument mutation is working

## Solution
1. Create Edit Customer Dialog with all editable fields
2. Verify document upload functionality
