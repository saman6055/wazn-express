import { describe, it, expect } from "vitest";
import { 
  detectCarrier, 
  validateTrackingNumber, 
  generateVoiceResponse,
  PRODUCT_CATEGORIES,
  DAMAGE_LEVELS,
  CARRIER_PATTERNS
} from "./aiService";

describe("AI Service - Carrier Detection", () => {
  it("should detect SF Express tracking numbers", () => {
    const result = detectCarrier("SF1234567890123");
    expect(result).not.toBeNull();
    expect(result?.carrier).toBe("SF Express");
    expect(result?.country).toBe("China");
  });

  it("should detect YTO Express tracking numbers", () => {
    const result = detectCarrier("YT1234567890123456");
    expect(result).not.toBeNull();
    expect(result?.carrier).toBe("YTO Express");
    expect(result?.country).toBe("China");
  });

  it("should detect EMS tracking numbers", () => {
    const result = detectCarrier("EMS123456789CN");
    expect(result).not.toBeNull();
    expect(result?.carrier).toBe("EMS");
    expect(result?.country).toBe("International");
  });

  it("should detect UPS tracking numbers", () => {
    const result = detectCarrier("1Z12345E0205271688");
    expect(result).not.toBeNull();
    expect(result?.carrier).toBe("UPS");
    expect(result?.country).toBe("USA");
  });

  it("should return null for unknown tracking numbers", () => {
    const result = detectCarrier("UNKNOWN123");
    expect(result).toBeNull();
  });
});

describe("AI Service - Tracking Number Validation", () => {
  it("should validate known carrier formats", () => {
    const result = validateTrackingNumber("SF1234567890123");
    expect(result.valid).toBe(true);
    expect(result.carrier).toBe("SF Express");
  });

  it("should validate generic alphanumeric tracking numbers", () => {
    const result = validateTrackingNumber("ABC123DEF456");
    expect(result.valid).toBe(true);
    expect(result.format).toBe("Generic tracking format");
  });

  it("should reject invalid tracking numbers", () => {
    const result = validateTrackingNumber("AB");
    expect(result.valid).toBe(false);
  });

  it("should handle uppercase conversion", () => {
    const result = validateTrackingNumber("sf1234567890123");
    expect(result.valid).toBe(true);
    expect(result.carrier).toBe("SF Express");
  });
});

describe("AI Service - Voice Response Generation", () => {
  it("should generate Kurdish scan success response", () => {
    const response = generateVoiceResponse("scan_success", {
      customerName: "ئەحمەد",
      status: "گەیشتوو"
    }, "ku");
    expect(response).toContain("ئەحمەد");
    expect(response).toContain("گەیشتوو");
  });

  it("should generate English scan success response", () => {
    const response = generateVoiceResponse("scan_success", {
      customerName: "Ahmed",
      status: "arrived"
    }, "en");
    expect(response).toContain("Ahmed");
    expect(response).toContain("arrived");
  });

  it("should generate Arabic scan success response", () => {
    const response = generateVoiceResponse("scan_success", {
      customerName: "أحمد",
      status: "وصل"
    }, "ar");
    expect(response).toContain("أحمد");
  });

  it("should handle missing customer name", () => {
    const response = generateVoiceResponse("scan_success", {
      status: "arrived"
    }, "en");
    expect(response).toContain("customer");
  });

  it("should generate new package response", () => {
    const response = generateVoiceResponse("scan_new", {}, "ku");
    expect(response).toContain("نوێ");
  });

  it("should generate status changed response", () => {
    const response = generateVoiceResponse("status_changed", {
      newStatus: "delivered"
    }, "en");
    expect(response).toContain("delivered");
  });

  it("should generate error response", () => {
    const response = generateVoiceResponse("error", {}, "en");
    expect(response).toContain("error");
  });

  it("should generate registered response", () => {
    const response = generateVoiceResponse("registered", {}, "ku");
    expect(response).toContain("تۆمارکرا");
  });
});

describe("AI Service - Constants", () => {
  it("should have product categories defined", () => {
    expect(PRODUCT_CATEGORIES).toBeDefined();
    expect(PRODUCT_CATEGORIES.length).toBeGreaterThan(0);
    
    // Check structure
    const electronics = PRODUCT_CATEGORIES.find(c => c.id === "electronics");
    expect(electronics).toBeDefined();
    expect(electronics?.label).toBeDefined();
    expect(electronics?.labelEn).toBe("Electronics");
  });

  it("should have damage levels defined", () => {
    expect(DAMAGE_LEVELS).toBeDefined();
    expect(DAMAGE_LEVELS.length).toBe(3);
    
    const intact = DAMAGE_LEVELS.find(d => d.id === "intact");
    expect(intact).toBeDefined();
    expect(intact?.labelEn).toBe("Intact");
  });

  it("should have carrier patterns defined", () => {
    expect(CARRIER_PATTERNS).toBeDefined();
    expect(CARRIER_PATTERNS.length).toBeGreaterThan(0);
    
    // Check that patterns are valid RegExp
    CARRIER_PATTERNS.forEach(({ pattern }) => {
      expect(pattern).toBeInstanceOf(RegExp);
    });
  });
});

describe("AI Service - Edge Cases", () => {
  it("should handle empty tracking number", () => {
    const result = validateTrackingNumber("");
    expect(result.valid).toBe(false);
  });

  it("should handle whitespace in tracking number", () => {
    const result = validateTrackingNumber("  SF1234567890123  ");
    expect(result.valid).toBe(true);
    expect(result.carrier).toBe("SF Express");
  });

  it("should handle special characters", () => {
    const result = validateTrackingNumber("SF-1234-5678");
    expect(result.valid).toBe(false);
  });

  it("should handle unknown action in voice response", () => {
    const response = generateVoiceResponse("unknown_action", {}, "en");
    expect(response).toBe("");
  });
});
