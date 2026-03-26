import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { FALLBACK_ORG_TREE, OrgNode, ORG_NODE_STATUSES, ORG_NODE_TYPES } from "@/lib/org-tree";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

const DEFAULT_TENANT_SLUG = "kreatix-default";

type TenantStructureRow = {
  tree: unknown;
};


const NODE_TYPE_ENUM = z.enum(ORG_NODE_TYPES as [OrgNode["type"], ...OrgNode["type"][]]);
const STATUS_ENUM = z.enum(ORG_NODE_STATUSES);

const updateSchema = z
  .object({
    nodeId: z.string().min(1, "nodeId is required"),
    updates: z
      .object({
        name: z.string().min(2).optional(),
        manager: z.string().min(2).optional(),
        status: STATUS_ENUM.optional(),
        region: z.string().optional(),
        timezone: z.string().optional(),
        headcount: z.number().int().nonnegative().optional(),
        modules: z.array(z.string()).optional(),
        metadata: z.record(z.string()).optional(),
        type: NODE_TYPE_ENUM.optional(),
      })
      .default({}),
    targetParentId: z.string().optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .refine((payload) => Object.keys(payload.updates).length > 0 || payload.targetParentId, {
    message: "Provide updates or a target parent",
  });

const createSchema = z.object({
  parentId: z.string().min(1),
  node: z.object({
    name: z.string().min(2),
    manager: z.string().min(2),
    status: STATUS_ENUM.default("Planning"),
    region: z.string().optional(),
    timezone: z.string().optional(),
    headcount: z.number().int().nonnegative().optional(),
    modules: z.array(z.string()).optional(),
    metadata: z.record(z.string()).optional(),
    type: NODE_TYPE_ENUM.refine((value) => value !== "tenant", {
      message: "Cannot create tenant nodes via this endpoint",
    }),
  }),
});

const deleteSchema = z.object({
  nodeId: z.string().min(1),
});

async function ensureTenantOrgStructureTable(sql: SqlClient) {
  await sql`
    create table if not exists tenant_org_structures (
      slug text primary key,
      tree jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
}

async function persistTenantTree(sql: SqlClient, slug: string, tree: OrgNode) {
  await ensureTenantOrgStructureTable(sql);
  const payload = cloneNode(tree);
  await sql`
    insert into tenant_org_structures (slug, tree)
    values (${slug}, ${JSON.stringify(payload)}::jsonb)
    on conflict (slug) do update set tree = excluded.tree, updated_at = now()
  `;
}

async function loadTenantTree(sql: SqlClient, slug: string): Promise<OrgNode> {
  await ensureTenantOrgStructureTable(sql);
  try {
    const rows = (await sql`
      select tree from tenant_org_structures
      where slug = ${slug}
      limit 1
    `) as TenantStructureRow[];

    if (rows.length > 0 && rows[0].tree && typeof rows[0].tree === "object") {
      return cloneNode(rows[0].tree as OrgNode);
    }
  } catch (error) {
    console.error(`Tenant org structure load failed for ${slug}`, error);
  }

  const fallbackTree = cloneNode(FALLBACK_ORG_TREE);
  await persistTenantTree(sql, slug, fallbackTree);
  return fallbackTree;
}

function sanitizeTenantSlug(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  return normalized || null;
}

function resolveTenantSlug(request: NextRequest): string {
  const url = new URL(request.url);
  const querySlug = sanitizeTenantSlug(url.searchParams.get("tenantSlug"));
  const headerSlug = sanitizeTenantSlug(request.headers.get("x-tenant-slug"));
  return headerSlug ?? querySlug ?? DEFAULT_TENANT_SLUG;
}

function cloneNode(node: OrgNode): OrgNode {
  return {
    ...node,
    children: node.children ? node.children.map(cloneNode) : undefined,
  };
}

function findNodeWithParent(node: OrgNode, id: string, parent: OrgNode | null = null): { node: OrgNode; parent: OrgNode | null } | null {
  if (node.id === id) {
    return { node, parent };
  }
  for (const child of node.children ?? []) {
    const result = findNodeWithParent(child, id, node);
    if (result) {
      return result;
    }
  }
  return null;
}

function ensureChildrenArray(node: OrgNode) {
  if (!node.children) {
    node.children = [];
  }
}

function moveNode(tree: OrgNode, nodeId: string, targetParentId: string, position?: number): OrgNode | null {
  const current = findNodeWithParent(tree, nodeId);
  if (!current || !current.parent) {
    return null;
  }

  const isTargetDescendant = findNodeWithParent(current.node, targetParentId);
  if (isTargetDescendant) {
    return null;
  }

  const target = findNodeWithParent(tree, targetParentId);
  if (!target) {
    return null;
  }

  current.parent.children = (current.parent.children ?? []).filter((child) => child.id !== nodeId);
  ensureChildrenArray(target.node);

  const insertionIndex = typeof position === "number" ? Math.min(Math.max(position, 0), target.node.children!.length) : target.node.children!.length;
  target.node.children!.splice(insertionIndex, 0, current.node);
  return current.node;
}

export async function GET(request: NextRequest) {
  try {
    const sql = SQL;
    const tenantSlug = resolveTenantSlug(request);
    const tree = await loadTenantTree(sql, tenantSlug);
    return NextResponse.json({ tree, tenantSlug, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Org tree fetch failed, serving fallback", error);
    return NextResponse.json({
      tree: cloneNode(FALLBACK_ORG_TREE),
      tenantSlug: DEFAULT_TENANT_SLUG,
      fallback: true,
      fetchedAt: new Date().toISOString(),
      error: "Unable to reach tenant org storage; served fallback.",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const sql = SQL;
    const tenantSlug = resolveTenantSlug(request);
    const tree = await loadTenantTree(sql, tenantSlug);
    const parent = findNodeWithParent(tree, parsed.data.parentId);

    if (!parent) {
      return NextResponse.json({ error: "Parent node not found" }, { status: 404 });
    }

    ensureChildrenArray(parent.node);

    const newNode: OrgNode = {
      id: randomUUID(),
      ...parsed.data.node,
      metadata: parsed.data.node.metadata ?? {},
      children: [],
    };

    parent.node.children!.push(newNode);
    await persistTenantTree(sql, tenantSlug, tree);

    return NextResponse.json({ node: newNode, tree, tenantSlug });
  } catch (error) {
    console.error("Org tree create failed", error);
    return NextResponse.json({ error: "Unable to create node" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const sql = SQL;
    const tenantSlug = resolveTenantSlug(request);
    const tree = await loadTenantTree(sql, tenantSlug);
    const current = findNodeWithParent(tree, parsed.data.nodeId);

    if (!current) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    if (parsed.data.targetParentId) {
      if (parsed.data.targetParentId === parsed.data.nodeId) {
        return NextResponse.json({ error: "Cannot reparent node to itself" }, { status: 400 });
      }

      const moved = moveNode(tree, parsed.data.nodeId, parsed.data.targetParentId, parsed.data.position);
      if (!moved) {
        return NextResponse.json({ error: "Unable to move node" }, { status: 400 });
      }
    }

    Object.assign(current.node, parsed.data.updates);
    await persistTenantTree(sql, tenantSlug, tree);

    return NextResponse.json({ node: current.node, tree, tenantSlug });
  } catch (error) {
    console.error("Org tree mutation failed", error);
    return NextResponse.json({ error: "Unable to update node" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const sql = SQL;
    const tenantSlug = resolveTenantSlug(request);
    const tree = await loadTenantTree(sql, tenantSlug);
    const current = findNodeWithParent(tree, parsed.data.nodeId);

    if (!current || !current.parent) {
      return NextResponse.json({ error: "Unable to delete this node" }, { status: 400 });
    }

    current.parent.children = (current.parent.children ?? []).filter((child) => child.id !== parsed.data.nodeId);
    await persistTenantTree(sql, tenantSlug, tree);

    return NextResponse.json({ removedId: parsed.data.nodeId, tree, tenantSlug });
  } catch (error) {
    console.error("Org tree delete failed", error);
    return NextResponse.json({ error: "Unable to delete node" }, { status: 500 });
  }
}
