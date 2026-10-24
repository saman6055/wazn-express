// ---------------------------------------------------------------------------
// Wazn Store — products from a spreadsheet
//
// The owner keeps the catalogue in Excel: one row per thing a till can scan.
// A bed sold in M, L and XL is three rows with three barcodes, joined by the
// same variant group. This turns the sheet's rows into products the server
// can save, and says which rows it could not read and why — row by row, in
// the sheet's own numbering, so the owner can find the line.
//
// Headers are matched loosely: "Barcode | بارکۆد", "barcode", "BARCODE" and
// "بارکۆد" are all the barcode column. Only the part before "|" counts when a
// header carries two languages, and the Kurdish names are accepted alone.
// ---------------------------------------------------------------------------

export type StoreImportStatus = "active" | "hidden" | "out_of_stock";

export interface StoreImportProduct {
  barcode: string | null;
  sku: string | null;
  nameKu: string | null;
  nameEn: string | null;
  nameAr: string | null;
  category: string | null;
  size: string | null;
  variantGroup: string | null;
  /** Null when the sheet has no price yet; the product is then saved hidden. */
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  stock: number | null;
  status: StoreImportStatus | null;
  descriptionKu: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  coverImageUrl: string | null;
  images: string[] | null;
  isFeatured: boolean | null;
  sortOrder: number | null;
}

export interface StoreImportProblem {
  /** The row number as Excel shows it (header is row 1). */
  row: number;
  message: { ku: string; en: string; ar: string; zh: string };
}

type Key = keyof StoreImportProduct;

/** Every header a column may carry, already normalised (see normaliseHeader). */
const HEADER_ALIASES: Record<Key, string[]> = {
  barcode: ["barcode", "ean", "بارکۆد", "باركود"],
  sku: ["sku", "code", "کۆد"],
  nameKu: ["nameku", "namekurdish", "ناو", "ناوکوردی", "ناویکوردی"],
  nameEn: ["nameen", "nameenglish", "name", "ناوئینگلیزی", "ناویئینگلیزی"],
  nameAr: ["namear", "namearabic", "ناوعەرەبی", "ناویعەرەبی", "الاسم"],
  category: ["category", "کەتەگۆری", "جۆر", "الفئة"],
  size: ["size", "قەبارە", "قیاس", "المقاس"],
  variantGroup: ["variantgroup", "group", "گروپ"],
  price: ["price", "نرخ", "السعر"],
  compareAtPrice: ["compareatprice", "oldprice", "نرخیپێشوو"],
  currency: ["currency", "دراو", "العملة"],
  stock: ["stock", "quantity", "qty", "ژمارە", "بڕ", "الكمية"],
  status: ["status", "دۆخ", "الحالة"],
  descriptionKu: ["descriptionku", "وەسف", "وەسفیکوردی", "وەسفکوردی"],
  descriptionEn: ["descriptionen", "description", "وەسفیئینگلیزی", "وەسفئینگلیزی"],
  descriptionAr: ["descriptionar", "وەسفیعەرەبی", "وەسفعەرەبی", "الوصف"],
  coverImageUrl: ["coverimageurl", "imageurl", "image", "وێنە"],
  images: ["images", "gallery", "وێنەکان"],
  isFeatured: ["isfeatured", "featured", "دیار"],
  sortOrder: ["sortorder", "order", "ڕیز"],
};

/** "Barcode | بارکۆد" -> "barcode"; spaces, dashes and case do not matter. */
export function normaliseHeader(header: string): string {
  const first = String(header ?? "").split("|")[0];
  return first
    .toLowerCase()
    .replace(/[\s_\-().:/\\]+/g, "")
    .replace(/[‌‍]/g, "")
    .trim();
}

const HEADER_TO_KEY: Map<string, Key> = (() => {
  const m = new Map<string, Key>();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [Key, string[]][]) {
    for (const a of aliases) m.set(a, key);
  }
  return m;
})();

export function headerKey(header: string): Key | null {
  return HEADER_TO_KEY.get(normaliseHeader(header)) ?? null;
}

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * A barcode as the sheet holds it. Excel turns a 13-digit code typed as a
 * number into 2.0900010003E+12, so a number is written back out in full.
 */
export function readBarcode(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v).toFixed(0);
  const s = text(v);
  return s ? s.replace(/\s+/g, "") : null;
}

