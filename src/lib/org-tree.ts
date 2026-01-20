export type OrgNodeType = "tenant" | "subsidiary" | "region" | "country" | "branch" | "department" | "team";
export const ORG_NODE_TYPES: OrgNodeType[] = ["tenant", "subsidiary", "region", "country", "branch", "department", "team"];

export const ORG_NODE_STATUSES = ["Live", "Planning", "Paused"] as const;
export type OrgNodeStatus = (typeof ORG_NODE_STATUSES)[number];

export type OrgNode = {
  id: string;
  name: string;
  type: OrgNodeType;
  status: OrgNodeStatus;
  manager: string;
  region?: string;
  headcount?: number;
  modules?: string[];
  timezone?: string;
  metadata?: Record<string, string>;
  children?: OrgNode[];
};

export const FALLBACK_ORG_TREE: OrgNode = {
  id: "tenant-root",
  name: "Kreatix Holdings",
  type: "tenant",
  status: "Live",
  manager: "Elena Okwuobi",
  region: "Global",
  headcount: 18402,
  modules: ["HR", "Finance", "Projects", "ITSM"],
  children: [
    {
      id: "subs-energy",
      name: "Kreatix Energy",
      type: "subsidiary",
      status: "Live",
      manager: "Adeola Seyi",
      region: "Africa",
      headcount: 5400,
      modules: ["HR", "Finance", "Projects"],
      children: [
        {
          id: "region-west-africa",
          name: "West Africa Region",
          type: "region",
          status: "Live",
          manager: "Lola Bamidele",
          region: "West Africa",
          headcount: 2900,
          children: [
            {
              id: "country-ng",
              name: "Nigeria",
              type: "country",
              status: "Live",
              manager: "Osita Anyanwu",
              region: "Nigeria",
              headcount: 1800,
              children: [
                {
                  id: "branch-lagos",
                  name: "Lagos HQ",
                  type: "branch",
                  status: "Live",
                  manager: "Funmi Adebayo",
                  region: "Nigeria",
                  headcount: 900,
                  timezone: "GMT+1",
                  modules: ["HR", "Finance", "CRM"],
                  children: [
                    {
                      id: "dept-ops-lagos",
                      name: "Operations",
                      type: "department",
                      status: "Live",
                      manager: "Ngozi Peters",
                      headcount: 420,
                      children: [
                        {
                          id: "team-grid",
                          name: "Grid Reliability Squad",
                          type: "team",
                          status: "Live",
                          manager: "Ayo Salami",
                          headcount: 24,
                        },
                      ],
                    },
                    {
                      id: "dept-tech-lagos",
                      name: "Digital Systems",
                      type: "department",
                      status: "Live",
                      manager: "Tolani Esang",
                      headcount: 180,
                    },
                  ],
                },
                {
                  id: "branch-portharcourt",
                  name: "Port Harcourt Terminal",
                  type: "branch",
                  status: "Planning",
                  manager: "Victor Madu",
                  region: "Nigeria",
                  headcount: 110,
                },
              ],
            },
            {
              id: "country-gh",
              name: "Ghana",
              type: "country",
              status: "Live",
              manager: "Efua Mensah",
              region: "Ghana",
              headcount: 640,
              children: [
                {
                  id: "branch-accra",
                  name: "Accra Ops Hub",
                  type: "branch",
                  status: "Live",
                  manager: "Yaw Ankomah",
                  region: "Ghana",
                  headcount: 300,
                },
              ],
            },
          ],
        },
        {
          id: "region-east-africa",
          name: "East Africa Region",
          type: "region",
          status: "Live",
          manager: "Mwikali Cherono",
          region: "East Africa",
          headcount: 2100,
          children: [
            {
              id: "country-ke",
              name: "Kenya",
              type: "country",
              status: "Live",
              manager: "Achieng Ouma",
              headcount: 1200,
              children: [
                {
                  id: "branch-nairobi",
                  name: "Nairobi Innovation Campus",
                  type: "branch",
                  status: "Live",
                  manager: "Brian Kimani",
                  headcount: 620,
                  children: [
                    {
                      id: "dept-rnd-nairobi",
                      name: "R&D",
                      type: "department",
                      status: "Live",
                      manager: "Linet Waweru",
                      headcount: 210,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "subs-industrial",
      name: "Kreatix Industrial Systems",
      type: "subsidiary",
      status: "Live",
      manager: "Mateo Ruiz",
      region: "Europe",
      headcount: 4200,
      modules: ["Finance", "Projects", "CRM"],
      children: [
        {
          id: "region-dach",
          name: "DACH Region",
          type: "region",
          status: "Live",
          manager: "Clara Roth",
          headcount: 2300,
          children: [
            {
              id: "country-de",
              name: "Germany",
              type: "country",
              status: "Live",
              manager: "Felix Bauer",
              headcount: 1500,
              children: [
                {
                  id: "branch-frankfurt",
                  name: "Frankfurt Delivery Lab",
                  type: "branch",
                  status: "Live",
                  manager: "Julia Kruger",
                  headcount: 650,
                },
              ],
            },
          ],
        },
        {
          id: "region-nordics",
          name: "Nordics Region",
          type: "region",
          status: "Paused",
          manager: "Henrik Olssen",
          headcount: 640,
          children: [
            {
              id: "country-se",
              name: "Sweden",
              type: "country",
              status: "Paused",
              manager: "Astrid Nilsson",
              headcount: 310,
            },
          ],
        },
      ],
    },
  ],
};
