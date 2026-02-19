#!/usr/bin/env node
/**
 * Syncs missing translation keys from ku.json to en, ar, zh.
 * Ensures all 4 locale files have the same key structure.
 * Uses Kurdish value as placeholder for missing translations.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../client/src/locales');

function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const k of Object.keys(obj)) {
    const pathKey = prefix ? `${prefix}.${k}` : k;
    const val = obj[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      keys.push(...getAllKeys(val, pathKey));
    } else {
      keys.push(pathKey);
    }
  }
  return keys;
}

function getNested(obj, pathKey) {
  const keys = pathKey.split('.');
  let current = obj;
  for (const k of keys) {
    current = current?.[k];
    if (current === undefined) return undefined;
  }
  return typeof current === 'string' ? current : (typeof current === 'number' ? String(current) : undefined);
}

function setNested(obj, pathKey, value) {
  const keys = pathKey.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k];
  }
  current[keys[keys.length - 1]] = value;
}

const ku = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'ku.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'ar.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'zh.json'), 'utf8'));

const kuKeys = getAllKeys(ku);
const targets = { en, ar, zh };

let added = { en: 0, ar: 0, zh: 0 };
for (const key of kuKeys) {
  const kuVal = getNested(ku, key);
  if (kuVal === undefined) continue;
  for (const [lang, data] of Object.entries(targets)) {
    if (getNested(data, key) === undefined) {
      setNested(data, key, kuVal);
      added[lang]++;
    }
  }
}

fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify(en, null, 2), 'utf8');
fs.writeFileSync(path.join(LOCALES_DIR, 'ar.json'), JSON.stringify(ar, null, 2), 'utf8');
fs.writeFileSync(path.join(LOCALES_DIR, 'zh.json'), JSON.stringify(zh, null, 2), 'utf8');

console.log('Locale sync complete. Keys added:', added);
