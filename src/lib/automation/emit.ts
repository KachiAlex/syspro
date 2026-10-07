import { executeRulesForEvent } from "./engine";

/**
 * Fire-and-forget automation event emitter. Business flows call this after
 * their own commit so a failing rule engine can never break the primary
 * transaction. Event names must match automation_rules.event_type values —
 * see GET /api/automation/triggers for the advertised catalog.
 */
export function emitAutomationEvent(
  tenantSlug: string,
  type: string,
  payload: Record<string, any> = {},
  actor?: string
): void {
  // Do not await: rule evaluation + queue writes must not add latency or
  // failure modes to the calling workflow.
  Promise.resolve()
    .then(() => executeRulesForEvent(tenantSlug, { type, payload, actor }))
    .catch((err) => {
      console.error(`[automation] event ${type} failed for ${tenantSlug}:`, err);
    });
}
