import { db } from "@/lib/sql-client";

// Platform edge features: asset shift allocation + activity logs, document
// sharing, energy points, CMS (blog posts + web pages).

// ── Asset allocations & activity ───────────────────────────────────────────

export async function listAssetAllocations(tenantSlug: string, assetId?: string) {
  const conds = ["a.tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (assetId) { params.push(assetId); conds.push(`a.asset_id = $${params.length}`); }
  return (await db.query<any>(
    `select a.*, e.name as employee_name from asset_shift_allocations a
     left join admin_employees e on e.id::text = a.employee_id
     where ${conds.join(" and ")} order by a.from_date desc`, params
  )).rows;
}

export async function allocateAsset(input: {
  tenantSlug: string; assetId: string; employeeId?: string;
  shiftId?: string; fromDate: string; toDate?: string;
}) {
  return (await db.query<any>(
    `insert into asset_shift_allocations (tenant_slug, asset_id, employee_id,
       shift_id, from_date, to_date)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.assetId, input.employeeId ?? null,
     input.shiftId ?? null, input.fromDate, input.toDate ?? null]
  )).rows[0];
}

export async function endAllocation(tenantSlug: string, id: string) {
  return (await db.query<any>(
    `update asset_shift_allocations set status='ended', to_date=current_date
     where id = $1 and tenant_slug = $2 and status = 'active' returning *`,
    [id, tenantSlug]
  )).rows[0];
}

export async function logAssetActivity(input: {
  tenantSlug: string; assetId: string; activityType: string;
  readingValue?: number; notes?: string; loggedBy?: string;
}) {
  return (await db.query<any>(
    `insert into asset_activity_logs (tenant_slug, asset_id, activity_type,
       reading_value, notes, logged_by)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.assetId, input.activityType,
     input.readingValue ?? null, input.notes ?? null, input.loggedBy ?? null]
  )).rows[0];
}

export async function listAssetActivity(tenantSlug: string, assetId?: string, limit = 100) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug, limit];
  if (assetId) { params.push(assetId); conds.push(`asset_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from asset_activity_logs where ${conds.join(" and ")}
     order by created_at desc limit $2`, params
  )).rows;
}

// ── DocShare ───────────────────────────────────────────────────────────────

export async function listDocShares(tenantSlug: string, docType?: string, docId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (docType) { params.push(docType); conds.push(`doc_type = $${params.length}`); }
  if (docId) { params.push(docId); conds.push(`doc_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from doc_shares where ${conds.join(" and ")}
     order by created_at desc`, params
  )).rows;
}

export async function shareDoc(input: {
  tenantSlug: string; docType: string; docId: string;
  sharedWith: string; permission?: "read" | "write" | "share"; createdBy?: string;
}) {
  return (await db.query<any>(
    `insert into doc_shares (tenant_slug, doc_type, doc_id, shared_with,
       permission, created_by)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (tenant_slug, doc_type, doc_id, shared_with) do update set
       permission = excluded.permission
     returning *`,
    [input.tenantSlug, input.docType, input.docId, input.sharedWith,
     input.permission ?? "read", input.createdBy ?? null]
  )).rows[0];
}

export async function unshareDoc(tenantSlug: string, id: string) {
  await db.query(
    `delete from doc_shares where id = $1 and tenant_slug = $2`, [id, tenantSlug]
  );
}

/** Docs shared with a user — for a "shared with me" view. */
export async function docsSharedWith(tenantSlug: string, userId: string) {
  return (await db.query<any>(
    `select * from doc_shares where tenant_slug = $1 and shared_with = $2
     order by created_at desc`, [tenantSlug, userId]
  )).rows;
}

// ── Energy points ──────────────────────────────────────────────────────────

