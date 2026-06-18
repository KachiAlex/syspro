import type { KnowledgeBaseArticle, SLA, Ticket, EngineerProfile, TicketActivityLog } from './types';

export const kbArticles = new Map<string, KnowledgeBaseArticle>();
export const slas = new Map<string, SLA>();
export const tickets = new Map<string, Ticket>();
export const engineers = new Map<string, EngineerProfile>();
export const activityLogs = new Map<string, TicketActivityLog[]>();
