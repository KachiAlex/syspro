import { sql as SQL } from "../sql-client";
import { GL_ACCOUNTS } from "./gl";

export interface ConsolidatedLine {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  net: number;
  byEntity: Array<{ tenantSlug: string; debit: number; credit: number; net: number }>;
}

export interface ConsolidatedTrialBalance {
  group: string;
  entities: string[];
  asOf: string;
  lines: ConsolidatedLine[];
  eliminations: { intercoReceivable: number; intercoPayable: number; eliminatedNet: number };
  totals: { debit: number; credit: number };
}

/**
 * Consolidated trial balance across all entities (tenants) in the same
 * consolidation_group. Balances on the intercompany accounts (1250/2150) are
 * reported separately as eliminations rather than folded into the group
 * position — in a fully-eliminated group they net to zero.
 */
export async function consolidatedTrialBalance(
  tenantSlug: string,
  opts: { asOf?: string } = {}
): Promise<ConsolidatedTrialBalance> {
  const sql = SQL;

  const self = (await sql`
    select consolidation_group from tenants where slug = ${tenantSlug}
  `) as any[];
  const group = self[0]?.consolidation_group ?? null;
  if (!group) {
    throw new Error(
      `Tenant ${tenantSlug} has no consolidation_group — set it on the tenant to enable group reporting`
    );
  }

  const members = (await sql`
    select slug from tenants where consolidation_group = ${group}
  `) as any[];
  const entities = members.map((m) => m.slug);
  if (entities.length === 0) throw new Error("No entities found in consolidation group");

  const asOf = opts.asOf ?? new Date().toISOString().split("T")[0];

  const rows = (await sql`
    select je.tenant_slug,
           coalesce(coa.code, coa.account_code, jel.account_code) as account_code,
           coalesce(coa.name, coa.account_name, jel.account_code) as account_name,
           coalesce(coa.type, coa.account_type, 'expense') as account_type,
           sum(coalesce(jel.debit, jel.debit_amount, 0)) as debit,
           sum(coalesce(jel.credit, jel.credit_amount, 0)) as credit
    from journal_entry_lines jel
    join journal_entries je on je.id = jel.journal_entry_id
    left join chart_of_accounts coa
      on coa.tenant_slug = je.tenant_slug
      and coalesce(coa.code, coa.account_code) = jel.account_code
    where je.tenant_slug = any(${entities})
      and coalesce(je.entry_date, je.posting_date, je.created_at::date) <= ${asOf}
      and (je.status is null or lower(je.status) = 'posted')
    group by je.tenant_slug, 2, 3, 4
    order by 2
  `) as any[];

  const byCode = new Map<string, ConsolidatedLine>();
  for (const r of rows) {
    const code = r.account_code;
    let line = byCode.get(code);
    if (!line) {
      line = {
        accountCode: code,
        accountName: r.account_name,
        accountType: r.account_type,
        debit: 0, credit: 0, net: 0,
        byEntity: [],
      };
      byCode.set(code, line);
    }
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    line.debit += debit;
    line.credit += credit;
    line.net += debit - credit;
    line.byEntity.push({ tenantSlug: r.tenant_slug, debit, credit, net: debit - credit });
  }

  const lines = [...byCode.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const intercoReceivable = byCode.get(GL_ACCOUNTS.INTERCO_RECEIVABLE)?.net ?? 0;
  const intercoPayable = -(byCode.get(GL_ACCOUNTS.INTERCO_PAYABLE)?.net ?? 0);
  const eliminatedNet = intercoReceivable - intercoPayable;

  return {
    group,
    entities,
    asOf,
    lines,
    eliminations: { intercoReceivable, intercoPayable, eliminatedNet },
    totals: {
      debit: Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100,
      credit: Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100,
    },
  };
}

export async function setConsolidationGroup(
  tenantSlug: string,
  group: string | null
): Promise<void> {
  const sql = SQL;
  await sql`
    update tenants set consolidation_group = ${group} where slug = ${tenantSlug}
  `;
}
