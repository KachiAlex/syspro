export type IndustryType = "services" | "trading" | "manufacturing" | "mixed";

export interface IndustryProfile {
  key: IndustryType;
  label: string;
  description: string;
  modules: string[];
}

export const INDUSTRY_PROFILES: Record<IndustryType, IndustryProfile> = {
  services: {
    key: "services",
    label: "Services",
    description: "Consulting, professional services, agencies, and service-based businesses",
    modules: ["crm", "projects", "billing", "finance", "hr", "people"],
  },
  trading: {
    key: "trading",
    label: "Trading / Distribution",
    description: "Wholesale, retail, distribution, and import/export businesses",
    modules: ["inventory", "procurement", "vendors", "billing", "finance", "hr", "crm"],
  },
  manufacturing: {
    key: "manufacturing",
    label: "Manufacturing",
    description: "Production, assembly, and manufacturing operations",
    modules: [
      "inventory",
      "procurement",
      "vendors",
      "manufacturing",
      "billing",
      "finance",
      "hr",
      "crm",
    ],
  },
  mixed: {
    key: "mixed",
    label: "Mixed / Diversified",
    description: "Companies operating across multiple industries (services + trading + manufacturing)",
    modules: [
      "crm",
      "projects",
      "inventory",
      "procurement",
      "vendors",
      "manufacturing",
      "billing",
      "finance",
      "hr",
      "people",
    ],
  },
};

export const INDUSTRY_OPTIONS = Object.values(INDUSTRY_PROFILES);

export function getModulesForIndustries(industries: IndustryType[]): string[] {
  const moduleSet = new Set<string>();
  for (const industry of industries) {
    const profile = INDUSTRY_PROFILES[industry];
    if (profile) {
      for (const mod of profile.modules) {
        moduleSet.add(mod);
      }
    }
  }
  return Array.from(moduleSet);
}

export function isValidIndustry(value: string): value is IndustryType {
  return value in INDUSTRY_PROFILES;
}
