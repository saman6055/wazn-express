# پلانی دیپلۆی Wazn Express (Deployment Plan)

ئەم دۆکیومێنتە پلانی هەنگاو‑بە‑هەنگاوی دیپلۆیکردنی وێب‑ئەپلیکەیشنی Wazn Express لەسەر سێرڤەر (VPS / VDS) پێشکەش دەکات.

---

## پوختە

| بابەت | وردەکاری |
|-------|-----------|
| **تەکنەلۆژیا** | Node.js, pnpm, MySQL, Express, Vite (build), tRPC |
| **پۆرتی بنەڕەتی** | 3500 (دەتوانرێت بە `PORT` بگۆڕدرێت) |
| **بنەماوی پێویست** | `DATABASE_URL`, `JWT_SECRET`, `MIGRATION_SECRET` |
| **بڕگەی build** | `pnpm run build` → `dist/public` (client) + `dist/index.js` (server) |
| **دەستپێکردنی prod** | `NODE_ENV=production node dist/index.js` |

---

## هەنگاوی ١: ئامادەکردنی سێرڤەر

### 1.1 سیستەمی کارپێکراو (OS)

- **پێشنیار:** Ubuntu 22.04 LTS یان 24.04 LTS (لە VPS لە DigitalOcean, Linode, Vultr, AWS, یان هۆستێرێکی تر).
- دڵنیابە کە سێرڤەرەکەت دەستکاری (SSH) هەبێت و پۆرتی 22 (SSH) کراوە بێت.

### 1.2 ناوکردنی سێرڤەر (بە SSH)

```bash
ssh root@YOUR_SERVER_IP
# یان بە بەکارهێنەرێکی نان‑root:
ssh your_user@YOUR_SERVER_IP
```

### 1.3 نوێکردنەوەی پاکێجەکان

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.4 دامەزراندنی Node.js (v20 LTS پێشنیارکراوە)

```bash
# بە nvm (ئاسانترین)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc   # یان source ~/.profile
nvm install 20
nvm use 20
node -v   # دەبێت 20.x.x بێت
```

**یان** بە NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

### 1.5 دامەزراندنی pnpm

```bash
npm install -g pnpm
pnpm -v
```

### 1.6 دامەزراندنی MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

داتابەیسێک و بەکارهێنەرێک دروست بکە بۆ ئەپەکە:

```bash
sudo mysql -u root -p
```

لە MySQL:

```sql
CREATE DATABASE wazn_express CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wazn_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON wazn_express.* TO 'wazn_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

هێڵی کۆنێکشنی داتابەیس (بۆ `.env` دواتر):

```
mysql://wazn_user:YOUR_STRONG_PASSWORD@localhost:3306/wazn_express
```

### 1.7 (ئۆپشناڵ) دامەزراندنی Nginx بۆ پرۆکسی و SSL

```bash
sudo apt install -y nginx
```

دوای تەواوبوونی دیپلۆی، Nginx دەتوانرێت ڕێکبخرێت بۆ پرۆکسی کردن بۆ پۆرتی 3500 و بەستنی SSL (بە Certbot).

---

## هەنگاوی ٢: کۆد و وەرگرتنی پرۆژە

### 2.1 دامەزراندنی Git (ئەگەر نییە)

```bash
sudo apt install -y git
```

### 2.2 کلۆن کردنی ڕیپۆ

ئەگەر ڕیپۆکە گشتی بێت:

```bash
cd /var/www   # یان هەر شوێنێکی تر
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
git clone https://github.com/saman6055/wazn-express.git
cd wazn-express
```

ئەگەر پرایڤەت بێت، بە SSH key یان token کلۆن بکە، یان کۆدەکە بە SCP/rsync بنێرە بۆ سێرڤەر.

### 2.3 دامەزراندنی پاکێجەکان

```bash
pnpm install --frozen-lockfile
```

---

## هەنگاوی ٣: ڕێکخستنی ژینگە (.env)

### 3.1 دروستکردنی فایلی .env

```bash
cp .env.example .env
nano .env   # یان vim / vi
```

### 3.2 پڕکردنەوەی نرخە پێویستەکان

```env
# پێویست
DATABASE_URL=mysql://wazn_user:YOUR_STRONG_PASSWORD@localhost:3306/wazn_express
JWT_SECRET=یکە زنجیرەیەکی درێژ و هەڕەمەکی بەرگ (ئەنترۆپی بەرز)
MIGRATION_SECRET=یکە سیکرێتێکی تر بۆ ئەندپۆینتی مایگریشن

# سێرڤەر
PORT=3500
NODE_ENV=production

# CORS: دۆمەینی فرۆنتێند (ئەگەر جیا بێت) یان دۆمەینی خۆی سێرڤەر
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

