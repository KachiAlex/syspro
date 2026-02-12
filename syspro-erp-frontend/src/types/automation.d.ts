declare module '../../../../src/lib/automation/event-bus' {
  export type AutomationEvent = { type: string; payload?: any; receivedAt?: string };
  export const eventBus: {
    publish(event: AutomationEvent): void;
    subscribe(type: string, handler: (e: AutomationEvent) => void): () => void;
    once(type: string, handler: (e: AutomationEvent) => void): void;
  };
}

declare module '../../../../src/lib/automation/engine-start' {
  const engine: any;
  export default engine;
}

declare module '../../../../src/lib/automation' {
  import { AutomationEvent, eventBus } from '../../../../src/lib/automation/event-bus';
  export type { AutomationEvent };
  export { eventBus };
  const engine: any;
  export default engine;
}
