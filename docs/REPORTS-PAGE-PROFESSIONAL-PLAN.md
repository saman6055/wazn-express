# پلانی پرۆفیشنالکردنی پەڕەی ڕاپۆرتەکان
## Reports Page — Very Professional Plan

ئەم پلانە تەنها بۆ **پەڕەی ڕاپۆرتەکان** (`/reports`) نووسراوە، بۆ ئەوەی UI/UX و فەنکشنی ڕاپۆرتەکان زۆر پرۆفیشنال و بەکارپێهاتوو بن.

---

## ١. ئەوەی ئێستا هەیە (وەسفێکی کورت)

- **Header:** بانێری گرادیێنت (indigo → purple → pink) بە ناونیشانی "Reports" و فلتەری "Last 30 days".
- **KPI کارتەکان (٤):** Total Revenue، Total Profit، Delivery Rate، Outstanding Debt.
- **تابەکان:** Overview، Customers، Financial، Operational.
- **Overview:** Top Customers، Outstanding Balances، Package Status Distribution (progress bars).
- **Customers:** Total/Active/VIP، لیستی Customer Performance بە دوگمەی Export.
- **Financial:** ڕاپۆرتی دارایی باچەکان، Revenue / P&amp;L / Receivables / Cash Flow کارتەکان بە PDF/Excel (ئێستا "coming soon").
- **Operational:** Package Report، Delivery Performance بە PDF/Excel.

**کەمەکان:** دەقەکان زۆربەی ئینگلیزین؛ فلتەری مەودایە کات کاریگەری لەسەر هەندێک داتا نییە؛ Export ڕاستەقینە نییە؛ فۆرماتی پارە (وەک Total Profit) ڕوون نییە؛ چارت/گرافیکی ڕاستەقینە نییە؛ i18n تەواو نییە.

---

## ٢. ئامانجە سەرەکییەکان

| ئامانج | وەسف |
|--------|------|
| **بینراو (Visual)** | UI یەکگرتوو، چارت/گرافیکی ڕاستەقینە، فۆرماتی ژمارە و پارە ڕوون، skeleton/loading حەرفە. |
| **فەنکشنی کارا** | فلتەری مەودایە کات کاریگەر لەسەر هەموو ئامار و خشتەکان؛ Exportی ڕاستەقینە (PDF/Excel)؛ drill-down بۆ وردەکاری. |
| **زمان و RTL** | هەموو دەقەکان بە `t()` (کوردی/ئینگلیزی/عەرەبی/چینی)；ڕیزبەندی RTL و فۆرماتی ژمارە لە کوردیدا. |
| **پرۆفیشنال** | پوختەی بەڕێوەبەر (Executive Summary)، چاپ/PDF یەکگرتوو، خێراکان و فلتەرە پیشەسازییەکان. |

---

## ٣. پلانە وردەکان

### ٣.١ فۆرماتی ژمارە و پارە

- **پارە:** هەمیشە بە شێوازی `$1,234.56` یان `-$123.45` (negative)، هەرگیز `75.00-$` نەبێت.
- **ژمارە:** بە separatorی هەزار (وەک `1,234`) لە دەقە گەورەکاندا.
- **ڕێژە:** `79%` یان `79.0%` بە پەیوەندی بە دەقەکە.
- **بەکارهێنان:** یەک utility وەک `formatCurrency(value)` و `formatNumber(value)` لە یەک شوێندا (وەک `client/src/lib/format.ts`) و بەکارهێنانی لە هەموو پەڕەی ڕاپۆرتەکاندا.

### ٣.٢ فلتەری مەودایە کات (Date Range)

- **ئێستا:** Select "Last 7/30/90/365 days" هەیە بەڵام تەنها لە هەندێک statsدا کاریگەری هەیە.
- **دەستکاری:**
  - هەموو داتاکانی پەڕە (revenue، profit، top customers، packages، delivery rate، debt) بە مەودایە کات فلتەر بکرێن.
  - ئەگەر API یان query پشتگیری نەکات، لە client-side فلتەر بکرێت (بە `createdAt` / `paidAt`).
  - ئەگەر پێویست بێت، API نوێ بکرێتەوە بۆ وەرگرتنی `startDate` و `endDate` (وەک `reports.topCustomers`، `reports.profitReport`).

### ٣.٣ چارت و داتاڤیز (Charts &amp; Data Viz)

