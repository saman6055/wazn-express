import json
import copy

# Read the Kurdish file (source of truth for structure)
with open('/home/ubuntu/wazn-express/client/src/locales/ku.json', 'r', encoding='utf-8') as f:
    ku = json.load(f)

# Read existing English file
with open('/home/ubuntu/wazn-express/client/src/locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

# Read existing Arabic file
with open('/home/ubuntu/wazn-express/client/src/locales/ar.json', 'r', encoding='utf-8') as f:
    ar = json.load(f)

# Read existing Chinese file
with open('/home/ubuntu/wazn-express/client/src/locales/zh.json', 'r', encoding='utf-8') as f:
    zh = json.load(f)

def deep_merge(base, override):
    """Recursively merge override into base, keeping base values where override is missing"""
    result = copy.deepcopy(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

def ensure_all_keys(source, target, lang_code):
    """Ensure target has all keys from source, using source values as fallback"""
    result = copy.deepcopy(target)
    
    def recurse(src, tgt, path=""):
        for key in src:
            current_path = f"{path}.{key}" if path else key
            if isinstance(src[key], dict):
                if key not in tgt:
                    tgt[key] = {}
                if not isinstance(tgt[key], dict):
                    tgt[key] = {}
                recurse(src[key], tgt[key], current_path)
            else:
                if key not in tgt or tgt[key] == "":
                    # Use source (Kurdish) value as fallback
                    tgt[key] = src[key]
    
    recurse(source, result)
    return result

# Ensure all files have the same structure as Kurdish
en_synced = ensure_all_keys(ku, en, 'en')
ar_synced = ensure_all_keys(ku, ar, 'ar')
zh_synced = ensure_all_keys(ku, zh, 'zh')

# Save synced files
with open('/home/ubuntu/wazn-express/client/src/locales/en.json', 'w', encoding='utf-8') as f:
    json.dump(en_synced, f, ensure_ascii=False, indent=2)

with open('/home/ubuntu/wazn-express/client/src/locales/ar.json', 'w', encoding='utf-8') as f:
    json.dump(ar_synced, f, ensure_ascii=False, indent=2)

with open('/home/ubuntu/wazn-express/client/src/locales/zh.json', 'w', encoding='utf-8') as f:
    json.dump(zh_synced, f, ensure_ascii=False, indent=2)

print("All translation files synced!")
print(f"Kurdish: {sum(1 for line in open('/home/ubuntu/wazn-express/client/src/locales/ku.json'))} lines")
print(f"English: {sum(1 for line in open('/home/ubuntu/wazn-express/client/src/locales/en.json'))} lines")
print(f"Arabic: {sum(1 for line in open('/home/ubuntu/wazn-express/client/src/locales/ar.json'))} lines")
print(f"Chinese: {sum(1 for line in open('/home/ubuntu/wazn-express/client/src/locales/zh.json'))} lines")
