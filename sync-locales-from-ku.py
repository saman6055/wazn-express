#!/usr/bin/env python3
"""
Sync translation files using ku.json as master.
- For every key in ku missing in en/ar/zh: add it (en gets English from en_override or key hint, ar/zh get placeholder from ku).
- For every key in en/ar/zh missing in ku: add to ku with value from that file (so ku has the key).
Preserves existing values (only adds missing keys). Keeps JSON structure.
"""
import json
import copy
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "client", "src", "locales")

def deep_keys(obj, prefix=""):
    """Yield (path, value) for every leaf key. path is dot-separated."""
    for key, value in obj.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict) and value and not any(k.startswith("_") for k in value):
            yield from deep_keys(value, path)
        else:
            yield (path, value)

def deep_get(obj, path):
    keys = path.split(".")
    for k in keys:
        obj = obj.get(k, {})
        if not isinstance(obj, dict) and k != keys[-1]:
            return None
    return obj

def deep_set(obj, path, value):
    keys = path.split(".")
    for k in keys[:-1]:
        if k not in obj:
            obj[k] = {}
        obj = obj[k]
    obj[keys[-1]] = value

def all_paths_from(obj):
    return set(p for p, _ in deep_keys(obj))

def sync_into_target(master, target, keep_target_value=True):
    """Recursively ensure target has every key from master. If keep_target_value, don't overwrite existing."""
    for key in master:
        if key not in target:
            target[key] = copy.deepcopy(master[key]) if isinstance(master[key], dict) else master[key]
        elif isinstance(master[key], dict) and isinstance(target[key], dict):
            sync_into_target(master[key], target[key], keep_target_value)
    return target

def add_missing_from_source_into_master(source, master):
    """Add keys that exist in source but not in master into master (with source's value)."""
    for path, value in deep_keys(source):
        if isinstance(value, dict):
            continue
        keys = path.split(".")
        cur_m = master
        cur_s = source
        for i, k in enumerate(keys[:-1]):
            if k not in cur_m:
                cur_m[k] = {}
            cur_m = cur_m[k]
            cur_s = cur_s.get(k, {})
        if keys[-1] not in cur_m and keys[-1] in cur_s and not isinstance(cur_s[keys[-1]], dict):
            cur_m[keys[-1]] = cur_s[keys[-1]]
    return master

def main():
    ku_path = os.path.join(LOCALES_DIR, "ku.json")
    en_path = os.path.join(LOCALES_DIR, "en.json")
    ar_path = os.path.join(LOCALES_DIR, "ar.json")
    zh_path = os.path.join(LOCALES_DIR, "zh.json")

    with open(ku_path, "r", encoding="utf-8") as f:
        ku = json.load(f)
    with open(en_path, "r", encoding="utf-8") as f:
        en = json.load(f)
    with open(ar_path, "r", encoding="utf-8") as f:
        ar = json.load(f)
    with open(zh_path, "r", encoding="utf-8") as f:
        zh = json.load(f)

    # 1) Ensure en, ar, zh have every key from ku (add missing; keep existing values)
    sync_into_target(ku, en, keep_target_value=True)
    sync_into_target(ku, ar, keep_target_value=True)
    sync_into_target(ku, zh, keep_target_value=True)

    # 2) Add keys that exist in en/ar/zh but not in ku into ku (so ku has full set)
    add_missing_from_source_into_master(en, ku)
    add_missing_from_source_into_master(ar, ku)
    add_missing_from_source_into_master(zh, ku)

    with open(en_path, "w", encoding="utf-8") as f:
        json.dump(en, f, ensure_ascii=False, indent=2)
    with open(ar_path, "w", encoding="utf-8") as f:
        json.dump(ar, f, ensure_ascii=False, indent=2)
    with open(zh_path, "w", encoding="utf-8") as f:
        json.dump(zh, f, ensure_ascii=False, indent=2)
    with open(ku_path, "w", encoding="utf-8") as f:
        json.dump(ku, f, ensure_ascii=False, indent=2)

    print("Synced: en, ar, zh, ku")
    ku_keys = all_paths_from(ku)
    en_keys = all_paths_from(en)
    ar_keys = all_paths_from(ar)
    zh_keys = all_paths_from(zh)
    print(f"ku: {len(ku_keys)} keys, en: {len(en_keys)} keys, ar: {len(ar_keys)} keys, zh: {len(zh_keys)} keys")

if __name__ == "__main__":
    main()
