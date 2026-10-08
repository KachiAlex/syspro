import { randomUUID } from 'crypto';
import { getSql } from './db';

const sql = getSql();

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  action: string;
  target_table?: string | null;
  target_id?: string | null;
  diff?: Record<string, any> | null;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let auditTableEnsured = false;
async function ensureAuditTable(): Promise<void> {
  if (auditTableEnsured) return;
  auditTableEnsured = true;
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      actor_id uuid,
      action text NOT NULL,
      target_table text,
      target_id uuid,
      diff jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

/**
 * Write a platform-level audit row. `audit_logs.tenant_id` is NOT NULL and
 * refers to the *affected* tenant, so the tenant is resolved from `entity_id`
 * (when the entity is the tenant itself) or looked up by `slug`.
 * Never throws — audit logging must not block the operation it records.
 */
export async function logAuditAction(
  action: string,
  entityType: 'tenant' | 'license' | 'admin' | string,
  entityId: string,
  details?: Record<string, any>,
  slug?: string,
  ipAddress?: string,
  actorId?: string
): Promise<void> {
  try {
    await ensureAuditTable();

    let tenantId: string | null = null;
    const targetId = UUID_RE.test(entityId) ? entityId : null;
    if (entityType === 'tenant' && targetId) {
      tenantId = targetId;
    } else if (slug) {
      const rows = (await sql`SELECT id FROM tenants WHERE slug = ${slug} LIMIT 1`) as any[];
      tenantId = rows[0]?.id ?? null;
    } else if (targetId) {
      const rows = (await sql`SELECT id FROM tenants WHERE id = ${targetId} LIMIT 1`) as any[];
      tenantId = rows[0]?.id ?? null;
    }
    if (!tenantId) {
      console.error('Failed to log audit action: could not resolve tenant for', entityType, entityId);
      return;
    }

    await sql`
      INSERT INTO audit_logs (id, tenant_id, actor_id, action, target_table, target_id, diff, created_at)
      VALUES (
        ${randomUUID()},
        ${tenantId},
        ${actorId && UUID_RE.test(actorId) ? actorId : null},
        ${action},
        ${entityType},
        ${targetId},
        ${JSON.stringify({ ...(details || {}), ...(slug ? { slug } : {}), ...(ipAddress ? { ip: ipAddress } : {}) })},
        NOW()
      )
    `;
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging should not block operations
  }
}

export async function getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
  try {
    const logs = await sql`
      SELECT l.*, t.slug AS entity_slug
      FROM audit_logs l
      LEFT JOIN tenants t ON t.id = l.tenant_id
      ORDER BY l.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return logs;
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}
