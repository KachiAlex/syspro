import { COUNTRIES } from "@/lib/reference-data";

export type BankEntry = {
  name: string;
  // Provider bank code (Paystack numbering for NG) used for account-name
  // resolution. Undefined means the bank can be saved but not resolved.
  code?: string;
};

const NG_BANKS: BankEntry[] = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Globus Bank", code: "00103" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Lotus Bank", code: "303" },
  { name: "Moniepoint Microfinance Bank", code: "50515" },
  { name: "OPay Digital Services", code: "999992" },
  { name: "Optimus Bank", code: "107" },
  { name: "PalmPay", code: "999991" },
  { name: "Parallex Bank", code: "104" },
  { name: "Polaris Bank", code: "076" },
  { name: "PremiumTrust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "Signature Bank", code: "106" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "TAJ Bank", code: "676" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "VFD Microfinance Bank", code: "566" },
  { name: "Wema Bank", code: "035" },
  { name: "Zenith Bank", code: "057" },
];

export const BANKS_BY_COUNTRY: Record<string, BankEntry[]> = {
  NG: NG_BANKS,
  GH: [
    { name: "Absa Bank Ghana" }, { name: "Access Bank Ghana" },
    { name: "Agricultural Development Bank" }, { name: "CalBank" },
    { name: "Consolidated Bank Ghana" }, { name: "Ecobank Ghana" },
    { name: "Fidelity Bank Ghana" }, { name: "First National Bank Ghana" },
    { name: "GCB Bank" }, { name: "Guaranty Trust Bank Ghana" },
    { name: "National Investment Bank" }, { name: "Stanbic Bank Ghana" },
    { name: "Standard Chartered Ghana" }, { name: "United Bank for Africa Ghana" },
    { name: "Zenith Bank Ghana" },
  ],
  KE: [
    { name: "Absa Bank Kenya" }, { name: "African Banking Corporation" },
    { name: "Bank of Africa Kenya" }, { name: "Co-operative Bank of Kenya" },
    { name: "Diamond Trust Bank" }, { name: "Equity Bank" },
    { name: "Family Bank" }, { name: "I&M Bank" },
    { name: "KCB Bank" }, { name: "NCBA Bank" },
    { name: "Stanbic Bank Kenya" }, { name: "Standard Chartered Kenya" },
  ],
  ZA: [
    { name: "ABSA Bank" }, { name: "African Bank" },
    { name: "Capitec Bank" }, { name: "Discovery Bank" },
    { name: "First National Bank (FNB)" }, { name: "Investec" },
    { name: "Nedbank" }, { name: "Standard Bank" }, { name: "TymeBank" },
  ],
  UG: [
    { name: "Absa Bank Uganda" }, { name: "Centenary Bank" },
    { name: "DFCU Bank" }, { name: "Equity Bank Uganda" },
    { name: "Stanbic Bank Uganda" }, { name: "Standard Chartered Uganda" },
  ],
  TZ: [
    { name: "CRDB Bank" }, { name: "NMB Bank" },
    { name: "NBC Bank" }, { name: "Stanbic Bank Tanzania" },
    { name: "Standard Chartered Tanzania" },
  ],
  RW: [
    { name: "Bank of Kigali" }, { name: "Equity Bank Rwanda" },
    { name: "I&M Bank Rwanda" }, { name: "KCB Bank Rwanda" },
  ],
  ZM: [
    { name: "Absa Bank Zambia" }, { name: "First National Bank Zambia" },
    { name: "Stanbic Bank Zambia" }, { name: "Standard Chartered Zambia" },
    { name: "Zanaco" },
  ],
  CM: [
    { name: "Afriland First Bank" }, { name: "Ecobank Cameroun" },
    { name: "Société Générale Cameroun" }, { name: "UBA Cameroon" },
  ],
  US: [
    { name: "Bank of America" }, { name: "Capital One" },
    { name: "Chase Bank" }, { name: "Citibank" },
    { name: "PNC Bank" }, { name: "TD Bank" },
    { name: "Truist" }, { name: "U.S. Bank" }, { name: "Wells Fargo" },
  ],
  GB: [
    { name: "Barclays" }, { name: "HSBC UK" },
    { name: "Lloyds Bank" }, { name: "Monzo" },
    { name: "Nationwide" }, { name: "NatWest" },
    { name: "Revolut" }, { name: "Santander UK" },
    { name: "Standard Chartered" }, { name: "Starling Bank" },
  ],
  CA: [
    { name: "BMO" }, { name: "CIBC" },
    { name: "National Bank of Canada" }, { name: "RBC Royal Bank" },
    { name: "Scotiabank" }, { name: "Simplii Financial" },
    { name: "Tangerine" }, { name: "TD Bank" },
  ],
  AE: [
    { name: "Abu Dhabi Commercial Bank" }, { name: "Abu Dhabi Islamic Bank" },
    { name: "Commercial Bank of Dubai" }, { name: "Dubai Islamic Bank" },
    { name: "Emirates NBD" }, { name: "First Abu Dhabi Bank" },
    { name: "Mashreq" }, { name: "RAKBANK" },
  ],
  IN: [
    { name: "Axis Bank" }, { name: "Bank of Baroda" },
    { name: "Canara Bank" }, { name: "HDFC Bank" },
    { name: "ICICI Bank" }, { name: "Kotak Mahindra Bank" },
    { name: "Punjab National Bank" }, { name: "State Bank of India" },
  ],
  DE: [
    { name: "Commerzbank" }, { name: "Deutsche Bank" },
    { name: "DZ Bank" }, { name: "HypoVereinsbank (UniCredit)" },
    { name: "ING Germany" }, { name: "N26" },
  ],
  FR: [
    { name: "BNP Paribas" }, { name: "BPCE" },
    { name: "CIC" }, { name: "Crédit Agricole" },
    { name: "La Banque Postale" }, { name: "Société Générale" },
  ],
};

export function getBanksForCountry(countryCode: string): BankEntry[] {
  return BANKS_BY_COUNTRY[countryCode.toUpperCase()] ?? [];
}

/** Normalize a stored country value ("Nigeria", "NG", "ng") to ISO alpha-2. */
export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const match = COUNTRIES.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  return match?.code ?? null;
}