- **Overview tab:**
  - چارتی بار (Bar) یان لاین بۆ **Revenue بە کات** (ڕۆژ/هەفتە/مانگ بە پشتیوانی مەودایە کات).
  - چارتی پای (Pie) یان دۆنات بۆ **Package Status Distribution** لە جیاتی تەنها progress bar (هەردوو بەردەست بن یان تەنها چارت).
  - چارتی بچووک (sparkline) لە سەر KPI کارتەکان (ئەگەر داتای مێژوویی بەردەست بێت).
- **Financial tab:**
  - چارتی بار یان لاین بۆ Revenue / Payments بە کات.
  - چارتی سادە بۆ Cash flow (in vs out) ئەگەر داتا بەردەست بێت.
- **کتابخانە:** Recharts یان Chart.js (ئەگەر پێشتر بەکارنەهاتووە، Recharts لەگەڵ shadcn/ui ڕێک دەکەوێت).
- **رەنگ و تێما:** بەکارهێنانی CSS variables (`--chart-1` … `--chart-5`) بۆ یەکگرتوویی.
- **Empty state:** کاتێک داتا نییە، ئایکۆن + دەقی "هیچ داتایەک نییە" یان "بۆ ئەم مەودایە کاتە داتا نییە".

### ٣.٤ Exportی ڕاستەقینە (PDF / Excel)

- **ئێستا:** `handleExport(type, format)` تەنها toast "Feature coming soon" دەنێرێت.
- **دەستکاری:**
  - **Excel:** بۆ هەر تابێک (Overview summary، Top Customers، Outstanding Balances، Customer Performance، Revenue/PnL/Receivables/Cash Flow، Package/Delivery) فایلی Excel دروست بکرێت بە داتای فلتەرکراو (مەودایە کات) و فۆرماتی ڕوون (پارە، ڕێژە).
  - **PDF:** ڕاپۆرتی یەک لاپەڕەیی یان چەند لاپەڕە بۆ هەمان بەشەکان، لەگەڵ ناونیشانی ڕاپۆرت، بەروار، و لۆگۆ/ناوی کۆمپانیا.
- **شوێنی ژمارەکردن:** دەتوانرێت لە client بە همەان داتای tRPC دروست بکرێت، یان endpointی تایبەت بۆ export (ئەگەر پێویست بێت).
- **ناونیشانی فایل:** `Reports-Summary-2026-02-15.xlsx` یان `Revenue-Report-30days.pdf` (بەروار یان مەودایە کات لە ناوەکەدا).

### ٣.٥ پوختەی بەڕێوەبەر (Executive Summary)

- **شوێن:** لە سەرەوەی تابی Overview، یان وەک بەشێکی سەرەکی لەژێر KPI کارتەکان.
- **ناونیشان:** "پوختە" / "Executive Summary" (بە i18n).
- **ناوەڕۆک:** ٢–۴ ڕیز دەق بۆ: "لەم مەودایە کاتەدا گشتی داهات $X بوو، قەرزی نەدروست $Y، ڕێژەی گەیاندن Z%."
- **چاپ:** ئەم پوختەیە لەگەڵ KPI کارتەکان بچێتە ناو PDFی "Reports Summary".

### ٣.٦ یەکگرتی UI و کۆمپۆنێنت

- **کارتی ئامار (KPI):** یەک کۆمپۆنێنت وەک `ReportMetricCard` (ناونیشان، بەها، جۆری رەنگ، ئایکۆن، لقە دەق/تێندەنس) بۆ ٤ کارتی سەرەوە تا شێواز و spacing یەک بێت.
- **خشتەکان:** هەمان `Table` + header ی ڕوون؛ لینک لەسەر کڕیار بۆ پەڕەی وردەکاری کڕیار؛ پاگینەیشن ئەگەر ڕیزەکان زۆر بن.
- **تابەکان:** ناونیشانی تابەکان بە i18n؛ ئایکۆنی گونجاو بۆ هەر تاب.
- **دوگمەی Export:** یەک شێواز (ئایکۆن + دەق)، و loading state کاتێک export دەکرێت.

### ٣.٧ زمان (i18n)

- **هەموو دەقەکان** لە `Reports.tsx` بە `t('reports.xxx')` یان keyی گونجاو لە `en.json` / `ku.json` / `ar.json` / `zh.json`.
- **زیادکردنی keyەکان** بۆ: سەرەوەی پەڕە (Reports، Analytics &amp; Insights، Comprehensive...)، ناونیشانی KPI (Total Revenue، Total Profit، Delivery Rate، Outstanding Debt)، ناونیشانی تابەکان، سەرۆکی خشتەکان، دەقەکانی empty state، دوگمەکان (Export، PDF، Excel)، پوختە، فلتەری مەودایە کات (Last 7/30/90 days، Last year).

### ٣.٨ بارکردن و Empty State

