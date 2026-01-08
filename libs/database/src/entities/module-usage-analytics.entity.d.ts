import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
export declare class ModuleUsageAnalytics extends BaseEntity {
    tenantId: string;
    moduleName: string;
    endpoint?: string;
    requestCount: number;
    responseTimeMs?: number;
    errorCount: number;
    date: Date;
    hour: number;
    metadata?: Record<string, any>;
    tenant: Tenant;
    get successRate(): number;
    get hasErrors(): boolean;
    get isHighTraffic(): boolean;
    get averageResponseTime(): number;
    static createKey(tenantId: string, moduleName: string, endpoint: string | null, date: Date, hour: number): string;
    static fromApiCall(tenantId: string, moduleName: string, endpoint: string, responseTimeMs: number, isError?: boolean, metadata?: Record<string, any>): Partial<ModuleUsageAnalytics>;
    incrementUsage(responseTimeMs?: number, isError?: boolean): void;
    merge(other: ModuleUsageAnalytics): void;
}
