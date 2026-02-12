// Engine starter shim — proxies to repo-root engine starter at runtime.
// Use require() and ts-ignore so frontend TypeScript doesn't pull root sources.
// @ts-ignore
const remote = require('../../../../src/lib/automation/engine-start');

const engine = remote?.default ?? null;

export default engine;
