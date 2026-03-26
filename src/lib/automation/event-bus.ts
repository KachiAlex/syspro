import type { AutomationEvent } from './types';

export type EventBusShape = {
  publish(event: AutomationEvent): void;
  subscribe(type: string, handler: (e: AutomationEvent) => void): () => void;
  once(type: string, handler: (e: AutomationEvent) => void): void;
};

// At runtime forward to the root automation event-bus. Use require() to avoid
// TypeScript following cross-repo imports during type-checking.
// @ts-ignore
const remote = require('../../../../src/lib/automation/event-bus');

export const eventBus: EventBusShape = remote?.eventBus ?? {
  publish() {},
  subscribe() { return () => {}; },
  once() {},
};

export default eventBus;
