import { Json } from '../common-types';

export interface AutomationEvent {
  type: string;
  payload?: Record<string, any>;
  receivedAt?: string;
}
