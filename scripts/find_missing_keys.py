import os
import re
import json

# Get all auto.text keys used in code
code_keys = set()
for root, dirs, files in os.walk('/home/ubuntu/wazn-express/client/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(r't\("(auto\.text_[a-f0-9]+)"\)', content)
                code_keys.update(matches)

# Get all keys in ku.json
with open('/home/ubuntu/wazn-express/client/src/locales/ku.json', 'r', encoding='utf-8') as f:
    ku_data = json.load(f)

existing_keys = set()
if 'auto' in ku_data:
    for key in ku_data['auto']:
        existing_keys.add(f"auto.{key}")

# Find missing keys
missing_keys = code_keys - existing_keys
print(f"Total code keys: {len(code_keys)}")
print(f"Existing keys: {len(existing_keys)}")
print(f"Missing keys: {len(missing_keys)}")

# Find context for missing keys
print("\n\nMissing keys with context:")
for key in sorted(list(missing_keys))[:30]:
    for root, dirs, files in os.walk('/home/ubuntu/wazn-express/client/src'):
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        if key in line:
                            print(f"\n{key} in {file}:{i+1}")
                            print(f"  Context: {line.strip()[:100]}")
                            break