/** "12,500", " 7.5 ", 7.5 -> numbers; anything else -> NaN. Blank -> null. */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = text(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  const s = text(v)?.toLowerCase();
  if (!s) return null;
  if (["1", "yes", "true", "y", "بەڵێ", "نعم"].includes(s)) return true;
  if (["0", "no", "false", "n", "نەخێر", "لا"].includes(s)) return false;
  return null;
}

function status(v: unknown): StoreImportStatus | null | "bad" {
  const s = text(v)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (s === "active" || s === "چالاک") return "active";
  if (s === "hidden" || s === "شاراوە") return "hidden";
  if (s === "out_of_stock" || s === "sold_out" || s === "نەماوە") return "out_of_stock";
  return "bad";
}

/** The GS1 check digit of the first 12 digits of an EAN-13. */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error("EAN-13 needs 12 digits before the check digit");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

const msg = (ku: string, en: string, ar: string, zh: string) => ({ ku, en, ar, zh });

/**
 * Rows as `XLSX.utils.sheet_to_json(sheet, { defval: "" })` gives them: one
 * object per row, keyed by the header text. Blank rows are skipped silently.
 */
export function rowsToStoreProducts(rows: Record<string, unknown>[]): {
  products: StoreImportProduct[];
  problems: StoreImportProblem[];
} {
  const products: StoreImportProduct[] = [];
  const problems: StoreImportProblem[] = [];
  const seenBarcodes = new Map<string, number>();

  rows.forEach((raw, index) => {
    const row = index + 2;
    const cell: Partial<Record<Key, unknown>> = {};
    for (const [header, value] of Object.entries(raw)) {
      const key = headerKey(header);
      if (key && cell[key] === undefined) cell[key] = value;
    }
    if (Object.values(cell).every((v) => text(v) === null)) return;

    const p: StoreImportProduct = {
      barcode: readBarcode(cell.barcode),
      sku: text(cell.sku),
      nameKu: text(cell.nameKu),
      nameEn: text(cell.nameEn),
      nameAr: text(cell.nameAr),
      category: text(cell.category),
      size: text(cell.size),
      variantGroup: text(cell.variantGroup),
      price: num(cell.price),
      compareAtPrice: num(cell.compareAtPrice),
      currency: text(cell.currency)?.toUpperCase() ?? null,
      stock: num(cell.stock),
      status: null,
      descriptionKu: text(cell.descriptionKu),
      descriptionEn: text(cell.descriptionEn),
      descriptionAr: text(cell.descriptionAr),
      coverImageUrl: text(cell.coverImageUrl),
      images: text(cell.images)?.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) ?? null,
      isFeatured: bool(cell.isFeatured),
      sortOrder: num(cell.sortOrder),
    };

    if (!p.nameKu && !p.nameEn && !p.nameAr) {
      problems.push({ row, message: msg("ناوی کاڵا نییە", "No product name", "لا يوجد اسم للمنتج", "缺少产品名称") });
      return;
    }
    for (const [k, label] of [["price", "price"], ["compareAtPrice", "compare-at price"], ["stock", "stock"], ["sortOrder", "sort order"]] as const) {
      const v = p[k];
      if (typeof v === "number" && (Number.isNaN(v) || v < 0)) {
        problems.push({ row, message: msg(`ژمارەکەی ${label} دروست نییە`, `The ${label} is not a valid number`, `قيمة ${label} غير صحيحة`, `${label} 不是有效数字`) });
        return;
      }
    }
    if (p.stock !== null) p.stock = Math.round(p.stock);
    if (p.sortOrder !== null) p.sortOrder = Math.round(p.sortOrder);
    const st = status(cell.status);
    if (st === "bad") {
      problems.push({ row, message: msg("دۆخەکە نەناسرا (active / hidden / out_of_stock)", "Unknown status (active / hidden / out_of_stock)", "حالة غير معروفة", "未知状态") });
      return;
    }
    p.status = st;
    if (p.barcode) {
      const first = seenBarcodes.get(p.barcode);
      if (first !== undefined) {
        problems.push({ row, message: msg(`هەمان بارکۆدی ڕیزی ${first}ە`, `Same barcode as row ${first}`, `نفس باركود السطر ${first}`, `与第 ${first} 行条码重复`) });
        return;
      }
      seenBarcodes.set(p.barcode, row);
    }
    products.push(p);
  });

  return { products, problems };
}
