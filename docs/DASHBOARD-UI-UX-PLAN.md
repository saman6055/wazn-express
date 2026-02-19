# پلانی نوێکردنەوەی UI/UXی داشبۆرد — Wazn Express
## Dashboard UI/UX Professional Upgrade Plan

ئەم پلانە بۆ باشکردنی ڕووکار و ئەزموونی بەکارهێنەر (UI/UX)ی داشبۆردی سیستەمە، بە شێوەیەکی پرۆفیشناڵ و ڕێکخراو.

---

## ١. ئێستا چی هەیە (وەرگرتن)

- **داشبۆردی ئەدمین:** کارتە مالییەکان، گرافی داهات، چالاکییەکان، هەڵبژاردنە خێراکان، ئاگاداریەکان، باچە چالاکەکان، قەرزداران، باشترین کڕیاران.
- **Layout:** `DashboardLayout` — سایدبار گرووپکراو، مۆبایل فرێم، RTL، تێما ڕووناک/تاریک، زمان.
- **داشبۆردەکانی تر:** `StaffDashboard` و `AccountantDashboard` بۆ ڕۆڵی employee و accountant.
- **تێما:** `index.css` — oklch، primary teal/navy، status badges، چەند animation بۆ سکانەر.

---

## ٢. ئامانجەکانی UI/UX

| ئامانج | وەسف |
|--------|------|
| **ساکاربوون** | ڕیزبەندی ڕوون، فێرکارییەکان لە یەک شوێن، کەم قەلاقی چاو |
| **پێکهاتە (Consistency)** | هەمان ستایڵ لە هەموو داشبۆرد و کارت و بەستەرەکاندا |
| **خوێندنەوەی ئاسان** | فۆنت و contrast و شێوازی نووسین یەکگرتوو |
| **ئەزموونی مۆبایل** | تاچ گونجاو، سکرۆڵ و فلتەر باش، سایدبار بە شێوەیەکی ڕێک |
| **خێرایی و وەڵام** | loading و empty state ڕوون، کەم layout shift |
| **دەستڕاگەیشتن (Accessibility)** | focus، contrast، RTL، وەرگێڕان |

---

## ٣. پلانی جێبەجێکردن (بە پێی prioritization)

### فەیزی ١ — Design System و Consistency (١–٢ هەفتە)

1. **Typography**
   - یەک فۆنتی سەرەکی (وەک Inter) بە scale ڕێک: `text-xs / sm / base / lg / xl / 2xl / 3xl`.
   - سەرەوەکان: `font-bold` و `tracking-tight` بۆ titiles؛ `text-muted-foreground` بۆ وەسف.
   - لە هەموو داشبۆرد و کارتەکاندا ئەم یاسایانە بەکاربهێنرێت.

