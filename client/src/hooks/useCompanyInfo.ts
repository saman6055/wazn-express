import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

export interface CompanyInfo {
  name: string;
  nameKu: string;
  nameAr: string;
  address: string;
  addressKu: string;
  addressAr: string;
  phone: string;
  phone2: string;
  email: string;
  website: string;
  logoUrl: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: "Wazn Express",
  nameKu: "وازن ئێکسپرێس",
  nameAr: "وزن اكسبرس",
  address: "",
  addressKu: "",
  addressAr: "",
  phone: "",
  phone2: "",
  email: "",
  website: "",
  logoUrl: "",
};

export function useCompanyInfo(): CompanyInfo & { isLoading: boolean } {
  const { data: parsed, isLoading } = trpc.settings.getCompanyInfo.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    throwOnError: false, // Don't crash the app (e.g. staff-login) if settings API fails
  });

  const companyInfo = useMemo(() => {
    if (!parsed || typeof parsed !== "object") return DEFAULT_COMPANY;
    const p = parsed as Record<string, unknown>;
    return {
      name: (p.name as string) || DEFAULT_COMPANY.name,
      nameKu: (p.nameKu as string) || DEFAULT_COMPANY.nameKu,
      nameAr: (p.nameAr as string) || DEFAULT_COMPANY.nameAr,
      address: (p.address as string) || DEFAULT_COMPANY.address,
      addressKu: (p.addressKu as string) || DEFAULT_COMPANY.addressKu,
      addressAr: (p.addressAr as string) || DEFAULT_COMPANY.addressAr,
      phone: (p.phone as string) || DEFAULT_COMPANY.phone,
      phone2: (p.phone2 as string) || DEFAULT_COMPANY.phone2,
      email: (p.email as string) || DEFAULT_COMPANY.email,
      website: (p.website as string) || DEFAULT_COMPANY.website,
      logoUrl: (p.logoUrl as string) || DEFAULT_COMPANY.logoUrl,
    };
  }, [parsed]);

  return { ...companyInfo, isLoading };
}

export function getCompanyInfoFromSettings(settings: any[]): CompanyInfo {
  if (!settings || !Array.isArray(settings)) return DEFAULT_COMPANY;

  const companySetting = settings.find((s: any) => s.settingKey === "company_info");
  if (!companySetting?.settingValue) return DEFAULT_COMPANY;

  try {
    const parsed = JSON.parse(companySetting.settingValue);
    return {
      name: parsed.name || DEFAULT_COMPANY.name,
      nameKu: parsed.nameKu || DEFAULT_COMPANY.nameKu,
      nameAr: parsed.nameAr || DEFAULT_COMPANY.nameAr,
      address: parsed.address || DEFAULT_COMPANY.address,
      addressKu: parsed.addressKu || DEFAULT_COMPANY.addressKu,
      addressAr: parsed.addressAr || DEFAULT_COMPANY.addressAr,
      phone: parsed.phone || DEFAULT_COMPANY.phone,
      phone2: parsed.phone2 || DEFAULT_COMPANY.phone2,
      email: parsed.email || DEFAULT_COMPANY.email,
      website: parsed.website || DEFAULT_COMPANY.website,
      logoUrl: parsed.logoUrl || DEFAULT_COMPANY.logoUrl,
    };
  } catch {
    return DEFAULT_COMPANY;
  }
}

export { DEFAULT_COMPANY };
