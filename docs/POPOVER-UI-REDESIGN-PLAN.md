# پلانی تەواو — گۆڕینی یوئەی پۆپۆڤەر
## Complete Plan: Popover UI Redesign

ئەم پلانە ڕێکخستنێکی تەواو دەدات بۆ **گۆڕینی یوئەی پۆپۆڤەر (Popover)** لە ئەپەکە، چونکە یوئەی ئێستا بە دڵ ناکەوێت. دوای جێبەجێکردنی پلانەکە، پۆپۆڤەرەکان ڕووکاری یەکگرتوو، ڕوون و گونجاوتریان هەبێت.

---

## ١. وەسفی ئەوەی ئێستا هەیە (Current State)

### ١.١ کۆمپۆنێنتی پۆپۆڤەر
- **فایل:** `client/src/components/ui/popover.tsx`
- **بنەما:** Radix UI — `@radix-ui/react-popover`
- **پارچەکان:** `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`
- **شێوازی ئێستا:**
  - پاشبنەمای: `bg-popover`، دەق: `text-popover-foreground`
  - قەبارە: `w-72` (٢٨٨px) بە شێوەی default
  - لێوار: `rounded-md`، سێبەر: `shadow-md`، padding: `p-4`
  - ئانیمەیشن: fade + zoom (zoom-out-95 / zoom-in-95) و slide بەپێی لای (top/left/right/bottom)
  - `sideOffset={4}`، `align="center"` وەک default

### ١.٢ شوێنە بەکارهێنانەکان
| پەرە / کۆمپۆنێنت | بەکارهێنان | تایبەتمەندی ئێستا |
|------------------|------------|---------------------|
| **Finance.tsx** | هەڵبژاردنی کڕیار (پارەدان)، هەڵبژاردنی دراو | `w-[400px] p-0`، Command لەناوەوە |
| **CustomerFinance.tsx** | هەڵبژاردنی کڕیار | `min-w-[300px] p-0`، modal=true |
| **BulkOrderForm.tsx** | هەڵبژاردنی کڕیار | `w-[400px] p-0`، Command |
| **CommissionForm.tsx** | هەڵبژاردنی کڕیار | `w-full p-0`، align=start |
| **ServicesManagement.tsx** | هەڵبژاردنی کڕیار (٢ جێ) | `w-full p-0`، align=start |
| **Packages.tsx** | پۆپۆڤەری کردار (٢ جێ) | `w-auto p-0`، align=start |
| **FullPackageForm.tsx** | هەڵبژاردنی کڕیار | `w-full p-0`، Command |
| **FullPackageDashboard.tsx** | پۆپۆڤەری زانیاری/کردار | `w-64 p-2` |
| **CommissionDashboard.tsx** | پۆپۆڤەری زانیاری/کردار | `w-64 p-2` |
| **AuditLogs.tsx** | import هەیە (بەکارهێنان پێویست بپشکنرێت) | - |

### ١.٣ کێشە/نایارامییە ئاساییەکان
- **نایەکگرتی:** هەندێک `w-[400px]`، هەندێک `w-full`، هەندێک `w-64` — بێ پلانێکی ڕوون.
- **ڕووکار:** `rounded-md` و `shadow-md` لە هەندێک شوێن زۆر سادە دەردەکەون؛ پێویست بە ڕووناکی/کۆنتڕاستی باشتر.
- **RTL:** پۆپۆڤەر لە دەقی کوردی/عەرەبیدا دەبێت لە لای ڕاست بێتەوە و جێگیری دروست بێت؛ ئێستا هەندێک جار لە RTL دەقەکاندا جێگیری ناڕەحەتە.
- **ئانیمەیشن:** تەنها zoom/fade هەیە؛ ئەگەر بەکارهێنەر ئارەزووی ساکار یان نەرمتر بکات، پێویست بە هەڵبژاردن.
- **ناوەڕۆکی زۆر:** کاتێک پۆپۆڤەر پڕە لە لیستی کڕیار، scroll و max-height هەندێک جار ناڕەحەتە.
- **دەستپێشخازی:** focus، escape، کلیک دەرەوە — Radix چاکە؛ بەڵام وەستانی focus لە ترێگرەر و نیشانەکردنی outline دەتوانێت باشتر بێت.

