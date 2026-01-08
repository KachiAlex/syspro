"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleRegistry = exports.PricingModel = exports.ModuleCategory = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const tenant_module_entity_1 = require("./tenant-module.entity");
var ModuleCategory;
(function (ModuleCategory) {
    ModuleCategory["CORE"] = "core";
    ModuleCategory["BUSINESS"] = "business";
    ModuleCategory["INTEGRATION"] = "integration";
    ModuleCategory["ANALYTICS"] = "analytics";
})(ModuleCategory || (exports.ModuleCategory = ModuleCategory = {}));
var PricingModel;
(function (PricingModel) {
    PricingModel["FREE"] = "free";
    PricingModel["FLAT_RATE"] = "flat_rate";
    PricingModel["PER_USER"] = "per_user";
    PricingModel["USAGE_BASED"] = "usage_based";
})(PricingModel || (exports.PricingModel = PricingModel = {}));
let ModuleRegistry = class ModuleRegistry extends base_entity_1.BaseEntity {
    name;
    displayName;
    description;
    category;
    version;
    isActive;
    isCore;
    pricingModel;
    basePrice;
    perUserPrice;
    dependencies;
    optionalDependencies;
    configurationSchema;
    featureFlags;
    apiEndpoints;
    tenantModules;
    get isFreeTier() {
        return this.pricingModel === PricingModel.FREE || this.basePrice === 0;
    }
    get hasDependencies() {
        return this.dependencies.length > 0;
    }
    get hasOptionalDependencies() {
        return this.optionalDependencies.length > 0;
    }
    validateConfiguration(config) {
        if (!this.configurationSchema || Object.keys(this.configurationSchema).length === 0) {
            return true;
        }
        return true;
    }
    getDefaultConfiguration() {
        const defaults = {};
        if (this.configurationSchema?.properties) {
            Object.entries(this.configurationSchema.properties).forEach(([key, schema]) => {
                if (schema.default !== undefined) {
                    defaults[key] = schema.default;
                }
            });
        }
        return defaults;
    }
    getDefaultFeatureFlags() {
        const defaults = {};
        Object.entries(this.featureFlags).forEach(([key, config]) => {
            defaults[key] = config.default || false;
        });
        return defaults;
    }
};
exports.ModuleRegistry = ModuleRegistry;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unique module identifier',
        example: 'crm',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100, unique: true }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    (0, class_validator_1.Matches)(/^[a-z0-9-_]+$/, {
        message: 'Module name must contain only lowercase letters, numbers, hyphens, and underscores',
    }),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Human-readable module name',
        example: 'Customer Relationship Management',
        maxLength: 200,
    }),
    (0, typeorm_1.Column)({ length: 200 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 200),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "displayName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Module description',
        example: 'Comprehensive CRM system for managing customer relationships, leads, and sales pipeline',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Module category',
        enum: ModuleCategory,
        example: ModuleCategory.BUSINESS,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ModuleCategory,
    }),
    (0, class_validator_1.IsEnum)(ModuleCategory),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Module version',
        example: '1.2.3',
        maxLength: 20,
    }),
    (0, typeorm_1.Column)({ length: 20 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+\.\d+\.\d+$/, {
        message: 'Version must follow semantic versioning (e.g., 1.2.3)',
    }),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the module is active and available',
        example: true,
    }),
    (0, typeorm_1.Column)({ default: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModuleRegistry.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether this is a core module that cannot be disabled',
        example: false,
    }),
    (0, typeorm_1.Column)({ default: false }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ModuleRegistry.prototype, "isCore", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Pricing model for the module',
        enum: PricingModel,
        example: PricingModel.PER_USER,
        required: false,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PricingModel,
        nullable: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(PricingModel),
    __metadata("design:type", String)
], ModuleRegistry.prototype, "pricingModel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Base price for flat rate pricing',
        example: 29.99,
    }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModuleRegistry.prototype, "basePrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Per-user price for per-user pricing',
        example: 9.99,
    }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModuleRegistry.prototype, "perUserPrice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Required module dependencies',
        example: ['auth', 'tenant-management'],
        type: [String],
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ModuleRegistry.prototype, "dependencies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Optional module dependencies that enhance functionality',
        example: ['notifications', 'analytics'],
        type: [String],
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ModuleRegistry.prototype, "optionalDependencies", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'JSON schema for module configuration',
        example: {
            type: 'object',
            properties: {
                maxLeads: { type: 'number', default: 1000 },
                enableAutoAssignment: { type: 'boolean', default: true },
            },
        },
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ModuleRegistry.prototype, "configurationSchema", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Available feature flags for the module',
        example: {
            advancedReporting: { default: false, description: 'Enable advanced reporting features' },
            mobileApp: { default: true, description: 'Enable mobile app integration' },
        },
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ModuleRegistry.prototype, "featureFlags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'API endpoints protected by this module',
        example: ['/api/v1/crm/*', '/api/v1/leads/*', '/api/v1/customers/*'],
        type: [String],
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: [] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ModuleRegistry.prototype, "apiEndpoints", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => tenant_module_entity_1.TenantModule, (tenantModule) => tenantModule.moduleRegistry),
    __metadata("design:type", Array)
], ModuleRegistry.prototype, "tenantModules", void 0);
exports.ModuleRegistry = ModuleRegistry = __decorate([
    (0, typeorm_1.Entity)('module_registry'),
    (0, typeorm_1.Index)(['category']),
    (0, typeorm_1.Index)(['isActive']),
    (0, typeorm_1.Index)(['name'], { unique: true })
], ModuleRegistry);
//# sourceMappingURL=module-registry.entity.js.map