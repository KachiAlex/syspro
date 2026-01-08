import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
export declare enum SubscriptionStatus {
    ACTIVE = "active",
    CANCELED = "canceled",
    PAST_DUE = "past_due",
    UNPAID = "unpaid",
    TRIALING = "trialing"
}
export declare class Subscription extends BaseEntity {
    status: SubscriptionStatus;
    planId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    trialEnd?: Date;
    tenantId: string;
    tenant: Tenant;
}