export async function awardEnergyPoints(input: {
  tenantSlug: string; userId: string; points: number;
  reason: string; docType?: string; docId?: string;
}) {
  if (input.points === 0) throw new Error("points cannot be zero");
  return (await db.query<any>(
    `insert into energy_point_logs (tenant_slug, user_id, points, reason,
       doc_type, doc_id)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.userId, input.points, input.reason,
     input.docType ?? null, input.docId ?? null]
  )).rows[0];
}

export async function revertEnergyPoints(tenantSlug: string, id: string) {
  return (await db.query<any>(
    `update energy_point_logs set reverted = true
     where id = $1 and tenant_slug = $2 and not reverted returning *`,
    [id, tenantSlug]
  )).rows[0];
}

export async function energyLeaderboard(tenantSlug: string, limit = 20) {
  return (await db.query<any>(
    `select user_id, sum(points) as total_points, count(*) as awards
     from energy_point_logs where tenant_slug = $1 and not reverted
     group by user_id order by total_points desc limit $2`,
    [tenantSlug, limit]
  )).rows;
}

export async function listEnergyLog(tenantSlug: string, userId?: string, limit = 100) {
  const conds = ["tenant_slug = $1", "not reverted"];
  const params: any[] = [tenantSlug, limit];
  if (userId) { params.push(userId); conds.push(`user_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from energy_point_logs where ${conds.join(" and ")}
     order by created_at desc limit $2`, params
  )).rows;
}

// ── CMS ────────────────────────────────────────────────────────────────────

export async function listCmsPosts(tenantSlug: string, publishedOnly = false) {
  return (await db.query<any>(
    `select id, title, slug, excerpt, category, cover_image, published,
            published_at, author, created_at
     from cms_posts where tenant_slug = $1 ${publishedOnly ? "and published" : ""}
     order by published_at desc nulls last, created_at desc`,
    [tenantSlug]
  )).rows;
}

export async function upsertCmsPost(input: {
  tenantSlug: string; id?: string; title: string; slug: string;
  content: string; excerpt?: string; category?: string;
  coverImage?: string; published?: boolean; author?: string;
}) {
  if (!/^[a-z0-9-]+$/.test(input.slug)) throw new Error("slug must be lowercase letters/digits/hyphens");
  if (input.id) {
    return (await db.query<any>(
      `update cms_posts set title=$1, slug=$2, content=$3, excerpt=$4,
         category=$5, cover_image=$6, published=$7,
         published_at = case when $8 and published_at is null then now() else published_at end,
         updated_at=now()
       where id=$9 and tenant_slug=$10 returning *`,
      [input.title, input.slug, input.content, input.excerpt ?? null,
       input.category ?? null, input.coverImage ?? null, input.published ?? false,
       input.published ?? false, input.id, input.tenantSlug]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into cms_posts (tenant_slug, title, slug, content, excerpt,
       category, cover_image, published, published_at, author)
     values ($1,$2,$3,$4,$5,$6,$7,$8, case when $8 then now() end, $9)
     returning *`,
    [input.tenantSlug, input.title, input.slug, input.content,
     input.excerpt ?? null, input.category ?? null, input.coverImage ?? null,
     input.published ?? false, input.author ?? null]
  )).rows[0];
}

export async function getCmsPost(tenantSlug: string, slug: string) {
  return (await db.query<any>(
    `select * from cms_posts where tenant_slug = $1 and slug = $2 and published`,
    [tenantSlug, slug]
  )).rows[0] ?? null;
}

export async function listCmsPages(tenantSlug: string) {
  return (await db.query<any>(
    `select * from cms_pages where tenant_slug = $1 order by title`, [tenantSlug]
  )).rows;
}

export async function upsertCmsPage(input: {
  tenantSlug: string; id?: string; title: string; slug: string;
  content: string; published?: boolean;
}) {
  if (input.id) {
    return (await db.query<any>(
      `update cms_pages set title=$1, slug=$2, content=$3, published=$4
       where id=$5 and tenant_slug=$6 returning *`,
      [input.title, input.slug, input.content, input.published ?? false,
       input.id, input.tenantSlug]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into cms_pages (tenant_slug, title, slug, content, published)
     values ($1,$2,$3,$4,$5) on conflict (tenant_slug, slug) do update set
       title = excluded.title, content = excluded.content,
       published = excluded.published returning *`,
    [input.tenantSlug, input.title, input.slug, input.content,
     input.published ?? false]
  )).rows[0];
}
