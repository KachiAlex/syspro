import { randomUUID } from "crypto";
import { db } from "../sql-client";
import { postGLEntry, GLLineInput, GLEntryResult } from "./gl";

export interface JournalEntryTemplate {
  id: string;
  tenantSlug: string;
  name: string;
  description: string | null;
  journalType: string;
  /** Line blueprint; amounts may be relative — callers can scale via totalDebit. */
  lines: Array<{
    accountCode?: string;
    accountId?: string;
    debitAmount?: number;
    creditAmount?: number;
    description?: string;
    partyType?: string;
    partyId?: string;
    dimensions?: Record<string, string>;
  }>;
  active: boolean;
  createdAt: string;
}

async function ensureTable() {
  await db.query(`
    create table if not exists journal_entry_templates (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      name text not null,
      description text,
      journal_type text not null default 'MANUAL',
      lines jsonb not null default '[]'::jsonb,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      unique (tenant_slug, name)
    )`);
}

function toTemplate(r: any): JournalEntryTemplate {
  return {
    id: r.id,
    tenantSlug: r.tenant_slug,
    name: r.name,
    description: r.description,
    journalType: r.journal_type,
    lines: typeof r.lines === "string" ? JSON.parse(r.lines) : (r.lines ?? []),
    active: Boolean(r.active),
    createdAt: r.created_at,
  };
}

export async function listJournalEntryTemplates(tenantSlug: string): Promise<JournalEntryTemplate[]> {
  await ensureTable();
  const { rows } = await db.query(
    `select * from journal_entry_templates where tenant_slug = $1 and active order by name`,
    [tenantSlug],
  );
  return (rows as any[]).map(toTemplate);
}

export async function upsertJournalEntryTemplate(input: {
  tenantSlug: string;
  id?: string;
  name: string;
  description?: string;
  journalType?: string;
  lines: JournalEntryTemplate["lines"];
  active?: boolean;
}): Promise<JournalEntryTemplate> {
  await ensureTable();
  if (!input.name?.trim()) throw new Error("name is required");
  if (!Array.isArray(input.lines) || !input.lines.length) {
    throw new Error("template requires at least one line");
  }
  const { rows } = await db.query(
    `insert into journal_entry_templates (id, tenant_slug, name, description, journal_type, lines, active)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (tenant_slug, name)
     do update set description = excluded.description, journal_type = excluded.journal_type,
                   lines = excluded.lines, active = excluded.active
     returning *`,
    [
      input.id ?? randomUUID(), input.tenantSlug, input.name.trim(),
      input.description ?? null, input.journalType ?? "MANUAL",
      JSON.stringify(input.lines), input.active ?? true,
    ],
  );
  return toTemplate((rows as any[])[0]);
}

export async function deleteJournalEntryTemplate(id: string, tenantSlug: string): Promise<boolean> {
  await ensureTable();
  const { rowCount } = await db.query(
    `update journal_entry_templates set active = false where id = $1 and tenant_slug = $2`,
    [id, tenantSlug],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Post a journal entry from a template. Optional `totalDebit` scales every
 * line proportionally (e.g. an accrual template posted with this period's
 * amount) — the scaled entry must still balance.
 */
export async function postFromTemplate(input: {
  tenantSlug: string;
  templateId: string;
  entryDate: string | Date;
  description?: string;
  referenceId?: string;
  financeBook?: string;
  totalDebit?: number;
  status?: "POSTED" | "DRAFT";
  createdBy?: string;
}): Promise<GLEntryResult> {
  await ensureTable();
  const { rows } = await db.query(
    `select * from journal_entry_templates where id = $1 and tenant_slug = $2 and active`,
    [input.templateId, input.tenantSlug],
  );
  const tpl = (rows as any[])[0] ? toTemplate((rows as any[])[0]) : null;
  if (!tpl) throw new Error("Template not found");

  const scale = input.totalDebit !== undefined
    ? (() => {
        const base = tpl.lines.reduce((s, l) => s + (l.debitAmount ?? 0), 0);
        if (base <= 0) throw new Error("Cannot scale a template with zero total debits");
        return input.totalDebit / base;
      })()
    : 1;

  const lines: GLLineInput[] = tpl.lines.map((l) => ({
    ...l,
    partyType: l.partyType as GLLineInput["partyType"],
    debitAmount: Math.round((l.debitAmount ?? 0) * scale * 100) / 100,
    creditAmount: Math.round((l.creditAmount ?? 0) * scale * 100) / 100,
  }));

  return postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.entryDate,
    journalType: tpl.journalType as any,
    referenceType: "je_template",
    referenceId: input.referenceId ?? input.templateId,
    financeBook: input.financeBook,
    description: input.description ?? `${tpl.name}`,
    status: input.status,
    createdBy: input.createdBy,
    metadata: { templateId: input.templateId, templateName: tpl.name },
    lines,
  });
}
