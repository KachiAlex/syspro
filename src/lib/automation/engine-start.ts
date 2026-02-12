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