نموونەی دروستکردنی `JWT_SECRET` و `MIGRATION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

دوو جار ئەم فەرمانە ئەنجام بدە و یەکێکیان بۆ `JWT_SECRET` و یەکێکی تر بۆ `MIGRATION_SECRET` بەکار بهێنە.

### 3.3 (ئۆپشناڵ) S3، ئیمەیڵ، ئانالیتیکس

ئەگەر S3 بەکەڵک دەهێنیت، Resend بۆ ئیمەیڵ، یان Umami بۆ ئانالیتیکس:

```env
S3_BUCKET=your-bucket-name
# + ڕێکخستنەکانی AWS لە ژینگە یان IAM

RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=Wazn Express <noreply@yourdomain.com>

VITE_ANALYTICS_ENDPOINT=https://analytics.yourdomain.com
VITE_ANALYTICS_WEBSITE_ID=xxx
```

**ئاگاداری:** هیچ کات `.env` commit مەکە؛ لە `.gitignore` دایە.

---

## هەنگاوی ٤: بیلد و مایگریشنی داتابەیس

### 4.1 بیلدکردنی پرۆژە

```bash
pnpm run build
```

ئەمە:
- فرۆنتێند (Vite + React) دەبنێت بۆ `dist/public`
- سێرڤەری Node (esbuild) دەبنێت بۆ `dist/index.js`

دڵنیابە کە دوای بیلد ئەم فایلانە هەن:

```bash
ls -la dist/
ls -la dist/public/
```

### 4.2 مایگریشنی داتابەیس (یەک جار)

سکیمای Drizzle دەبێت یەک جار ڕانەدرێت بۆ MySQL. دوو ڕێگا هەیە:

**ئۆپشن A: لە سێرڤەر (ئەگەر drizzle-kit و tsx لە سێرڤەر بەردەستن)**

```bash
pnpm run db:push
```

**ئۆپشن B: بە ئەندپۆینتی مایگریشن (پێشنیارکراو لە prod)**

ئەپەکە یەک جار دەستپێ بکە (بۆ ماوەیەکی کەم)، دواتر POST بکە بۆ مایگریشن:

```bash
# لە ترمیناڵی سێرڤەر، یەک جار سێرڤەر دەستپێ بکە
NODE_ENV=production node dist/index.js
# لە ترمیناڵێکی تر یان لە کۆمپیوتەرەکەت:
curl -X POST https://yourdomain.com/api/run-migration \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_MIGRATION_SECRET"}'
```

دوای سەرکەوتووبوونی مایگریشن، سێرڤەرەکەت دەتوانیت وەستێنیت و بە PM2 یان systemd دووبارە دەستپێ بکەیتەوە.

### 4.3 (ئۆپشناڵ) دروستکردنی ئەدمین

ئەگەر سکریپتی create-admin هەبێت:

```bash
pnpm run create-admin
# یان: pnpm exec tsx scripts/create-admin.ts
```

وەڵامی پرسیارەکان بدە (ناوی بەکارهێنەر، وشەی نهێنی، ئەگەر هەبێت).

---

## هەنگاوی ٥: ڕانەدانی ئەپ بە PM2 (پێشنیارکراو)

PM2 پرۆسێسەکە دەژیانێنێتەوە دوای ڕێبۆوت و کەوتن، و لاگی باش پێشکەش دەکات.

### 5.1 دامەزراندنی PM2

```bash
npm install -g pm2
```

### 5.2 دەستپێکردنی ئەپ

```bash
cd /var/www/wazn-express
pm2 start dist/index.js --name wazn-express
```

یان بە ڕێکخستنی ژینگە:

```bash
pm2 start dist/index.js --name wazn-express --env production
```

دڵنیابە لە شوێنی دروست (`/var/www/wazn-express`) `pm2 start` دەکەیت تا `.env` لە هەمان دایرکتۆری بدۆزێتەوە.

### 5.3 ڕێکخستنی ئۆتۆ‑ستارت دوای ڕێبۆوت

```bash
pm2 startup
# فەرمانێک وەک "sudo env PATH=..." دەردەچێت؛ ئەو فەرمانە جێبەجێ بکە
pm2 save
```

### 5.4 فەرمانە بەکارهێنەکانی PM2

```bash
pm2 status          # دۆخی پرۆسەکان
pm2 logs wazn-express   # لاگەکان
pm2 restart wazn-express
pm2 stop wazn-express
pm2 delete wazn-express
```

### 5.5 (ئۆپشناڵ) فایلی ecosystem.config.cjs

بۆ پۆرتی تایبەت و ژینگە و ناوی پرۆسێس:

```bash
nano ecosystem.config.cjs
```

ناونیشانی فایل:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'wazn-express',
    script: 'dist/index.js',
    cwd: '/var/www/wazn-express',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' },
    error_file: '~/.pm2/logs/wazn-express-error.log',
    out_file: '~/.pm2/logs/wazn-express-out.log',
  }],
};
```

