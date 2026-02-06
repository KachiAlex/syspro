import { AutomationRule, Condition, RuleSimulationResult, Action } from "./types";
import { insertAutomationAudit, enqueueAutomationActions } from "./db";

function getValue(payload: any, path?: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc: any, key: string) => (acc ? acc[key] : undefined), payload);
}

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

function evaluateCondition(condition: Condition, payload: any, results: Array<{ condition: Condition; result: boolean }>): boolean {
  if (condition.all && condition.all.length > 0) {
    const childResults = condition.all.map((c) => evaluateCondition(c, payload, results));
    const ok = childResults.every(Boolean);
    results.push({ condition, result: ok });
    return ok;
  }
  if (condition.any && condition.any.length > 0) {
    const childResults = condition.any.map((c) => evaluateCondition(c, payload, results));
    const ok = childResults.some(Boolean);
    results.push({ condition, result: ok });
    return ok;
  }
  const value = getValue(payload, condition.field);
  const ok = compare(condition.op, value, condition.value);
  results.push({ condition, result: ok });
  return ok;
}

export function simulateRule(rule: AutomationRule, event: { type: string; payload: any; actor?: string }): RuleSimulationResult {
  const details: Array<{ condition: Condition; result: boolean }> = [];
  if (!rule.enabled) return { matched: false, actions: [], details };
  if (rule.eventType && rule.eventType !== event.type) return { matched: false, actions: [], details };

  const matched = evaluateCondition(rule.condition, event.payload, details);
  const actions = matched ? rule.actions : [];
  return { matched, actions, details };
}

export async function executeRule(rule: AutomationRule, event: { type: string; payload: any; actor?: string; tenantSlug: string }, simulation = false) {
  const result = simulateRule(rule, event);
  await insertAutomationAudit({
    ruleId: rule.id,
    tenantSlug: event.tenantSlug,
    triggerEvent: event,
    matched: result.matched,
    result,
    actor: event.actor,
    scope: rule.scope ?? null,
    simulation,
  });

  if (!result.matched || simulation) return result;

  await enqueueAutomationActions(
    result.actions.map((action) => ({
      ruleId: rule.id,
      tenantSlug: event.tenantSlug,
      actionType: action.type,
      actionPayload: { params: action.params, targetModule: action.targetModule, event },
    }))
  );

  return result;
}