---

## ٢. ئامانجەکان (Goals)

1. **یوئەی یەکگرتوو و پرۆفیشناڵ** — هەموو پۆپۆڤەرەکان هەمان ڕێکخستنی ڕوونیان هەبێت (border-radius، shadow، spacing).
2. **گونجاندن لەگەڵ ڕووکار** — پۆپۆڤەر لە dark/light theme دا ڕوون و خوێندنەوەی ئاسان بێت.
3. **پشتیوانی RTL تەواو** — لە کوردی/عەرەبیدا جێگیری و ئانیمەیشن دروست؛ `direction` و `align` بەپێی `dir`.
4. **جۆرەکانی پۆپۆڤەر (variants)** — وەک default (گشتی)، compact (بچووک)، panel (فراوان بۆ لیست/فۆرم) بە شێوەی API یەکگرتوو.
5. **ئاسانی بەکارهێنان** — API وەک ئێستا بمێنێتەوە (Popover + Trigger + Content)؛ زیادکردنی className و variant بۆ ڕێکخستن.
6. **دەستپێشخازی (a11y)** — aria، focus trap، escape، و نیشانەکردنی focus بە ڕوونی.

---

## ٣. دیزاین و ڕووکارە پێشنیارکراوەکان

### ٣.١ شێوازی گشتی (Visual Style)
| بەش | ئێستا | پێشنیار |
|-----|--------|---------|
| **Border radius** | `rounded-md` | `rounded-xl` (١٢px) بۆ نەرمی؛ یان `rounded-lg` ئەگەر پێت باشترە |
| **سێبەر** | `shadow-md` | `shadow-lg` یان `shadow-xl` بۆ جیاکردنەوەی ڕوون لە پسپۆڕ |
| **Padding** | `p-4` لە default | `p-0` بۆ panel variant (وەک ئێستا لە customer picker)، `p-3` یان `p-4` بۆ default |
| **Border** | border یەکەمی سیستەم | `border border-border/80` یان `ring-1 ring-border` بۆ کۆنتڕاستی لە سەر هەردوو theme |
| **پاشبنەما** | `bg-popover` | هەمان؛ بەڵام لە dark theme دا `bg-popover/95 backdrop-blur-sm` بۆ نەرمی |

### ٣.٢ جۆرەکان (Variants)
| جۆر | ناو | وەسف | بەکارهێنان |
|-----|-----|------|------------|
| **default** | گشتی | پادێکی مامناوەند، `p-4`، `rounded-xl`، `shadow-lg` | پەیام، نیشانە، ناوەڕۆکی کورت |
| **compact** | بچووک | `p-2`، `rounded-lg`، `shadow-md`، قەبارەی ناچاری بچووک | دوگمە/لینکەکانی کردار |
| **panel** | پانێڵ | `p-0`، `rounded-xl`، `min-w`/`w` بەپێی پێداویست، ناوەڕۆک scroll | هەڵبژاردنی کڕیار، Command، لیستی درێژ |

### ٣.٣ ئانیمەیشن
- **ئێستا:** fade + zoom (٩٥٪) + slide.
- **پێشنیار:** هەمان بنەما بەڵام:
  - کاتی درێژتر بۆ نەرمی: `duration-200` → `duration-150` یان `duration-200` (هەڵبژاردن).
  - ئەگەر بەکارهێنەر ئارەزووی کەمێک ساکارتر بکات: fade + slide تەنها (بێ zoom).
- **RTL:** لە `dir="rtl"` دا، slide لە لای چەپەوە بێت (لە راستەوە بۆ چەپ)؛ Radix `side` و `align` دەتوانرێت بە `align="start"` لە RTL دروست کار بکات ئەگەر لە container دا `dir` دروست بێت.

### ٣.٤ قەبارە و spacing
- **Panel (customer picker):** `min-w-[320px]` یان `min-w-[360px]` بۆ یەکگرتی؛ `max-h-[min(70vh,400px)]` بۆ scroll.
- **Default:** `w-72` وەک ئێستا یان `min-w-[16rem] max-w-[20rem]`.
- **Compact:** `min-w-[8rem]`، قەبارە بەپێی ناوەڕۆک.

