import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Organization } from './organization.entity';
import { Subscription } from './subscription.entity';
export interface TenantSettings {
    timezone: string;
    currency: string;
    dateFormat: string;
    language: string;
    features: string[];
    branding?: {
        logo?: string;
        primaryColor?: string;
        secondaryColor?: string;
    };
}
export declare class Tenant extends BaseEntity {
    name: string;
    code: string;
    domain?: string;
    isActive: boolean;
    settings: TenantSettings;
    schemaName?: string;
    users: User[];
    organizations: Organization[];
    subscriptions: Subscription[];
    get isTrialing(): boolean;
    get activeSubscription(): Subscription | undefined;
}
