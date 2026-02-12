import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { Condition } from "@/lib/automation/types";
import { ensurePolicyTables } from "@/lib/policy/db";

/* using imported SQL */

type PolicyDecision = { allowed: boolean; reason?: string };

type PolicyRecord = {
  id: string;
  status: string;
  document: any;
  version: number;
};

function compare(op: Condition["op"], left: any, right: any): boolean {
  switch (op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "includes":
      return Array.isArray(left) ? left.includes(right) : typeof left === "string" ? left.includes(String(right)) : false;
    case "excludes":
      return Array.isArray(left) ? !left.includes(right) : typeof left === "string" ? !left.includes(String(right)) : false;
    case "exists":
      return left !== undefined && left !== null;
    case "missing":
      return left === undefined || left === null;
    default:
      return false;
  }
}

function getValue(payload: any, path?: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc: any, key: string) => (acc ? acc[key] : undefined), payload);
}

function evaluateCondition(condition: Condition, context: any): boolean {
  if (condition.all && condition.all.length > 0) {
    return condition.all.every((c) => evaluateCondition(c, context));
  }
  if (condition.any && condition.any.length > 0) {
    return condition.any.some((c) => evaluateCondition(c, context));
  }
  const value = getValue(context, condition.field);
  return compare(condition.op, value, condition.value);
}

function applyPolicyDocument(doc: any, context: any): PolicyDecision {
  if (!doc) return { allowed: true, reason: "no policy document" };
  const deny = Array.isArray(doc.deny) ? doc.deny : [];
  const allow = Array.isArray(doc.allow) ? doc.allow : [];
  const defaultDecision: "allow" | "deny" = doc.default === "deny" ? "deny" : "allow";

  if (deny.some((c: Condition) => evaluateCondition(c, context))) {
    return { allowed: false, reason: "deny condition matched" };
  }
  if (allow.length > 0) {
    const ok = allow.some((c: Condition) => evaluateCondition(c, context));
    return ok ? { allowed: true, reason: "allow condition matched" } : { allowed: false, reason: "no allow condition matched" };
  }
  return { allowed: defaultDecision === "allow", reason: `${defaultDecision} by default` };
}

async function fetchLatestPolicy(tenantSlug: string, policyKey: string, sql: SqlClient = SQL): Promise<PolicyRecord | null> {
  await ensurePolicyTables(sql);
  const rows = await sql`
    select p.id, p.status, pv.document, pv.version
    from policies p
    join policy_versions pv on p.id = pv.policy_id
    where p.tenant_slug = ${tenantSlug} and p.policy_key = ${policyKey}
    order by pv.version desc
    limit 1
  `;
  if (!rows.length) return null;
  return rows[0] as PolicyRecord;
}

export async function evaluatePolicyDecision(input: { tenantSlug: string; policyKey: string; context: any; sql?: SqlClient }): Promise<PolicyDecision> {
  const sql = input.sql ?? SQL;
  const policy = await fetchLatestPolicy(input.tenantSlug, input.policyKey, sql);
  if (!policy) return { allowed: true, reason: "no policy found" };
  if (policy.status !== "published") return { allowed: true, reason: "policy not published" };
  return applyPolicyDocument(policy.document, input.context ?? {});
}
