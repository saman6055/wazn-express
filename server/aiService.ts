/**
 * AI Service for Smart Scanner
 * Provides OCR, Vision AI, and Voice processing capabilities
 */

import { invokeLLM } from "./_core/llm";

// Product categories for classification
export const PRODUCT_CATEGORIES = [
  { id: "electronics", label: "ئەلیکترۆنیک", labelEn: "Electronics", labelAr: "إلكترونيات", labelZh: "电子产品" },
  { id: "clothing", label: "جل و بەرگ", labelEn: "Clothing", labelAr: "ملابس", labelZh: "服装" },
  { id: "cosmetics", label: "کۆزمەتیک", labelEn: "Cosmetics", labelAr: "مستحضرات تجميل", labelZh: "化妆品" },
  { id: "food", label: "خواردەمەنی", labelEn: "Food & Beverages", labelAr: "طعام ومشروبات", labelZh: "食品饮料" },
  { id: "toys", label: "یاری منداڵان", labelEn: "Toys", labelAr: "ألعاب", labelZh: "玩具" },
  { id: "home", label: "کەرەستەی ماڵ", labelEn: "Home & Garden", labelAr: "منزل وحديقة", labelZh: "家居园艺" },
  { id: "tools", label: "ئامێر", labelEn: "Tools", labelAr: "أدوات", labelZh: "工具" },
  { id: "documents", label: "بەڵگەنامە", labelEn: "Documents", labelAr: "وثائق", labelZh: "文件" },
  { id: "medicine", label: "دەرمان", labelEn: "Medicine", labelAr: "أدوية", labelZh: "药品" },
  { id: "other", label: "هیتر", labelEn: "Other", labelAr: "أخرى", labelZh: "其他" },
];

// Damage levels
export const DAMAGE_LEVELS = [
  { id: "intact", label: "سەلامەت", labelEn: "Intact", labelAr: "سليم", labelZh: "完好" },
  { id: "minor", label: "زیانی کەم", labelEn: "Minor Damage", labelAr: "ضرر طفيف", labelZh: "轻微损坏" },
  { id: "damaged", label: "شکاو", labelEn: "Damaged", labelAr: "تالف", labelZh: "损坏" },
];

// Carrier patterns for detection
export const CARRIER_PATTERNS = [
  { pattern: /^SF\d{12,15}$/i, carrier: "SF Express", country: "China" },
  { pattern: /^YT\d{16,18}$/i, carrier: "YTO Express", country: "China" },
  { pattern: /^EMS\d{9}[A-Z]{2}$/i, carrier: "EMS", country: "International" },
  { pattern: /^\d{12}$/i, carrier: "DHL", country: "International" },
  { pattern: /^1Z[A-Z0-9]{16}$/i, carrier: "UPS", country: "USA" },
  { pattern: /^\d{20,22}$/i, carrier: "FedEx", country: "USA" },
  { pattern: /^JD\d{13,15}$/i, carrier: "JD Logistics", country: "China" },
  { pattern: /^ZTO\d{12,14}$/i, carrier: "ZTO Express", country: "China" },
  { pattern: /^STO\d{12,14}$/i, carrier: "STO Express", country: "China" },
  { pattern: /^YD\d{13,15}$/i, carrier: "Yunda Express", country: "China" },
];

/**
 * OCR Service - Extract text from images
 */
