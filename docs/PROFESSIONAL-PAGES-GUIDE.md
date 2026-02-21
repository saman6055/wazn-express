# ڕێنمایی دیمەنی پرۆفیشنال بۆ هەموو پەڕەکان (فەیسەکان)

بۆ ئەوەی **هەموو فەیسەکان** زۆر پرۆفیشنال دەربکەون، ئەم ڕێنماییە و کۆمپۆنێنتە بەکار بهێنە.

---

## ١. کۆمپۆنێنتەکان و کلاسەکان

### PageHeader (`@/components/layout/PageHeader`)
سەرەوەی هەر پەڕەیەک دەبێت یەک فۆرمات بێت:
- **icon:** ئایکۆنی Lucide
- **title:** ناونیشانی پەڕە
- **subtitle:** (ئارەزوومەندانە) ڕوونکردنەوەی کورت
- **variant:** `"gradient"` | `"solid"` | `"muted"` | `"white"`
- **actions:** (ئارەزوومەندانە) دوگمەکان یان کردارەکان لە لای ڕاست
- **stats:** (ئارەزوومەندانە) چەند کاردی ژمارە لە خوار ناونیشان
- **className:** (ئارەزوومەندانە) override بۆ gradient یان ڕەنگ

**نمونە:**
```tsx
import { PageHeader } from "@/components/layout/PageHeader";
import { Database } from "lucide-react";

<PageHeader
  icon={Database}
  title={t("dataManagement.title")}
  subtitle={t("dataManagement.subtitle")}
  variant="gradient"
  stats={<> ... کاردە ژمارەکان ... </>}
/>
```

### کلاسەکانی CSS (لە `index.css`)
- **`.pro-page`** — wrapperی پەڕە: `space-y-6` و `max-w-[1600px]`
- **`.pro-section`** — بەشی ناوەڕۆک: `space-y-4`
- **`.pro-section-title`** — ناونیشانی بەش
- **`.pro-card`** — کاردی یەکگرتوو: `rounded-xl border shadow-sm`
- **`.pro-card-body`** — ناوەڕۆکی کارد: `p-4 md:p-6`
- **`.pro-stat-card`** — کاردی ئاماری بچووک
- **`.pro-table-wrap`** — wrapperی تابلۆ بە border و overflow

---

## ٢. قاڵبی پەڕە

هەر پەڕەیەک دەتوانرێت بەم شێوەیە بێت:

```tsx
return (
  <DashboardLayout>
    <div className="pro-page space-y-6">
      <PageHeader
        icon={IconComponent}
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        variant="solid"
        actions={<Button>...</Button>}
      />

      {/* ناوەڕۆک: کارد، تابلۆ، تب، ... */}
      <Card className="pro-card">
        <CardContent className="pro-card-body">...</CardContent>
      </Card>
    </div>
  </DashboardLayout>
);
```

- **variant:** بۆ پەڕە گرنگەکان `gradient`، بۆ ئاسایی `solid` یان `muted`.
- پەڕەکانی داشبۆرد دەتوانن **stats** لە PageHeader بدەن (چەند کاردی ژمارە).

---

## ٣. داشبۆرد (Dashboard)

داشبۆرد ئێستا بە هەمان ستایلی پرۆفیشنال نوێکراوەتەوە:

- **PageHeader** بە `variant="gradient"` و ئایکۆنی `LayoutDashboard`، ناونیشان و ڕوونکردنەوە و دوگمەکانی ڕاپۆرت.
- **pro-page** بۆ wrapperی هەموو ناوەڕۆک؛ **pro-section** بۆ هەر بەشێک (پوخته‌ی دارایی، ئامار، گراف، چالاکی، دوگمە خێراکان، قەرز، باچەکان، باشترین کڕیارەکان).
- **pro-card** بۆ کاردەکانی گراف و لیست و **pro-card-body** بۆ ناوەڕۆکی کارد؛ **pro-stat-card** بۆ کاردە ئاماریەکانی FinancialCard و StatsCard.

