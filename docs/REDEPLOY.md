# ریدیپلۆی Wazn Express (Redeploy)

کاتێک گۆڕانکاری نوێ پۆش دەکەیت بۆ GitHub و دەتەوێت لە سێرڤەر نوێی بکەیتەوە، **هەرگیز root یان password بە کەس مەدە** — ئەمە مەترسەی ئەمنیتی گەورەیە.

ئەوەی دەکەیت ئەمەیە: خۆت بە SSH دەچیتە سێرڤەر و **یەک فەرمان** جێبەجێ دەکەیت.

---

## هەنگاوەکان

### ١. بە SSH بچۆ سێرڤەر

لە کۆمپیوتەری خۆت (PowerShell یان Terminal):

```bash
ssh root@IP_SERVER
# یان
ssh your_user@IP_SERVER
```

وشەی نهێنی کە دەنوسیت لەوێ دەنوسیت؛ **هەرگیز ئەو وشەیە بە کەسێک مەدە** (نە بە چات، نە بە ئیمەیڵ).

### ٢. بچۆ ناو فۆڵدەری پرۆژە

ئەگەر پرۆژە لە `/var/www/wazn-express` دامەزراوە:

```bash
cd /var/www/wazn-express
```

ئەگەر لە شوێنێکی ترە، ئەو path‑ە بەکار بهێنە.

### ٣. ریدیپلۆی خۆکار

تەنها ئەم فەرمانە جێبەجێ بکە:

```bash
bash scripts/redeploy.sh
```

ئەم سکریپتە ئەمانە دەکات:
- `git pull origin main` — نوێکردنەوەی کۆد لە GitHub
- `pnpm install --frozen-lockfile` — پاکێجەکان
- `pnpm run build` — بیلدی client و server
- `pm2 restart wazn-express` — ڕێستارتی ئەپ

دوای تەواوبوون، وێبسایتەکە نوێ دەبێت.

### ٤. (ئەگەر پێویست بوو) مایگریشنی داتابەیس

ئەگەر ئەم رێلیزە مایگریشنی داتابەیس (schema) نوێی هەیە، یەک جار ئەمە جێبەجێ بکە:

```bash
cd /var/www/wazn-express
pnpm run db:push
pm2 restart wazn-express
```

یان بە ئەندپۆینتی مایگریشن (لە کۆمپیوتەرەکەت، بە `MIGRATION_SECRET`):

```bash
curl -X POST https://yourdomain.com/api/run-migration -H "Content-Type: application/json" -d "{\"secret\":\"YOUR_MIGRATION_SECRET\"}"
```

---

## ئەگەر سکریپتەکە executable نەبوو

```bash
chmod +x scripts/redeploy.sh
bash scripts/redeploy.sh
```

---

## پوختە

- **پاسۆرد / root مەدە بە هیچ کەس.**  
- خۆت **SSH** دەکەیت، **`cd`** بۆ فۆڵدەری پرۆژە، **`bash scripts/redeploy.sh`** جێبەجێ دەکەیت.  
- ئەگەر مایگریشن پێویست بوو، **`pnpm run db:push`** یان **`/api/run-migration`** بەکار بهێنە.

ئەگەر PM2 یان path‑ی پرۆژە جیاوازە، سکریپتی `scripts/redeploy.sh` دەتوانیت بە `nano scripts/redeploy.sh` بگۆڕیت (وەک ناوی ئەپ لە PM2).
