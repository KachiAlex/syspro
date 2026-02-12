import EventEmitter from 'events';
import { AutomationEvent } from './types';

class EventBus {
  private ee = new EventEmitter();

  publish(event: AutomationEvent) {
    const e = { ...event, receivedAt: event.receivedAt ?? new Date().toISOString() };
    this.ee.emit(e.type, e);
  }

  subscribe(type: string, handler: (e: AutomationEvent) => void) {
    this.ee.on(type, handler);
    return () => this.ee.off(type, handler);
  }

  once(type: string, handler: (e: AutomationEvent) => void) {
    this.ee.once(type, handler);
  }
}

export const eventBus = new EventBus();

export default eventBus;