export async function performOCR(imageUrl: string): Promise<{
  success: boolean;
  text?: string;
  trackingNumbers?: string[];
  addresses?: Array<{
    text: string;
    language: string;
    translated?: string;
  }>;
  error?: string;
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an OCR specialist for package and shipping labels. Extract all text from the image, focusing on:
1. Tracking numbers (alphanumeric codes, usually 10-22 characters)
2. Addresses (recipient name, street, city, country)
3. Any Chinese text that needs translation

Return a JSON object with:
- text: all extracted text
- trackingNumbers: array of detected tracking numbers
- addresses: array of {text, language, translated} objects

Be thorough and accurate. If text is unclear, indicate uncertainty.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this shipping label image, especially tracking numbers and addresses:"
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ocr_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              text: { type: "string", description: "All extracted text" },
              trackingNumbers: {
                type: "array",
                items: { type: "string" },
                description: "Detected tracking numbers"
              },
              addresses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    language: { type: "string" },
                    translated: { type: "string" }
                  },
                  required: ["text", "language"],
                  additionalProperties: false
                },
                description: "Detected addresses with language"
              }
            },
            required: ["text", "trackingNumbers", "addresses"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return { success: false, error: "No response from OCR" };
    }

    const result = JSON.parse(content as string);
    return {
      success: true,
      text: result.text,
      trackingNumbers: result.trackingNumbers,
      addresses: result.addresses
    };
  } catch (error) {
    console.error("OCR Error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Vision AI Service - Analyze package images
 */
export async function analyzePackageImage(imageUrl: string): Promise<{
  success: boolean;
  category?: string;
  categoryConfidence?: number;
  damageLevel?: string;
  damageConfidence?: number;
  estimatedSize?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  description?: string;
  warnings?: string[];
  error?: string;
}> {
  try {
    const categoryList = PRODUCT_CATEGORIES.map(c => `${c.id}: ${c.labelEn}`).join(", ");
    const damageList = DAMAGE_LEVELS.map(d => `${d.id}: ${d.labelEn}`).join(", ");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a package inspection AI. Analyze the package image and determine:
1. Product category (one of: ${categoryList})
2. Damage level (one of: ${damageList})
3. Estimated dimensions in centimeters
4. Any warnings or concerns

Be accurate and conservative with damage assessment. If unsure, lean toward "intact".`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this package image for category, damage, and dimensions:"
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "package_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              category: { type: "string", description: "Product category ID" },
              categoryConfidence: { type: "number", description: "Confidence 0-100" },
              damageLevel: { type: "string", description: "Damage level ID" },
              damageConfidence: { type: "number", description: "Confidence 0-100" },
              estimatedLength: { type: "number", description: "Length in cm" },
              estimatedWidth: { type: "number", description: "Width in cm" },
              estimatedHeight: { type: "number", description: "Height in cm" },
              description: { type: "string", description: "Brief description" },
              warnings: {
                type: "array",
                items: { type: "string" },
                description: "Any warnings or concerns"
              }
            },
            required: ["category", "categoryConfidence", "damageLevel", "damageConfidence", "description", "warnings"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return { success: false, error: "No response from Vision AI" };
    }

    const result = JSON.parse(content as string);
    return {
      success: true,
      category: result.category,
      categoryConfidence: result.categoryConfidence,
      damageLevel: result.damageLevel,
      damageConfidence: result.damageConfidence,
      estimatedSize: result.estimatedLength ? {
        length: result.estimatedLength,
        width: result.estimatedWidth || 0,
        height: result.estimatedHeight || 0,
        unit: "cm"
      } : undefined,
      description: result.description,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Vision AI Error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Translate Chinese text to Kurdish/Arabic/English
 */
export async function translateText(
  text: string,
  targetLanguage: "ku" | "ar" | "en" = "ku"
): Promise<{
  success: boolean;
  translated?: string;
  error?: string;
}> {
  try {
    const languageNames: Record<string, string> = {
      ku: "Kurdish (Sorani)",
      ar: "Arabic",
      en: "English"
    };

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in shipping and logistics terminology. Translate the given text to ${languageNames[targetLanguage]}. Maintain accuracy for addresses, names, and technical terms.`
        },
        {
          role: "user",
          content: `Translate this text to ${languageNames[targetLanguage]}:\n\n${text}`
        }
      ]
    });

    const translated = response.choices[0]?.message?.content;
    if (!translated || typeof translated !== 'string') {
      return { success: false, error: "No translation response" };
    }

    return { success: true, translated: translated as string };
  } catch (error) {
    console.error("Translation Error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Detect carrier from tracking number
 */
export function detectCarrier(trackingNumber: string): {
  carrier: string;
  country: string;
} | null {
  for (const { pattern, carrier, country } of CARRIER_PATTERNS) {
    if (pattern.test(trackingNumber)) {
      return { carrier, country };
    }
  }
  return null;
}

/**
 * Validate tracking number format
 */
export function validateTrackingNumber(trackingNumber: string): {
  valid: boolean;
  carrier?: string;
  format?: string;
} {
  const cleaned = trackingNumber.trim().toUpperCase();
  
  // Check against known patterns
  const carrierInfo = detectCarrier(cleaned);
  if (carrierInfo) {
    return {
      valid: true,
      carrier: carrierInfo.carrier,
      format: "Known carrier format"
    };
  }

  // Generic validation - alphanumeric, 8-30 characters
  if (/^[A-Z0-9]{8,30}$/.test(cleaned)) {
    return {
      valid: true,
      format: "Generic tracking format"
    };
  }

  return { valid: false };
}

/**
 * AI-powered package info extraction
 */
export async function extractPackageInfo(imageUrl: string): Promise<{
  success: boolean;
  trackingNumber?: string;
  carrier?: string;
  recipientName?: string;
  recipientAddress?: string;
  recipientPhone?: string;
  senderName?: string;
  senderAddress?: string;
  weight?: number;
  dimensions?: { l: number; w: number; h: number };
  productDescription?: string;
  category?: string;
  damageLevel?: string;
  confidence?: number;
  rawText?: string;
  error?: string;
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert at reading shipping labels and package information. Extract all relevant details from the image including:
- Tracking number
- Carrier/shipping company
- Recipient details (name, address, phone)
- Sender details
- Weight and dimensions if visible
- Product description
- Package condition

For Chinese text, provide both original and English translation.
Be thorough and accurate. Return structured JSON.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all shipping and package information from this image:"
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "package_info",
          strict: true,
          schema: {
            type: "object",
            properties: {
              trackingNumber: { type: "string" },
              carrier: { type: "string" },
              recipientName: { type: "string" },
              recipientAddress: { type: "string" },
              recipientPhone: { type: "string" },
              senderName: { type: "string" },
              senderAddress: { type: "string" },
              weight: { type: "number" },
              length: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              productDescription: { type: "string" },
              category: { type: "string" },
              damageLevel: { type: "string" },
              confidence: { type: "number" },
              rawText: { type: "string" }
            },
            required: ["trackingNumber", "confidence", "rawText"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return { success: false, error: "No response from AI" };
    }

    const result = JSON.parse(content as string);
    return {
      success: true,
      trackingNumber: result.trackingNumber || undefined,
      carrier: result.carrier || detectCarrier(result.trackingNumber || "")?.carrier,
      recipientName: result.recipientName || undefined,
      recipientAddress: result.recipientAddress || undefined,
      recipientPhone: result.recipientPhone || undefined,
      senderName: result.senderName || undefined,
      senderAddress: result.senderAddress || undefined,
      weight: result.weight || undefined,
      dimensions: result.length ? {
        l: result.length,
        w: result.width || 0,
        h: result.height || 0
      } : undefined,
      productDescription: result.productDescription || undefined,
      category: result.category || undefined,
      damageLevel: result.damageLevel || "intact",
      confidence: result.confidence || 0,
      rawText: result.rawText || undefined
    };
  } catch (error) {
    console.error("Package Info Extraction Error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Generate voice response text
 */
export function generateVoiceResponse(
  action: string,
  data: Record<string, any>,
  language: "ku" | "ar" | "en" = "ku"
): string {
  const responses: Record<string, Record<string, string>> = {
    scan_success: {
      ku: `پاکەت دۆزرایەوە بۆ ${data.customerName || "کڕیار"}. دۆخ: ${data.status || "نەزانراو"}`,
      ar: `تم العثور على الطرد للعميل ${data.customerName || "العميل"}. الحالة: ${data.status || "غير معروف"}`,
      en: `Package found for ${data.customerName || "customer"}. Status: ${data.status || "unknown"}`
    },
    scan_new: {
      ku: "پاکەتی نوێ. تکایە زانیاری پڕ بکەوە",
      ar: "طرد جديد. يرجى ملء المعلومات",
      en: "New package. Please fill in the information"
    },
    status_changed: {
      ku: `دۆخ گۆڕدرا بۆ ${data.newStatus || "نوێ"}`,
      ar: `تم تغيير الحالة إلى ${data.newStatus || "جديد"}`,
      en: `Status changed to ${data.newStatus || "new"}`
    },
    error: {
      ku: "هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەوە",
      ar: "حدث خطأ. يرجى المحاولة مرة أخرى",
      en: "An error occurred. Please try again"
    },
    registered: {
      ku: "پاکەت بە سەرکەوتوویی تۆمارکرا",
      ar: "تم تسجيل الطرد بنجاح",
      en: "Package registered successfully"
    }
  };

  return responses[action]?.[language] || responses[action]?.["en"] || "";
}

/**
 * Enhanced Package Label Scanner
 * Specifically designed for Chinese shipping labels (ZTO, SF, YTO, etc.)
 * Extracts customer code (AZ###), tracking number, and product info
 */
export async function scanPackageLabel(imageUrl: string): Promise<{
  success: boolean;
  // Customer identification
  customerCode?: string; // AZ### format
  customerName?: string;
  customerPhone?: string;
  // Tracking info
  trackingNumber?: string;
  secondaryTrackingNumber?: string;
  carrier?: string;
  carrierLogo?: string;
  // Package details
  productDescription?: string;
  productDescriptionTranslated?: string;
  quantity?: number;
  // Addresses
  senderAddress?: string;
  senderPhone?: string;
  receiverAddress?: string;
  receiverPhone?: string;
  // Metadata
  labelDate?: string;
  routeCode?: string;
  warehouseCode?: string;
  confidence?: number;
  rawText?: string;
  error?: string;
}> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an expert at reading Chinese shipping labels, specifically from carriers like ZTO (中通), SF Express (顺丰), YTO (圆通), STO (申通), and Yunda (韵达).

Your task is to extract ALL information from the shipping label image with high accuracy.

Pay special attention to:
1. **Customer Code**: Look for ANY alphanumeric code that appears to be a customer identifier. Common patterns include:
   - Letter(s) + numbers: AZ006, DL001, KH123, WZ001, etc.
   - Just letters + numbers: ABC123, XY99, etc.
   - The code is usually followed by a customer name (e.g., "AZ006 dlkhwaz", "DL001 Ahmad")
   - Look in the receiver address section for codes like "wazn az006" or similar
2. **Tracking Number**: The main barcode number, usually 12-18 digits (e.g., "785427499278897")
3. **Secondary Tracking**: Privacy number (隐私号码) if present
4. **Product Description**: Usually in Chinese, describes the contents (e.g., "中长C皮57，黑色.L" means "Medium-long C leather 57, black, size L")
5. **Quantity**: Look for 总计 (total) or 件 (pieces)
6. **Route Code**: Like "101-P9 F4" or similar routing information
7. **Sender/Receiver Info**: Names, addresses, phone numbers

For Chinese text, provide both original and English translation.
Be thorough - every piece of information matters for logistics.

IMPORTANT: Customer codes can be ANY format - not just AZ. Look for patterns like:
- AZ006, DL001, KH123, WZ001, ABC99
- Codes are usually 2-4 letters followed by 1-4 numbers
- They appear in the receiver address section, often with "wazn" nearby
- Extract the code AND any name that follows it`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all shipping information from this Chinese package label. Focus on finding the AZ customer code, tracking number, and product description:"
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "package_label_scan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              customerCode: { 
                type: "string", 
                description: "Wazn customer code - any alphanumeric pattern like AZ006, DL001, KH123, WZ001, etc." 
              },
              customerName: { 
                type: "string", 
                description: "Customer name found near the AZ code" 
              },
              customerPhone: { 
                type: "string", 
                description: "Customer phone number if visible" 
              },
              trackingNumber: { 
                type: "string", 
                description: "Main tracking/barcode number" 
              },
              secondaryTrackingNumber: { 
                type: "string", 
                description: "Privacy number (隐私号码) if present" 
              },
              carrier: { 
                type: "string", 
                description: "Shipping carrier name (ZTO, SF, YTO, etc.)" 
              },
              productDescription: { 
                type: "string", 
                description: "Original Chinese product description" 
              },
              productDescriptionTranslated: { 
                type: "string", 
                description: "English translation of product description" 
              },
              quantity: { 
                type: "number", 
                description: "Number of items/pieces" 
              },
              senderAddress: { 
                type: "string", 
                description: "Sender full address" 
              },
              senderPhone: { 
                type: "string", 
                description: "Sender phone number" 
              },
              receiverAddress: { 
                type: "string", 
                description: "Receiver full address" 
              },
              receiverPhone: { 
                type: "string", 
                description: "Receiver phone number" 
              },
              labelDate: { 
                type: "string", 
                description: "Date on the label" 
              },
              routeCode: { 
                type: "string", 
                description: "Route/sorting code (e.g., 101-P9 F4)" 
              },
              warehouseCode: { 
                type: "string", 
                description: "Warehouse or destination code" 
              },
              confidence: { 
                type: "number", 
                description: "Overall confidence score 0-100" 
              },
              rawText: { 
                type: "string", 
                description: "All text found on the label" 
              }
            },
            required: ["trackingNumber", "confidence", "rawText"],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return { success: false, error: "No response from AI" };
    }

    const result = JSON.parse(content as string);
    
    // Normalize customer code to uppercase AZ format
    let normalizedCustomerCode = result.customerCode;
    if (normalizedCustomerCode) {
      // Extract just the AZ### part
      const azMatch = normalizedCustomerCode.match(/[Aa][Zz]\d{3,4}/i);
      if (azMatch) {
        normalizedCustomerCode = azMatch[0].toUpperCase();
      }
    }

    // Detect carrier from logo/text if not already identified
    let carrier = result.carrier;
    if (!carrier && result.rawText) {
      const rawLower = result.rawText.toLowerCase();
      if (rawLower.includes('中通') || rawLower.includes('zto')) carrier = 'ZTO Express';
      else if (rawLower.includes('顺丰') || rawLower.includes('sf')) carrier = 'SF Express';
      else if (rawLower.includes('圆通') || rawLower.includes('yto')) carrier = 'YTO Express';
      else if (rawLower.includes('申通') || rawLower.includes('sto')) carrier = 'STO Express';
      else if (rawLower.includes('韵达') || rawLower.includes('yunda')) carrier = 'Yunda Express';
      else if (rawLower.includes('京东') || rawLower.includes('jd')) carrier = 'JD Logistics';
    }

    return {
      success: true,
      customerCode: normalizedCustomerCode || undefined,
      customerName: result.customerName || undefined,
      customerPhone: result.customerPhone || undefined,
      trackingNumber: result.trackingNumber || undefined,
      secondaryTrackingNumber: result.secondaryTrackingNumber || undefined,
      carrier: carrier || undefined,
      productDescription: result.productDescription || undefined,
      productDescriptionTranslated: result.productDescriptionTranslated || undefined,
      quantity: result.quantity || 1,
      senderAddress: result.senderAddress || undefined,
      senderPhone: result.senderPhone || undefined,
      receiverAddress: result.receiverAddress || undefined,
      receiverPhone: result.receiverPhone || undefined,
      labelDate: result.labelDate || undefined,
      routeCode: result.routeCode || undefined,
      warehouseCode: result.warehouseCode || undefined,
      confidence: result.confidence || 0,
      rawText: result.rawText || undefined
    };
  } catch (error) {
    console.error("Package Label Scan Error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Extract customer code from any text
 * Looks for AZ### pattern
 */
export function extractCustomerCode(text: string): string | null {
  const match = text.match(/[Aa][Zz]\d{3,4}/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Parse product description from Chinese
 */
export function parseProductDescription(description: string): {
  type?: string;
  color?: string;
  size?: string;
  material?: string;
  quantity?: number;
} {
  const result: any = {};
  
  // Common Chinese color patterns
  const colorMap: Record<string, string> = {
    '黑色': 'Black', '白色': 'White', '红色': 'Red', '蓝色': 'Blue',
    '绿色': 'Green', '黄色': 'Yellow', '粉色': 'Pink', '灰色': 'Gray',
    '棕色': 'Brown', '紫色': 'Purple', '橙色': 'Orange'
  };
  
  // Size patterns
  const sizeMatch = description.match(/[XSML]{1,3}|\d{2,3}码?/i);
  if (sizeMatch) result.size = sizeMatch[0];
  
  // Color detection
  for (const [cn, en] of Object.entries(colorMap)) {
    if (description.includes(cn)) {
      result.color = en;
      break;
    }
  }
  
  // Quantity
  const qtyMatch = description.match(/(\d+)件/);
  if (qtyMatch) result.quantity = parseInt(qtyMatch[1]);
  
  return result;
}
