import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { FALLBACK_ORG_TREE, OrgNode, ORG_NODE_STATUSES, ORG_NODE_TYPES } from "@/lib/org-tree";

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

export async function GET() {
  return NextResponse.json({ tree: cloneNode(FALLBACK_ORG_TREE), fetchedAt: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const tree = cloneNode(FALLBACK_ORG_TREE);
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

    return NextResponse.json({ node: newNode, tree });
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

    const tree = cloneNode(FALLBACK_ORG_TREE);
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

    return NextResponse.json({ node: current.node, tree });
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

    const tree = cloneNode(FALLBACK_ORG_TREE);
    const current = findNodeWithParent(tree, parsed.data.nodeId);

    if (!current || !current.parent) {
      return NextResponse.json({ error: "Unable to delete this node" }, { status: 400 });
    }

    current.parent.children = (current.parent.children ?? []).filter((child) => child.id !== parsed.data.nodeId);

    return NextResponse.json({ removedId: parsed.data.nodeId, tree });
  } catch (error) {
    console.error("Org tree delete failed", error);
    return NextResponse.json({ error: "Unable to delete node" }, { status: 500 });
  }
}