بۆ **هەموو سیکشنەکانی تر** لە ئەپەکەدا هەمان ڕێسا بەکار بهێنە (خوارەوە).

---

## ٤. پەڕەکان کە ئێستا نوێکرانەوەن

- **داشبۆرد** (`Dashboard`) — PageHeader gradient + pro-page + pro-section + pro-card / pro-stat-card
- **بەڕێوەبردنی داتا** (`DataManagement`) — PageHeader + gradient + stats
- **کڕیارەکان** (`Customers`) — PageHeader solid + actions (Settings + Add)
- **ڕێکخستنەکان** (`Settings`) — PageHeader solid
- **Layout:** ناوەڕۆکی main ئێستا `max-w-[1600px] mx-auto` و پاشبنەمایەکی سووک `from-background to-muted/20` هەیە.

---

## ٥. لیستی جێبەجێکردن بۆ هەموو سیکشنەکان

بۆ **زۆر پرۆفیشناڵ کردن**ی هەر پەڕە/سیکشنێک:

| کردار | وەسف |
|--------|------|
| ١ | `PageHeader` لە سەرەوە بە ئایکۆن، title، subtitle، و ئەگەر پێویست actions |
| ٢ | ناوەڕۆکی پەڕە لەناو `div` بە `className="pro-page space-y-6"` |
| ٣ | هەر بەشێک (بلۆکی ناوەڕۆک) لەناو `DashboardSection` یان `section` بە `className="pro-section"` |
| ٤ | کاردەکان بە `className="pro-card"` و ناوەڕۆکیان بە `pro-card-body`؛ کاردی ئاماری بچووک بە `pro-stat-card` |
| ٥ | سەرەوەی کارد (CardHeader) بۆ یەکگرتوویی: `border-b bg-muted/30 pro-card-body py-4` یان ڕەنگی سووک وەک `bg-amber-50/50` |
| ٦ | دوگمە و لینکەکان هەمان کامپۆنێنتەکانی UI (Button, Badge) و نەخشەی ڕەنگەکانی سیستەم (primary, muted, destructive) |

دوای جێبەجێکردنی لە **هەموو سیکشنەکان** (پاکەت، باچ، دارایی، ڕاپۆرت، سکان، خزمەتگوزاریەکان، …)، دیمەن و یوئای ئەپ یەکگرتوو و زۆر پرۆفیشنال دەبێت.

---

## ٦. پەڕەکانی تر

بۆ **هەموو فەیسەکانی تر** (پاکەتەکان، باچەکان، دارایی، ڕاپۆرت، …):

1. **PageHeader** لە سەرەوەی پەڕە زیاد بکە: `import { PageHeader } from "@/components/layout/PageHeader";`
2. هەر **h1 + subtitle** یان **header block** یەک جۆر بسڕەوە و جێگەی **PageHeader** بکە.
3. **wrapper** ی پەڕەکە بکە بە `className="pro-page space-y-6"`.
4. کارد و بەشەکان دەتوانرێت بە `pro-card` و `pro-card-body` یان هەمان Card ی ئێستا بن، بەڵام **rounded-xl** و **shadow-sm** و **border** یەکگرتوو باشن.

ئەگەر پەڕەیەک **gradient header** ی تایبەتی هەیە (وەک پاکەتەکان)، دەتوانیت هەمان شت بە **PageHeader** و **className** بۆ gradient ئاسان بکەیتەوە:

```tsx
<PageHeader
  icon={Package}
  title={t("packages.title")}
  subtitle={t("packages.subtitle")}
  variant="gradient"
  className="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500"
/>
```

---

## ٧. کورتە

- **PageHeader** بۆ سەرەوەی یەکگرتوو و پرۆفیشنال.
- **pro-page** و **pro-card** و **pro-section** بۆ ڕیزبەند و شێوازی یەکگرتوو.
- **Layout:** ناوەڕۆک بە max-width و پاشبنەمای سووک.
دوای جێبەجێکردنی لە هەموو پەڕەکان، دیمەن زۆر پرۆفیشنال و یەکگرتوو دەبێت.
