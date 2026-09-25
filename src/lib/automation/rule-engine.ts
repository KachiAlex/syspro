import { eventBus } from './event-bus';
import type { AutomationEvent } from './types';
import {
  listAutomationRules,
  enqueueAutomationActions,
  insertAutomationAudit,
} from './db';
import { cached } from '@/lib/cache';

// DB-backed rule engine: subscribes to the in-process event bus, evaluates
// enabled automation_rules for the event's tenant, records an audit row for
// every evaluated rule, and enqueues actions for matches (executed by the
// automation queue processor).

type RuleCondition = {
  all?: RuleCondition[];
  any?: RuleCondition[];
  field?: string;
  op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'excludes' | 'exists' | 'missing';
  value?: any;
};

function resolveField(evt: AutomationEvent, field: string): any {
  // Dot-path lookup against the event, then inside payload
  const sources: any[] = [evt, evt?.payload];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    let cur: any = src;
    let found = true;
    for (const part of field.split('.')) {
      if (cur && typeof cur === 'object' && part in cur) cur = cur[part];
      else { found = false; break; }
    }
    if (found) return cur;
  }
  return undefined;
}

function evalCondition(cond: RuleCondition | null | undefined, evt: AutomationEvent): boolean {
  if (!cond || typeof cond !== 'object') return true;
  if (Array.isArray(cond.all) && cond.all.length) {
    return cond.all.every((c) => evalCondition(c, evt));
  }
  if (Array.isArray(cond.any) && cond.any.length) {
    return cond.any.some((c) => evalCondition(c, evt));
  }
  if (!cond.field) return true;

  const actual = resolveField(evt, cond.field);
  switch (cond.op || 'eq') {
    case 'eq': return actual === cond.value;
    case 'neq': return actual !== cond.value;
    case 'gt': return Number(actual) > Number(cond.value);
    case 'gte': return Number(actual) >= Number(cond.value);
    case 'lt': return Number(actual) < Number(cond.value);
    case 'lte': return Number(actual) <= Number(cond.value);
    case 'includes':
      return Array.isArray(actual) ? actual.includes(cond.value)
        : typeof actual === 'string' ? actual.includes(String(cond.value))
        : false;
    case 'excludes':
      return Array.isArray(actual) ? !actual.includes(cond.value)
        : typeof actual === 'string' ? !actual.includes(String(cond.value))
        : actual !== cond.value;
    case 'exists': return actual !== undefined && actual !== null;
    case 'missing': return actual === undefined || actual === null;
    default: return false;
  }
}

function tenantOf(evt: AutomationEvent): string | null {
  return (
    (evt as any).tenantSlug ||
    (evt as any).tenant_slug ||
    evt.payload?.tenantSlug ||
    evt.payload?.tenant_slug ||
    null
  );
}

async function rulesForTenant(tenantSlug: string) {
  return cached(`automation:rules:${tenantSlug}`, 30_000, () => listAutomationRules(tenantSlug));
}

let started = false;

export function startRuleEngine() {
  if (started) return;
  started = true;

  eventBus.subscribe('*', async (evt: AutomationEvent) => {
    try {
      const tenantSlug = tenantOf(evt);
      if (!tenantSlug) return;

      const rules = await rulesForTenant(tenantSlug);
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (rule.eventType !== evt.type && rule.eventType !== '*') continue;

        const matched = evalCondition(rule.condition as RuleCondition, evt);
        const actions = (rule.actions || []) as Array<{ type: string; params?: any; targetModule?: string }>;

        await insertAutomationAudit({
          ruleId: rule.id,
          tenantSlug,
          triggerEvent: evt as any,
          matched,
          result: { actions: matched ? actions.length : 0, skipped: !matched },
          simulation: rule.simulationOnly ?? false,
        }).catch((err: unknown) => console.error('automation audit write failed', err));

        if (!matched || rule.simulationOnly || !actions.length) continue;

        await enqueueAutomationActions(
          actions.map((a) => ({
            ruleId: rule.id,
            tenantSlug,
            actionType: a.type,
            actionPayload: { params: a.params ?? {}, targetModule: a.targetModule, event: evt },
          }))
        );
      }
    } catch (err: unknown) {
      console.error('rule-engine error', err);
    }
  });
}

export function startRuleEngineFor(_type: string) {
  startRuleEngine();
}

const ruleEngine = { startRuleEngine, startRuleEngineFor };
export default ruleEngine;
