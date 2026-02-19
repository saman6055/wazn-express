# لیکۆڵینەوەی هەڵەی «شتیک هه له ی لیکه وته وه» / "Something went wrong" Investigation

## کورتە (Summary)

هەڵەکە لە **هەڵگرتنی هەموو ئەپەکە** دەبێت کاتێک **هەر یەک API (query)** دەشکێت: ڕێکخستنەکە وا دەکات هەر شکستێک **Error Boundary** بگرێت و پەڕەی هەڵە پیشان بدات. دوای **کەمێک کارکردن** زۆر پەڕە هەمان هەڵە دەنوێنن چونکە (١) دوای چەند خولەک session دەبێت ناڕەوا، یان (٢) پەیوەندی DB/سەرڤەر دەشکێت، یان (٣) سەرڤەر «خەو» دەکات (cold start) و داواکارییەکان دەشکێن.

---

## سەرچاوەی هەڵە (Root cause)

### ١. `throwOnError: true` لە React Query

لە `client/src/main.tsx`:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,  // هەر query یەک کە شکستی هەبێت، throw دەکات
      ...
    },
  },
});
```

- **ئەنجام:** هەر کات `trpc.xxx.useQuery()` شکست بکات (شبەکە، ٥٠٠، ٤٠١، timeout)، هەڵەکە **هەڵدەگیرێت لە Error Boundary**.
- **QueryErrorBoundary** هەموو ڕێگاکان دەگرێت؛ بۆیە **هەر پەڕەیەک** کە query‑ی شکست خواردوو هەبێت، پەڕەی «شتیک هه له ی لیکه وته وه» پیشان دەدات.

### ٢. بۆچی «دوای کەمێک» و «لە زۆر پەڕەدا»؟

| هۆکار | وەسف |
|--------|------|
| **Session / کوکی** | دوای چەند خولەک ناسنامە ناڕەوا دەبێت؛ API دەگەڕێتەوە 401. ئەگەر وەک 401 نەناسرێت، وەک هەڵەی گشتی پیشان دەدرێت. |
| **پەیوەندی DB** | MySQL connection دەڕوات (idle timeout، serverless، یان pool تەواو). داواکارییە دواترەکان دەشکێن. |
| **Cold start (سەرڤەر)** | لە هۆستینگی ئاسان (وەک Render/Heroku) سەرڤەر دەخەوێت؛ یەکەم کلیک باشە، دواتر timeout یان 503. |
| **شبەکە / نەتەوە** | کاتێک ئینتەرنێت لاوازە یان دەقەوت، هەموو query‑ەکان دەشکێن و هەموو پەڕە «هەڵە» دەنوێنن. |

### ٣. پەڕەی `/services/types` تایبەتە

- ئەم پەڕە `trpc.extraServices.getServiceTypes.useQuery()` بەکاردەهێنێت.
- ئەگەر ئەم API‑ە شکست بکات (شبەکە، 500، 401)، **هەر ئەم یەک query‑ە** دەتوانێت هەموو پەڕەکە بکاتە «Something went wrong» لەناو **QueryErrorBoundary**‑دا.

---

## چاکسازییە جێبەجێکراوەکان (Fixes applied)

### ١. نەهێشتنی شکستی یەک query بۆ هەموو ئەپ (Resilient default)

- **گۆڕان:** لە `main.tsx` **`throwOnError: false`** کراوە بۆ **queries** (تەنها بۆ default).
- **ئەنجام:** کاتێک API شکست دەکات، ئەپ **ناڕوخێت**؛ دەتوانین لە هەر پەڕەیەکدا **isError / error** بەکاربێنین و نامەی هەڵە و دووبارە هەوڵدان پیشان بدەین.

### ٢. مامەڵەکردنی هەڵە لە پەڕەی جۆرەکانی خزمەتگوزاری

- لە **ServiceTypesManagement** (`/services/types`):
  - **isError** و **error** و **refetch** لە `getServiceTypes.useQuery()` وەردەگیرێن.
  - ئەگەر **isError** بێت، بۆکسێکی هەڵە پیشان دەدرێت (ناونیشان + وەسف) و دوگمەی «دووبارە هەوڵ بدە» و «بگەڕێ بۆ سەرەکی».

بەم شێوەیە ئەم پەڕەیە تەنها **ناوخۆی خۆی** هەڵەکە پیشان دەدات، نەک هەموو ئەپەکە.

### ٣. ئەگەر پێت خۆشە هەڵە بە تەواوی «catch» بکرێت (QueryErrorBoundary)

- **QueryErrorBoundary** و **ErrorBoundary** هەر دووکیان ماون؛ ئەگەر لە شوێنێکدا **throw** بکرێت (وەک لە کۆدێکی قووڵ)، هێشتا ئەم boundary‑انە دەیناسنەوە و پەڕەی هەڵە پیشان دەدەن.
- **Auth (401):** لە `main.tsx` هێشتا `redirectToLoginIfUnauthorized` بە **query cache subscription** چالاکە؛ کاتێک هەڵەی 401 دەردەچێت، ڕێنوێنی بۆ لاپەڕەی login دەکرێت.

---

## پێناسەکانی تەکنیکی (Technical references)

| شوێن | ڕۆڵ |
|------|-----|
| `client/src/main.tsx` | `QueryClient` + `throwOnError` + `redirectToLoginIfUnauthorized` |
| `client/src/components/QueryErrorBoundary.tsx` | گرتنەوەی هەڵەکانی tRPC/React Query و پیشاندانی QueryErrorFallback |
| `client/src/components/ErrorBoundary.tsx` | گرتنەوەی هەڵەکانی React (render/commit) و پیشاندانی «Something went wrong» |
| `client/src/pages/ServiceTypesManagement.tsx` | مامەڵەکردنی **isError** و **refetch** بۆ `getServiceTypes` |

---

## ئەنجام (Conclusion)

- **کێشە:** `throwOnError: true` وەک default وای کرد هەر query‑یەکی شکست بخات **هەموو ئەپەکە** لە ناو یەک Error Boundary بگرێت و «شتیک هه له ی لیکه وته وه» لە زۆر پەڕەدا بەردەکەوێت.
- **چاکسازی:** (١) default‑ەکە گۆڕدرا بۆ **throwOnError: false**، (٢) پەڕەی `/services/types` مامەڵەی هەڵە و دووبارە هەوڵدانی ناوخۆیی پێدرا.
- **ئەنجامی چاوەڕوانکراو:** شکستی API‑یەک پەڕە تەنها لەو پەڕەیەدا هەڵە پیشان دەدات (و دووبارە هەوڵدانی پێدەکرێت)، نەک هەموو ئەپەکە؛ و 401 هێشتا ڕێنوێنی بۆ login دەکات.

ئەم ڕاپۆرتە و گۆڕانکارییەکان لە کۆدەکەدا جێبەجێکراون؛ دەتوانیت دووبارە دیپلۆی بکەیت و تاقی بکەیتەوە.
