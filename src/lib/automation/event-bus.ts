import type { AutomationEvent } from './types';

export type EventBusShape = {
  publish(event: AutomationEvent): void;
  subscribe(type: string, handler: (e: AutomationEvent) => void): () => void;
  once(type: string, handler: (e: AutomationEvent) => void): void;
};

// Simple in-memory event bus implementation for production
const eventHandlers = new Map<string, Set<(e: AutomationEvent) => void>>();

export const eventBus: EventBusShape = {
  publish(event: AutomationEvent) {
    const handlers = eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  },
  
  subscribe(type: string, handler: (e: AutomationEvent) => void) {
    if (!eventHandlers.has(type)) {
      eventHandlers.set(type, new Set());
    }
    eventHandlers.get(type)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = eventHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlers.delete(type);
        }
      }
    };
  },
  
  once(type: string, handler: (e: AutomationEvent) => void) {
    const unsubscribe = this.subscribe(type, (event) => {
      handler(event);
      unsubscribe();
    });
  },
};

export default eventBus;
