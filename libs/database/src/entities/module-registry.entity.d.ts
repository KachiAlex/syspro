import { BaseEntity } from './base.entity';
import { TenantModule } from './tenant-module.entity';
export declare enum ModuleCategory {
    CORE = "core",
    BUSINESS = "business",
    INTEGRATION = "integration",
    ANALYTICS = "analytics"
}
export declare enum PricingModel {
    FREE = "free",
    FLAT_RATE = "flat_rate",
    PER_USER = "per_user",
    USAGE_BASED = "usage_based"
}
export declare class ModuleRegistry extends BaseEntity {
    name: string;
    displayName: string;
    description?: string;
    category: ModuleCategory;
    version: string;
    isActive: boolean;
    isCore: boolean;
    pricingModel?: PricingModel;
    basePrice: number;
    perUserPrice: number;
    dependencies: string[];
    optionalDependencies: string[];
    configurationSchema: Record<string, any>;
    featureFlags: Record<string, any>;
    apiEndpoints: string[];
    tenantModules: TenantModule[];
    get isFreeTier(): boolean;
    get hasDependencies(): boolean;
    get hasOptionalDependencies(): boolean;
    validateConfiguration(config: Record<string, any>): boolean;
    getDefaultConfiguration(): Record<string, any>;
    getDefaultFeatureFlags(): Record<string, boolean>;
}
