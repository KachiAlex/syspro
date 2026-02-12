// Lightweight server-side stub to satisfy imports from the frontend layout.
// In production this module should start the automation engine/broker.
if (typeof window === "undefined") {
  // Ensure this runs only once across module loads
  const g = global as any;
  if (!g.__syspro_automation_engine_started) {
    g.__syspro_automation_engine_started = true;
    try {
      // Minimal logging for debug; avoid heavy runtime dependencies here.
      // Real engine startup (worker, scheduler) should be implemented separately.
      // eslint-disable-next-line no-console
      console.info("syspro: automation engine stub initialized");
    } catch (e) {
      // ignore
    }
  }
}

export {};
// Lightweight server-only stub for automation engine startup.
// The real implementation registers rules and starts a background
// worker. For build environments and CI we provide a safe no-op
// to satisfy side-effect imports from the frontend layout.

if (typeof window === "undefined") {
  try {
    // Place any lightweight initialization here if needed in future.
    // Currently a no-op to avoid startup side-effects during build.
    // eslint-disable-next-line no-console
    console.debug("automation engine-start loaded (noop)");
  } catch (err) {
    // swallow errors during build-time import
  }
}

export {};
import ruleEngine from './rule-engine';
import { registerRule } from './rule-engine';

// Bootstrap: register a minimal example rule (mirrors seed) and start engine.
const exampleRule = {
  id: 'example-vendor-rule',
  name: 'Example vendor.created rule',
  conditions: [{ op: 'eq', path: 'type', value: 'vendor.created' }],
  actions: [{ op: 'log', message: 'Vendor created—example action' }],
  enabled: true,
};

registerRule(exampleRule as any);
ruleEngine.startRuleEngine();

export default ruleEngine;
