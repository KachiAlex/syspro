import { eventBus } from './event-bus';
import type { AutomationEvent } from './types';

// Very small rule engine skeleton. Intended to be expanded.
// Current behavior: listens to all events, checks simple rules stored in memory (placeholder),
// and executes minimal actions (console logging). This avoids DB coupling for the first pass.

type Condition = { op: string; path: string; value: any };
type Action = { op: string; message?: string };

interface InMemoryRule {
  id: string;
  name: string;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
}

// Placeholder rules: in future these will be loaded from `automation_rules` table.
const inMemoryRules: InMemoryRule[] = [];

function matchCondition(evt: AutomationEvent, c: Condition) {
  if (c.op === 'eq') {
    // simple path resolution: support 'type' top-level
    const val = (evt as any)[c.path];
    return val === c.value;
  }
  return false;
}

function runActions(evt: AutomationEvent, actions: Action[]) {
  for (const a of actions) {
    if (a.op === 'log') {
      console.info('[automation] action:log', a.message, { event: evt });
    }
    // More action handlers (webhook, create-run, send-email) will be added later.
  }
}

export function registerRule(rule: InMemoryRule) {
  inMemoryRules.push(rule);
}

export function startRuleEngine() {
  // Subscribe to all events and evaluate rules.
  eventBus.subscribe('*', (e: AutomationEvent) => {
    try {
      for (const r of inMemoryRules) {
        if (!r.enabled) continue;
        const ok = r.conditions.every((c) => matchCondition(e, c));
        if (ok) runActions(e, r.actions);
      }
    } catch (err) {
      console.error('rule-engine error', err);
    }
  });
}

// Also provide an explicit event handler registration for typed subscriptions
export function startRuleEngineFor(type: string) {
  eventBus.subscribe(type, (e: AutomationEvent) => {
    try {
      for (const r of inMemoryRules) {
        if (!r.enabled) continue;
        const ok = r.conditions.every((c) => matchCondition(e, c));
        if (ok) runActions(e, r.actions);
      }
    } catch (err) {
      console.error('rule-engine error', err);
    }
  });
}

export default {
  registerRule,
  startRuleEngine,
  startRuleEngineFor,
};