2. **Spacing & Grid**
   - فێرکارییەکان: `space-y-6` یان `gap-6` بۆ بەشی سەرەوە؛ `gap-4` بۆ کارتە ناوخۆییەکان.
   - Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` بۆ کارتە ئامارییەکان؛ هەمان pattern لە Staff و Accountant داشبۆرددا.

3. **Cards**
   - یەک ستایڵی کارت: `border-0 shadow-lg` یان `ring-1 ring-border`؛ `rounded-xl` یان `rounded-2xl` بۆ سەرەوە.
   - CardHeader: `border-b bg-gradient-to-r from-muted/50 to-muted/30` یان یەک `bg-muted/30` بۆ هەموو کارتە «سەرەوە»ەکان.
   - لە Dashboard، StaffDashboard و AccountantDashboard و DashboardTab دا هەمان pattern.

4. **Colors**
   - بەکارهێنانی CSS variables: `primary`, `muted`, `destructive`, `success`, `warning` بەجیاتی hardcoded hex (جگە لە chartەکان کە دەتوانرێت chart-1..5 بەکاربهێنرێت).
   - کارتی مالی: یەک set رەنگ بۆ داهات (green)، قەرز (red)، و گشتی (blue/purple).

5. **Buttons & Quick Actions**
   - دڵنیابوون لە `Button` و لینکەکان یەک شێوازن؛ Quick Action هاورێک و border و hover یەکگرتوو.

ئەم فەیزە دەتوانرێت لە یەک فایل «design tokens» یان `index.css` و یەک کۆمپۆنێنتی `DashboardCard` دەستپێبکات و دواتر بڵاوەوە بکات.

---

### فەیزی ٢ — داشبۆردی سەرەکی (Admin Dashboard) (١–٢ هەفتە)

1. **Hero / Welcome Block**
   - ناوەڕۆک و دووگمەکانی «Daily Report» و «Report by Date» بە شێوەیەکی ڕوون و کەم قەلاق.
   - لە مۆبایڵدا بەشی گرادیانت و دەق بە شێوەیەکی کورت و خوێندنەوەی ئاسان.

2. **Hierarchy of Sections**
   - **سەرەوە:** Welcome + دووگمەکانی ڕاپۆرت.
   - **دووەم:** کارتە مالییەکان (٤ کارت).
   - **سێیەم:** کارتە ئامارییەکان (کڕیار، پاکەت، باچ، delivered).
   - **چوارەم:** ئاگاداریەکان (Alert Summary + لیستی alerts).
   - **پێنجەم:** گراف و چارتەکان (Revenue + Package volume + Shipping type).
   - **شەشەم:** چالاکییە تازە + Quick Actions.
   - **کۆتایی:** قەرزداران + باچە چالاکەکان؛ باشترین کڕیاران + Package status.

   دەتوانرێت بە «section titles» یان dividerە کەمەکان ئەم hierarchy یە ڕوونتر بکات.

3. **Charts**
   - هەمان بەرزی container (وەک `h-[300px]`) بۆ کەمکردنەوەی layout shift.
   - Tooltip و Legend بە زمانی سیستەم (i18n) و فۆرماتی ژمارە/دراو ڕێکخراو.
   - لە مۆبایڵدا چارتەکان scroll یان resize بکەن بەبێ شکستن.

4. **Loading & Empty States**
   - بۆ هەر بەشی داتادار (کارتە ئامارییەکان، چارت، چالاکی، قەرزداران، باچ): skeleton یان «No data» یەکگرتوو.
   - وەک `DashboardLayoutSkeleton` بەڵام بۆ بەشەکانی ناو داشبۆرد.

5. **Alerts**
   - Alert Summary و کارتی ئاگاداری بە رەنگی semantic (warning/error) و ئایکۆن ڕوون؛ لینک بۆ پەڕەی وردەتر.

ئەم فەیزە تەنها سەر داشبۆردی ئەدمین (`Dashboard.tsx`) و کۆمپۆنێنتەکانی ناوەوەی دەگرێتەوە.

---

### فەیزی ٣ — Layout و Navigation (نزیک ١ هەفتە)

1. **Sidebar (DashboardLayout)**
   - دڵنیابوون لەوەی گرووپەکان و ئایتمەکان spacing و hover یەکگرتوون.
   - لە مۆبایڵدا داخستنەوەی سایدبار دوای هەڵبژاردنی لاپەڕە.
   - Active state ڕوون (وەک هێڵ یان پسپۆڕی رەنگ لە لای چەپ/ڕاست).

2. **Header (مۆبایل)**
   - لوۆگۆ و ناوی کۆمپانیا و هەڵگری بەکارهێنەر بە شێوەیەکی ڕێک و کەم قەلاق.

3. **RTL**
   - لە هەموو بەشە visualەکاندا RTL دروست کاربکات (margin، padding، سایدبار، چارتەکان ئەگەر پێویست بێت).

4. **Theme (Dark/Light)**
   - دڵنیابوون لەوەی کارت و گرادیانت و رەنگەکان لە dark mode دا contrast باش و ناسک نەبن.

ئەم فەیزە سەر `DashboardLayout.tsx` و `index.css` (و ئەگەر هەبوو theme toggler) دەگرێتەوە.

---

### فەیزی ٤ — Staff و Accountant Dashboards (نزیک ١ هەفتە)

1. **StaffDashboard**
   - هەمان design tokens و card style و spacing وەک داشبۆردی ئەدمین (بەبێ ئاڵۆزی زۆر).
   - Hero block: هەمان شێواز (گرادیانت، دەق، بەڵام ناوەڕۆکی staff).
   - Customer lookup card و quick actions بە یەک ستایڵی کارت و دووگمە.

2. **AccountantDashboard**
   - هەمان hierarchy: Hero → کارتە مالییەکان → چارتەکان → لیستەکان (قەرزداران، paymentەکان).
   - بەکارهێنانی هەمان FinancialCard یان کارتی مالی وەک لە Dashboard.tsx (ئەگەر کۆمپۆنێنت shared بکرێت).

3. **Reuse**
   - ئەگەر پێویست بێت: جێبەجێکردنی کۆمپۆنێنتە sharedەکان وەک `DashboardHero`, `StatsCard`, `FinancialCard` لە فایلی یەکەم یان `components/dashboard/` بۆ ئەوەی هەر سێ داشبۆرد یەک شێواز بن.

ئەم فەیزە `StaffDashboard.tsx` و `AccountantDashboard.tsx` و ئەگەر دروستکرا `components/dashboard/*` دەگرێتەوە.

---

### فەیزی ٥ — Polish و Accessibility (نزیک ١ هەفتە)

1. **Focus & Keyboard**
   - دڵنیابوون لەوەی هەموو بەستەر و دووگمە و selectەکان focus visible و ترتیبەکەیان لە tab ڕێکە.

2. **Contrast**
   - چێککردنی `text-muted-foreground` و رەنگی سەر کارتەکان لە light و dark بۆ WCAG AA (ئەگەر دەتوانرێت).

3. **Touch Targets**
   - لە مۆبایڵدا دووگمە و quick actionەکان کەمێک گەورەتر (وەک min 44px height) بۆ دەستڕاگەیشتن.

4. **Micro-interactions**
   - هەمان transition بۆ کارت (وەک `transition-all duration-300`)؛ کەم animation بۆ loading (وەک spinner یان skeleton) بەبێ زیادەڕەوی.

5. **i18n**
   - دڵنیابوون لەوەی هەموو دەق و tooltip و labelەکان لە locale فایلەکاندا و date/number format بە ڕێکخستنی زمان ڕاستە.

ئەم فەیزە لە سەر هەموو کۆمپۆنێنتەکانی داشبۆرد و layout دەتوانرێت بە شێوەی «pass»ێک جێبەجێ بکرێت.

---

## ٤. پێشنیاراتی تەکنیکی

- **کۆمپۆنێنتە یەکگرتووەکان:** دروستکردنی فۆڵدەری `client/src/components/dashboard/` و جێبەجێکردنی:
  - `DashboardHero.tsx` — بۆ سەرەوەی داشبۆرد (title, subtitle, primary actions).
  - `StatsCard.tsx` / `FinancialCard.tsx` — کارتی ئاماری/مالی یەکگرتوو.
  - `DashboardSection.tsx` — wrapper بۆ section title + content.
  - `ChartContainer.tsx` — wrapper بۆ چارتەکان بە بەرزی fixed و skeleton.
- **Design tokens:** هەڵگرتنی رەنگ و spacing لە `index.css` (وەک ئێستا) و بەکارهێنانیان لە Tailwind و کۆمپۆنێنتەکاندا؛ پێشنیار ناکرێت رەنگی تایبەت hardcode بکرێت جگە لە chart.
- **Testing:** دوای هەر فەیزێک manual check لە مۆبایل و دێسکتۆپ و RTL و dark mode.

---

## ٥. کۆتایی

ئەم پلانە ڕێکخستنی کارەکە دەکات بە پێی **Design System → Admin Dashboard → Layout/Nav → Staff & Accountant → Polish & A11y**. دەتوانرێت فەیزەکان بە پێی کات و تیمی بچوکەوە یان گەورەوە جێبەجێ بکرێن؛ دەستپێکردن لە فەیزی ١ و ٢ زۆرترین کاریگەری لەسەر «پرۆفیشناڵ» دەبێت.

ئەگەر بتەوێت دەستمان بە جێبەجێکردنی فەیزێک بکەین (وەک فەیزی ١ یان ٢)، ڕاستەوخۆ بڵێ دەستپێدەکەین لە کوێ.