---

## ٤. ڕێکخستنی تەکنیکی (Technical Approach)

### ٤.١ فایلی کۆمپۆنێنت
- **شوێن:** `client/src/components/ui/popover.tsx`
- **گۆڕانکاریە سەرەکیەکان:**
  1. زیادکردنی **variant** بۆ `PopoverContent`: `default` | `compact` | `panel` (وەک prop).
  2. گۆڕینی کلاسەکانی default بۆ `rounded-xl`، `shadow-lg`، و پادێکی جیاواز بەپێی variant.
  3. زیادکردنی **contentClassName** یان بەردەستکردنی className وەک ئێستا بۆ override.
  4. لە `panel` variant دا: `p-0`، `overflow-hidden`، `max-h-[min(70vh,400px)]` یان `overflow-y-auto` لەناوەوە بە ناوەڕۆک.
  5. پشتیوانی **RTL:** وەرگرتنی `dir` لە document یان Theme/Language context و پاسکردنی `align` (ئەگەر پێویست بێت؛ Radix زۆرجار خۆی چارەسەر دەکات ئەگەر `<html dir="rtl">` دروست بێت).

### ٤.٢ CSS و Theme
- **فایل:** `client/src/index.css`
- زیادکردنی نوێ یان گۆڕینی `--popover` و `--popover-foreground` لە `:root` و `.dark` بۆ کۆنتڕاستی باشتر.
- ئەگەر پێویست بێت: کلاسی helper وەک `.popover-panel` بۆ قەبارە و overflow (ئەگەر لە یەک شوێن زیادە بەکاربهێنرێت).

### ٤.٣ API ی کۆمپۆنێنت (بەردەستکراو)
```tsx
// وەک ئێستا، بە زیادکردنی variant و optional props
<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>...</PopoverTrigger>
  <PopoverContent
    variant="panel"       // optional: "default" | "compact" | "panel"
    align="start"
    className="w-[400px]" // override قەبارە
    sideOffset={8}        // optional، وەک ئێستا
  >
    ...
  </PopoverContent>
</Popover>
```
- **Breaking change:** نەبێت؛ `variant` optionalە و default وەک ئێستا دەمێنێتەوە تا پێشنیارە نوێیەکان جێبەجێ بکرێت.

### ٤.٤ پەڕەکان (Migration)
- **قۆناغ ١:** تەنها `popover.tsx` و `index.css` بگۆڕێت — variant و شێوازی نوێ زیاد بکرێت؛ default وەک «گشتیی نوێ» (rounded-xl، shadow-lg).
- **قۆناغ ٢:** لە پەڕەکاندا جێگەی هەڵبژاردنی کڕیار `variant="panel"` زیاد بکرێت و `className` کە `p-0` و `w-[400px]` دەنوێننەوە بە `variant="panel"` و `className="w-[400px]"` یان `min-w-[360px]`.
- **قۆناغ ٣:** پۆپۆڤەرە بچووکەکان (وەک Packages، FullPackageDashboard، CommissionDashboard) `variant="compact"` یان هەمان default بە شێوازی نوێ.
- **قۆناغ ٤:** پشکنینی RTL لە هەموو پەڕەکاندا و چاککردنی align/side ئەگەر پێویست بێت.

---

## ٥. قۆناغەکانی جێبەجێکردن (Implementation Phases)

### قۆناغ ١ — کۆمپۆنێنتی پۆپۆڤەر و CSS
- [ ] لە `popover.tsx` دا propی `variant` زیاد بکە (`"default" | "compact" | "panel"`).
- [ ] کلاسەکانی `PopoverContent` بەپێی variant جیا بکە:
  - default: `rounded-xl shadow-lg p-4`، `border border-border/80` یان ring.
  - compact: `rounded-lg shadow-md p-2`.
  - panel: `rounded-xl shadow-lg p-0 overflow-hidden`، و optional `max-h-[min(70vh,400px)]` بۆ ناوەڕۆکی scroll.
- [ ] لە `index.css` دا `--popover` و `--popover-foreground` پشکنین و ئەگەر پێویست بوو باشتر بکرێن بۆ dark/light.
- [ ] بەردەستکردنی `contentClassName` یان هەمان `className` بۆ override (وەک ئێستا).

