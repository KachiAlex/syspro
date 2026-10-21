import { sql as SQL } from "../sql-client";
import { randomUUID } from "node:crypto";

export interface PosConfig {
  /** Server-authoritative output VAT rate (%) applied to POS lines. */
  vatRate: number;
  /** Cash rounding step (e.g. 5 => round cash totals to the nearest ₦5). 0 = off. */
  cashRoundingStep: number;
  /** Card/terminal processor fee (%) charged on card tenders. */
  cardFeePct: number;
  /** Absolute variance (₦) above which a shift close is flagged. */
  varianceTolerance: number;
  loyalty: { enabled: boolean; earnDivisor: number; redeemValue: number };
}

const DEFAULTS: PosConfig = {
  vatRate: 0,
  cashRoundingStep: 0,
  cardFeePct: 0,
  varianceTolerance: 500,
  loyalty: { enabled: false, earnDivisor: 1000, redeemValue: 10 },
};

/** Tenant POS settings live in tenants.settings->'pos'. */
export async function getPosConfig(tenantSlug: string): Promise<PosConfig> {
  const sql = SQL;
  let raw: any = {};
  try {
    const rows = (await sql`
      select settings -> 'pos' as pos from tenants where slug = ${tenantSlug}
    `) as any[];
    raw = rows[0]?.pos ?? {};
  } catch {
    raw = {};
  }
  const cfg = { ...DEFAULTS, ...raw, loyalty: { ...DEFAULTS.loyalty, ...(raw?.loyalty ?? {}) } };

  // VAT resolution: tenant override wins; otherwise the active "output" VAT rate
  // from the tax configuration drives the till so cashiers can't sell VAT-free.
  if (!(cfg.vatRate > 0)) {
    try {
      const rates = (await sql`
        select rate from tax_rates
        where tenant_slug = ${tenantSlug} and tax_type = 'vat' and is_active
          and name ilike '%output%'
        order by created_at desc limit 1
      `) as any[];
      if (rates.length) cfg.vatRate = Number(rates[0].rate);
      else {
        const anyVat = (await sql`
          select rate from tax_rates
          where tenant_slug = ${tenantSlug} and tax_type = 'vat' and is_active
          order by created_at desc limit 1
        `) as any[];
        if (anyVat.length) cfg.vatRate = Number(anyVat[0].rate);
      }
    } catch {
      /* tax_rates may not exist yet */
    }
  }
  return cfg;
}

export async function logPosAudit(
  tenantSlug: string,
  entry: { action: string; actor?: string | null; entityType?: string; entityId?: string; detail?: Record<string, unknown> }
) {
  const sql = SQL;
  try {
    await sql`
      insert into pos_audit_log (id, tenant_slug, actor, action, entity_type, entity_id, detail, created_at)
      values (${`pa_${randomUUID().slice(0, 12)}`}, ${tenantSlug}, ${entry.actor ?? null}, ${entry.action},
              ${entry.entityType ?? null}, ${entry.entityId ?? null},
              ${entry.detail ? JSON.stringify(entry.detail) : null}, now())
    `;
  } catch {
    /* audit failures must not break the till */
  }
}
