export const productionNodes = [
  { plant: "Lagos Assembly", uptime: "92%", status: "Stable", signal: "+1.2%" },
  { plant: "Nairobi Plastics", uptime: "88%", status: "Watch", signal: "-3.4%" },
  { plant: "Accra Metals", uptime: "95%", status: "Optimal", signal: "+0.8%" },
];

export const aiInsights = [
  {
    title: "Order Spike",
    detail: "Tier-1 automotive client pulled Q2 demand forward by 11%.",
    impact: "Adjust Camber plant shifts",
    severity: "high" as const,
  },
  {
    title: "Supplier Delay",
    detail: "Copper cathode shipments at Tema port delayed 36 hours.",
    impact: "Trigger alternate rail route",
    severity: "medium" as const,
  },
  {
    title: "Cash Flow",
    detail: "Multi-tenant ledger sees +6% collections efficiency this week.",
    impact: "Release CapEx batch",
    severity: "low" as const,
  },
];

export const demandSectors = [
  { label: "AUTOMOTIVE", delta: "+14%", fill: "bg-teal-300", width: "80%" },
  { label: "FMCG", delta: "+7%", fill: "bg-indigo-300", width: "55%" },
  { label: "ENERGY", delta: "-3%", fill: "bg-rose-300", width: "30%" },
];

export const worklist = [
  {
    id: "SR-1042",
    title: "Confirm Lagos ABS pellets",
    due: "Due in 6h",
    priority: "High",
    action: "Issue ASN + docs",
  },
  {
    id: "SR-1038",
    title: "Respond to variance on cobalt batch",
    due: "Due tomorrow",
    priority: "Medium",
    action: "Attach assay + reconciliation",
  },
  {
    id: "SR-1034",
    title: "Dispute resolved credit memo",
    due: "Closed 4h ago",
    priority: "Low",
    action: "Archive in shared ledger",
  },
];

export const collaborationBursts = [
  {
    title: "Smart Quality Brief",
    detail: "SYS Copilot condensed 32-page spec into 4 bulletproof checkpoints",
    status: "Ready",
  },
  {
    title: "Greener Lane Initiative",
    detail: "Multi-tenant carbon ledger suggests rail lane swap saves 3.1 tons/week",
    status: "Draft",
  },
];

export const partnerSignals = [
  {
    partner: "Camber Motors",
    metric: "+11% demand pull",
    note: "Expect rush PO for instrument panels",
  },
  {
    partner: "Verdant FMCG",
    metric: "On-time score 98%",
    note: "Maintaining platinum tier",
  },
  {
    partner: "Helix Grid",
    metric: "Pending safety audit",
    note: "Upload revised SDS",
  },
];

export const tenantSummaries = [
  {
    slug: "tembea-steel",
    name: "Tembea Steel",
    region: "EMEA",
    status: "Live",
    ledger: "+₦420M",
    seats: 184,
  },
  {
    slug: "novafoods",
    name: "NovaFoods",
    region: "NA",
    status: "Live",
    ledger: "+₦210M",
    seats: 96,
  },
  {
    slug: "skyline-energy",
    name: "Skyline Energy",
    region: "APAC",
    status: "Pilot",
    ledger: "+₦52M",
    seats: 41,
  },
];

export const provisioningBacklog = [
  {
    id: "TEN-482",
    item: "Provision ESG copilot for Tembea",
    owner: "Adaora",
    state: "In flight",
  },
  {
    id: "TEN-479",
    item: "Map supplier mesh for Skyline",
    owner: "Noah",
    state: "Ready",
  },
  {
    id: "TEN-473",
    item: "Tenant data room cleanup",
    owner: "Ivy",
    state: "Review",
  },
];