### قۆناغ ٢ — هەڵبژاردنی کڕیار (Panel variant)
- [ ] Finance.tsx: `PopoverContent` → `variant="panel"`، `className="w-[400px]"` یان `min-w-[360px]`.
- [ ] CustomerFinance.tsx: هەمان.
- [ ] BulkOrderForm.tsx، CommissionForm.tsx، ServicesManagement.tsx، FullPackageForm.tsx: هەمان.

### قۆناغ ٣ — پۆپۆڤەرەکانی تر
- [ ] Packages.tsx: دوو پۆپۆڤەری کردار — `variant="compact"` یان default بە شێوازی نوێ.
- [ ] FullPackageDashboard.tsx، CommissionDashboard.tsx: `variant="compact"` یان default، و پشکنینی قەبارە.
- [ ] AuditLogs.tsx: پشکنین کە پۆپۆڤەر بەکارهێنرابێت؛ ئەگەر بەڵێ، جۆر و className ڕێکبخە.

### قۆناغ ٤ — RTL و پشکنین
- [ ] لە RTL (کوردی/عەرەب) دا پۆپۆڤەرەکان بپشکنە (جێگیری، لای slide، ناوەڕۆک).
- [ ] ئەگەر Radix لەگەڵ `<html dir="rtl">` دروست کار نەکرد، `align` یان `side` بەپێی `dir` دەستکاری بکە (ئەگەر پێویست بێت).

### قۆناغ ٥ — بەڵگەنامە و کۆنسیستنسی
- [ ] نووسینی کۆمێنتێکی کورت لە سەر `popover.tsx` بۆ variant و بەکارهێنان.
- [ ] پشکنینی یەکگرتی لە هەموو پەڕەکاندا و ڕێکخستنی نێوەندی قەبارە (وەک ٣٢٠–٤٠٠px بۆ panel).

---

## ٦. تێست و چەک (Testing & Checklist)

- [ ] پۆپۆڤەر لە Finance (هەڵبژاردنی کڕیار و دراو) کار دەکات و دەرکەوتنەکەی ڕوون و یەکگرتووە.
- [ ] پۆپۆڤەر لە BulkOrderForm، CommissionForm، ServicesManagement، FullPackageForm کار دەکات.
- [ ] پۆپۆڤەرە بچووکەکان لە Packages، FullPackageDashboard، CommissionDashboard ڕوون و بەکاردێن.
- [ ] لە شاشەی بچووک (مۆبایل) دا پۆپۆڤەر دەرنەدەچێت یان overflow ناهێنێت؛ قەبارە و max-height پشکنین.
- [ ] لە dark و light theme دا کۆنتڕاست و خوێندنەوە ئاسانە.
- [ ] لە زمانی کوردی/عەرەبیدا (RTL) جێگیری و slide دروستە.
- [ ] کلیکی دەرەوە و Escape پۆپۆڤەر دەخاتەوە؛ focus بە شێوەیەکی دروست دەگەڕێتەوە بۆ trigger.

---

## ٧. کورتە

| بەش | ئەنجام |
|-----|--------|
| **کۆمپۆنێنت** | `PopoverContent` بە `variant`: default، compact، panel؛ شێوازی نوێ: rounded-xl، shadow-lg، border/ring ڕوون. |
| **Panel** | بۆ هەڵبژاردنی کڕیار و لیستی درێژ؛ p-0، overflow، max-height. |
| **RTL** | پشکنین و چاککردن بە پێی dir. |
| **پەڕەکان** | Finance، CustomerFinance، BulkOrderForm، CommissionForm، ServicesManagement، FullPackageForm، Packages، FullPackageDashboard، CommissionDashboard، AuditLogs. |
| **Theme** | پشتیوانی dark/light بە `--popover` و کۆنتڕاستی باش. |

دوای جێبەجێکردنی ئەم پلانە، یوئەی پۆپۆڤەر یەکگرتوو، ڕوون و گونجاوتر دەبێت، و دەتوانرێت بە variant و className بە شێوەیەکی ئاسان ڕێکبخرێتەوە.