- **Skeleton:** کاتێک `customers` یان `packages` یان `profitReport` بارنەکراون، لە جیاتی خشتە/چارتی بەتاڵ، skeletonی خشتە یان چارت نیشان بدرێت.
- **Empty state:** "No customer data available"، "No outstanding balances" بە i18n؛ هەمان شێوازی ئایکۆن + دەق لە هەموو پەڕەدا.
- **Error state:** ئەگەر query هەڵە بدات، دەقێکی ڕوون و (ئەگەر گونجاو بێت) دوگمەی retry.

### ٣.٩ دەستڕاگەیشتن و RTL

- **Keyboard:** focus visible بۆ Select، Tab، Button؛ ترتیبی tab ڕێک.
- **RTL:** لە کوردی/عەرەبیدا spacing و margin و سەرۆکی خشتە ڕاستەوخۆ چەک بکرێن (ئەگەر ئێستا تەنها LTR بێت).
- **Contrast:** رەنگی دەق لەسەر کارتی گرادیێنت و بە پسپۆڕی green/red/blue چەک بکرێت.

### ٣.١٠ Performance و داتا

- **پاگینەیشن/limit:** بۆ لیستی گەورە (وەک top customers ١٠٠+) پاگینەیشن یان "Show more" تا پەڕە خێرا بێت.
- **بەکارهێنانی مەودایە کات:** کاتێک فلتەری مەودایە کات دەگۆڕێت، تەنها queryە پەیوەندیدارەکان دووبارە بکرێنەوە (ئەگەر API پشتگیری بکات).

---

## ٤. ترتیبەکانی جێبەجێکردن (پێشنیار)

| قۆناغ | کارەکان | تەخمینی کات |
|--------|---------|----------------|
| **A — بنەما و فۆرمات** | `formatCurrency` / `formatNumber`؛ چەککردنی فۆرماتی پارە لە هەموو پەڕەدا؛ زیادکردنی keyەکانی i18n بۆ دەقە سەرەکییەکان؛ بەکارهێنانی `t()` لە Reports | ١ ڕۆژ |
| **B — فلتەر و داتا** | پەیوەندیکردنی فلتەری مەودایە کات بە هەموو stats و لیستەکان (client-side یان API)；سkeleton بۆ بارکردن؛ empty/error state | 1–2 ڕۆژ |
| **C — چارت** | زیادکردنی Recharts؛ چارتی Revenue بە کات؛ چارتی Package Status (Pie/Bar)；chart empty state | 2 ڕۆژ |
| **D — Export** | Excel export بۆ Overview + Customers + Financial + Operational؛ PDF export (یەک لاپەڕە یان چەند) بۆ هەمان بەشەکان؛ loading state بۆ export | 2–3 ڕۆژ |
| **E — پرۆفیشنال تەواو** | پوختەی بەڕێوەبەر (Executive Summary)；ReportMetricCard یەکگرتوو؛ polish تاب و خشتە؛ RTL و a11y چەک | 1–2 ڕۆژ |

**کۆی گشتی (تەخمینی):** ٧–١٠ ڕۆژکاری.

---

## ٥. فایلە پەیوەندیدارەکان

| فایل | بەکار |
|------|--------|
| `client/src/pages/Reports.tsx` | پەڕەی سەرەکی ڕاپۆرتەکان |
| `client/src/lib/format.ts` | (دروستکردن ئەگەر نییە) formatCurrency، formatNumber |
| `client/src/locales/{en,ku,ar,zh}.json` | keyەکانی `reports.*` |
| `server/routers/reports.*` یان `server/routers/reports.ts` | API بۆ topCustomers، profitReport، customersWithDebt، (ئەگەر date range زیاد بکرێت) |
| `docs/UI-UX-PROFESSIONAL-PLAN.md` | پلانی گشتی UI/UX بۆ یەکگرتوویی |

---

## ٦. تێبینی کورت

- **سەرەتا** قۆناغە A و B پێش چارت و Export باشترن تا داتا و فۆرمات ڕاست بن.
- **چارت** دەتوانرێت بە Recharts یان Chart.js بکرێت؛ Recharts لەگەڵ React و shadcn زۆر بەکاردەهێنرێت.
- **Export:** ئەگەر لە client دروست بکرێت، کتابخانەی وەک `xlsx` و `jspdf` یان html-to-pdf (وەک لە CommissionDashboard) بەکار بهێنرێت.
- پەڕەی ڕاپۆرتەکان دوای ئەم پلانە دەبێت **زۆر پرۆفیشنال** بێت لە همەڵی بینراو و فەنکشنی کارا و زمان و export.
