export * from './types';
export { simulateRule, executeRule } from './engine';

export const eventBus = {
  publish: (evt: { type: string; payload?: any }) => {
    if (typeof console !== 'undefined') console.debug('eventBus.publish', evt);
  },
};
export * from './types';
export * from './event-bus';
