import { getSql } from './db';

const sql = getSql();

export interface AuditLog {
  id: string;
  action: 'delete' | 'suspend' | 'activate' | 'create';
  entity_type: 'tenant' | 'license' | 'admin';
  entity_id: string;
  entity_slug?: string;
  details?: Record<string, any>;
  user_id?: string;
  ip_address?: string;
  created_at: string;
}

export async function logAuditAction(
  action: AuditLog['action'],
  entity_type: AuditLog['entity_type'],
  entity_id: string,
  details?: Record<string, any>,
  slug?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_logs (action, entity_type, entity_id, entity_slug, details, ip_address, created_at)
      VALUES (${action}, ${entity_type}, ${entity_id}, ${slug || null}, ${JSON.stringify(details || {})}, ${ipAddress || null}, NOW())
    `;
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging should not block operations
  }
}

export async function getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
  try {
    const logs = await sql`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return logs;
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}
