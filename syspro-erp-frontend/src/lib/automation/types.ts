export type Json = any;

export interface AutomationEvent {
  type: string;
  payload?: Record<string, any>;
  receivedAt?: string;
}