دواتر:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

---

## هەنگاوی ٦: Nginx وەک Reverse Proxy (ئۆپشناڵ بەڵام پێشنیارکراو)

ئەگەر دەتەوێت ئەپەکە لە پۆرتی 80/443 بە دۆمەینێک بەردەست بێت و SSL هەبێت:

### 6.1 سایتێک دروست بکە

```bash
sudo nano /etc/nginx/sites-available/wazn-express
```

ناونیشانی ناوەڕۆک:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

### 6.2 چالاککردنی سایت و پشکنینی Nginx

```bash
sudo ln -s /etc/nginx/sites-available/wazn-express /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 SSL بە Certbot (Let’s Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

دوای ئەمە Certbot خۆکارانە ڕێکخستنی Nginx دەگۆڕێت بۆ HTTPS. دڵنیابە `ALLOWED_ORIGINS` لە `.env` دۆمەینی HTTPS لەخۆ بگرێت، وەک `https://yourdomain.com`.

---

## هەنگاوی ٧: پشکنین و تەندروستی

### 7.1 Health check

```bash
curl http://localhost:3500/api/health
# یان لە دەرەوە:
curl https://yourdomain.com/api/health
```

دەبێت وەڵامێکی 200 وەربگریت (وەک `{"ok":true}` یان هاوشێوە).

### 7.2 پشکنینی فرۆنتێند

بە وێبگەڕەکەت بکەوە: `https://yourdomain.com` (یان `http://SERVER_IP:3500`). دەبێت لاپەڕەی سەرەکی وێب‑ئەپەکە بێت.

### 7.3 لاگەکان

```bash
pm2 logs wazn-express --lines 100
```

ئەگەر هەڕەشەی CORS یان 403 هەبێت، `ALLOWED_ORIGINS` لە `.env` پشکنینەوە بکە و دووبارە `pm2 restart wazn-express` بکە.

---

## هەنگاوی ٨: نوێکردنەوەی دیپلۆی (رێلیزێکی نوێ)

هەر کات کۆدی نوێ پۆشکرا و دەتەوێت لە سێرڤەر نوێی بکەیتەوە:

```bash
cd /var/www/wazn-express
git pull origin main
pnpm install --frozen-lockfile
pnpm run build
pm2 restart wazn-express
```

ئەگەر مایگریشنی داتابەیس نوێی هەبێت، یەک جار دووبارە مایگریشن ئەنجام بدە (هەر وەک لە 4.2)، دواتر `pm2 restart wazn-express`.

---

## تێبینیە ئەمنیتیەکان

1. **`.env`** هیچ کات commit مەکە؛ دڵنیابە لە `.gitignore` دایە.
2. **JWT_SECRET** و **MIGRATION_SECRET** زۆر بەهێز و هەڕەمەکی بن؛ بە `openssl rand -hex 32` یان `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` دروستی بکە.
3. **MySQL:** بەکارهێنەرێکی تایبەت بە پرۆژە بەکار بهێنە، نەک `root`؛ وشەی نهێنی بەهێز دابنێ.
4. **فایەروۆڵ:** تەنها پۆرتە پێویستەکان (22 SSH، 80/443 ئەگەر Nginx) کراوە بن؛ پۆرتی 3500 دەتوانرێت تەنها لە localhost بکرێتەوە (لە Nginx پرۆکسی دەکات).
5. **نوێکردنەوە:** سیستەم و پاکێجەکان بە بەردەوامی نوێ بکەرەوە.

---

## پوختەی هەنگاوەکان (Checklist)

- [ ] سێرڤەر (Ubuntu) ئامادەکراوە
- [ ] Node.js 20 و pnpm دامەزراون
- [ ] MySQL دامەزراوە، داتابەیس و بەکارهێنەر دروستکراوە
- [ ] ڕیپۆ کلۆن کراوە، `pnpm install` ئەنجام دراوە
- [ ] `.env` دروستکراوە و `DATABASE_URL`, `JWT_SECRET`, `MIGRATION_SECRET` پڕکراوەتەوە
- [ ] `pnpm run build` سەرکەوتووە
- [ ] مایگریشنی داتابەیس ئەنجام دراوە (db:push یان /api/run-migration)
- [ ] ئەپ بە PM2 دەستپێکراوە و `pm2 save` کراوە
- [ ] (ئۆپشناڵ) Nginx ڕێکخراوە و SSL بە Certbot زیادکراوە
- [ ] `/api/health` وەڵامی 200 دەداتەوە
- [ ] فرۆنتێند لە وێبگەڕدا بە دروستی کار دەکات

ئەگەر لە هەر هەنگاوێک کێشەت هەبوو، لاگەکانی `pm2 logs wazn-express` و لاگی Nginx (`/var/log/nginx/error.log`) بپشکنە.
