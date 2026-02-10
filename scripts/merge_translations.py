#!/usr/bin/env python3
"""
Merge new translation keys into locale files.
"""

import json
from pathlib import Path

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def flatten_dict(d, parent_key='', sep='.'):
    """Flatten nested dict to dot notation."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def unflatten_dict(d, sep='.'):
    """Unflatten dot notation dict to nested dict."""
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result

def main():
    locales_dir = Path('/home/ubuntu/wazn-express/client/src/locales')
    
    # Load new translation keys
    new_keys = load_json('/home/ubuntu/wazn-express/scripts/new_ku_entries.json')
    
    # Load existing locale files
    ku = load_json(locales_dir / 'ku.json')
    en = load_json(locales_dir / 'en.json')
    ar = load_json(locales_dir / 'ar.json')
    zh = load_json(locales_dir / 'zh.json')
    
    # Flatten existing locales
    ku_flat = flatten_dict(ku)
    en_flat = flatten_dict(en)
    ar_flat = flatten_dict(ar)
    zh_flat = flatten_dict(zh)
    
    # Add new keys
    added = 0
    for key, value in new_keys.items():
        if key not in ku_flat:
            ku_flat[key] = value
            en_flat[key] = value  # Keep Kurdish as placeholder
            ar_flat[key] = value  # Keep Kurdish as placeholder
            zh_flat[key] = value  # Keep Kurdish as placeholder
            added += 1
    
    # Unflatten and save
    save_json(locales_dir / 'ku.json', unflatten_dict(ku_flat))
    save_json(locales_dir / 'en.json', unflatten_dict(en_flat))
    save_json(locales_dir / 'ar.json', unflatten_dict(ar_flat))
    save_json(locales_dir / 'zh.json', unflatten_dict(zh_flat))
    
    print(f"Added {added} new translation keys to all locale files")

if __name__ == '__main__':
    main()
