import { randomUUID } from "node:crypto";

import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { ensureFinanceTables } from "@/lib/finance/db";
import type { FinanceFilters } from "@/lib/finance/types";
import { FINANCE_TIMEFRAMES } from "@/lib/finance/types";


const BASELINE_ACCOUNTS = [
  { name: "Zenith Treasury", type: "bank" as const, balance: 312_400_000, changeValue: 8_200_000, changePeriod: "last week", trend: "up" as const },
  { name: "Ecobank Ops", type: "bank" as const, balance: 148_000_000, changeValue: -3_600_000, changePeriod: "last week", trend: "down" as const },
  { name: "Cash-in-Transit", type: "cash" as const, balance: 42_600_000, changeValue: 1_400_000, changePeriod: "last week", trend: "up" as const },
];

const BASELINE_RECEIVABLES = [
  { entity: "Nova Retail", amount: 48_200_000, dueInDays: 2, status: "due_soon" as const },
  { entity: "Helix Grid", amount: 32_700_000, dueInDays: 0, status: "current" as const },
  { entity: "Tembea Steel", amount: 64_300_000, dueInDays: -3, status: "overdue" as const },
  { entity: "Verdant FMCG", amount: 21_900_000, dueInDays: 5, status: "current" as const },
];

const BASELINE_PAYABLES = [
  { entity: "Apex Suppliers", amount: 38_600_000, dueInDays: 0, status: "current" as const },
  { entity: "Atlas Metals", amount: 19_400_000, dueInDays: 1, status: "due_soon" as const },
  { entity: "Lagos Assembly", amount: 54_800_000, dueInDays: -5, status: "overdue" as const },
  { entity: "Carbon Freight", amount: 27_200_000, dueInDays: 4, status: "current" as const },
];

const BASELINE_EXPENSES = [
  { label: "Cloud infrastructure", amount: 48_200_000, deltaPercent: 6.4, direction: "up" as const },
  { label: "Logistics + freight", amount: 34_600_000, deltaPercent: -2.1, direction: "down" as const },
  { label: "Payroll", amount: 128_900_000, deltaPercent: 1.2, direction: "up" as const },
  { label: "Vendors & services", amount: 26_400_000, deltaPercent: -3.8, direction: "down" as const },
];

const TREND_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TREND_REVENUE = [42, 48, 51, 47, 55, 39, 36].map((value) => value * 1_000_000);
const TREND_EXPENSES = [31, 33, 36, 34, 37, 29, 28].map((value) => value * 1_000_000);

export async function ensureFinanceSeedForTenant(filters: FinanceFilters) {
  const sql = SQL;
  await ensureFinanceTables(sql);

  const tenantSlug = filters.tenantSlug;
  const existing = (await sql<{ count: number }>`
    select count(1)::int as count from finance_accounts where tenant_slug = ${tenantSlug}
  `)[0];

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  await seedAccounts(sql, tenantSlug);
  await seedSchedules(sql, tenantSlug, "receivable", BASELINE_RECEIVABLES);
  await seedSchedules(sql, tenantSlug, "payable", BASELINE_PAYABLES);
  await seedExpenses(sql, tenantSlug);
  await seedTrendPoints(sql, tenantSlug);
}

async function seedAccounts(sql: SqlClient, tenantSlug: string) {
  for (const account of BASELINE_ACCOUNTS) {
    await sql`
      insert into finance_accounts (
        id, tenant_slug, name, type, currency, balance, change_value, change_period, trend
      ) values (
        ${randomUUID()}, ${tenantSlug}, ${account.name}, ${account.type}, ${"₦"}, ${account.balance}, ${account.changeValue},
        ${account.changePeriod}, ${account.trend}
      )
    `;
  }
}

async function seedSchedules(
  sql: SqlClient,
  tenantSlug: string,
  documentType: "receivable" | "payable",
  data: Array<{ entity: string; amount: number; dueInDays: number; status: "current" | "due_soon" | "overdue" }>
) {
  for (const item of data) {
    await sql`
      insert into finance_schedules (
        id, tenant_slug, entity_name, amount, currency, due_date, status, document_type
      ) values (
        ${randomUUID()},
        ${tenantSlug},
        ${item.entity},
        ${item.amount},
        ${"₦"},
        ${dateFromOffset(item.dueInDays)},
        ${item.status},
        ${documentType}
      )
    `;
  }
}

async function seedExpenses(sql: SqlClient, tenantSlug: string) {
  for (const category of BASELINE_EXPENSES) {
    await sql`
      insert into finance_expense_categories (
        id, tenant_slug, label, amount, delta_percent, direction
      ) values (
        ${randomUUID()},
        ${tenantSlug},
        ${category.label},
        ${category.amount},
        ${category.deltaPercent},
        ${category.direction}
      )
    `;
  }
}

async function seedTrendPoints(sql: SqlClient, tenantSlug: string) {
  for (const timeframe of FINANCE_TIMEFRAMES) {
    for (let index = 0; index < TREND_LABELS.length; index += 1) {
      await sql`
        insert into finance_trend_points (
          id, tenant_slug, timeframe, label, revenue, expenses
        ) values (
          ${randomUUID()},
          ${tenantSlug},
          ${timeframe},
          ${TREND_LABELS[index]},
          ${TREND_REVENUE[index]},
          ${TREND_EXPENSES[index]}
        )
      `;
    }
  }
}

function dateFromOffset(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
