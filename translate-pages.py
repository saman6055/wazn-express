import os
import re
import json

# Translation mappings for common UI text
TRANSLATIONS = {
    # Common buttons and actions
    '"Save"': 't("common.save")',
    '"Cancel"': 't("common.cancel")',
    '"Delete"': 't("common.delete")',
    '"Edit"': 't("common.edit")',
    '"Add"': 't("common.add")',
    '"Create"': 't("common.create")',
    '"Update"': 't("common.update")',
    '"Search"': 't("common.search")',
    '"Filter"': 't("common.filter")',
    '"Export"': 't("common.export")',
    '"Import"': 't("common.import")',
    '"Refresh"': 't("common.refresh")',
    '"Close"': 't("common.close")',
    '"Confirm"': 't("common.confirm")',
    '"Yes"': 't("common.yes")',
    '"No"': 't("common.no")',
    '"Submit"': 't("common.submit")',
    '"Reset"': 't("common.reset")',
    '"Clear"': 't("common.clear")',
    '"Back"': 't("common.back")',
    '"Next"': 't("common.next")',
    '"Previous"': 't("common.previous")',
    '"Download"': 't("common.download")',
    '"Upload"': 't("common.upload")',
    '"Print"': 't("common.print")',
    '"View"': 't("common.view")',
    '"Details"': 't("common.details")',
    '"Loading..."': 't("common.loading")',
    '"No data"': 't("common.noData")',
    '"No results"': 't("common.noResults")',
    
    # Status
    '"Active"': 't("common.active")',
    '"Inactive"': 't("common.inactive")',
    '"Pending"': 't("common.pending")',
    '"Completed"': 't("common.completed")',
    '"Failed"': 't("common.failed")',
    '"Success"': 't("common.success")',
    '"Error"': 't("common.error")',
    
    # Common labels
    '"Name"': 't("common.name")',
    '"Date"': 't("common.date")',
    '"Time"': 't("common.time")',
    '"Status"': 't("common.status")',
    '"Actions"': 't("common.actions")',
    '"Total"': 't("common.total")',
    '"Amount"': 't("common.amount")',
    '"Price"': 't("common.price")',
    '"Weight"': 't("common.weight")',
    '"Notes"': 't("common.notes")',
    '"Description"': 't("common.description")',
    
    # Time
    '"Today"': 't("common.today")',
    '"Yesterday"': 't("common.yesterday")',
    '"This Week"': 't("common.thisWeek")',
    '"Last Week"': 't("common.lastWeek")',
    '"This Month"': 't("common.thisMonth")',
    '"Last Month"': 't("common.lastMonth")',
    
    # Gender
    '"Male"': 't("common.male")',
    '"Female"': 't("common.female")',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    changes = 0
    
    for eng, trans in TRANSLATIONS.items():
        # Only replace in JSX context (not in imports, variables, etc.)
        # Look for patterns like >{text}< or >{text}</
        pattern = f'>{eng}<'
        replacement = f'>{{{trans}}}<'
        if pattern in content:
            content = content.replace(pattern, replacement)
            changes += 1
    
    if changes > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}: {changes} changes")
    
    return changes

# Process all page files
pages_dir = "/home/ubuntu/wazn-express/client/src/pages"
total_changes = 0

for root, dirs, files in os.walk(pages_dir):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            changes = process_file(filepath)
            total_changes += changes

print(f"\nTotal changes: {total_changes}")
