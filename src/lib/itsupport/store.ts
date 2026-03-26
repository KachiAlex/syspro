import type { KnowledgeBaseArticle, SLA, SupportTicket, SupportEngineer } from './types';

export const kbArticles = new Map<string, KnowledgeBaseArticle>();
export const slas = new Map<string, SLA>();
export const tickets = new Map<string, SupportTicket>();
export const engineers = new Map<string, SupportEngineer>();
