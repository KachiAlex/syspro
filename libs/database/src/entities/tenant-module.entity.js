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
exports.TenantModule = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const tenant_entity_1 = require("./tenant.entity");
const user_entity_1 = require("./user.entity");
const module_registry_entity_1 = require("./module-registry.entity");
let TenantModule = class TenantModule extends base_entity_1.BaseEntity {
    tenantId;
    moduleName;
    isEnabled;
    version;
    configuration;
    featureFlags;
    enabledAt;
    enabledBy;
    disabledAt;
    disabledBy;
    auditTrail;
    tenant;
    moduleRegistry;
    enabledByUser;
    disabledByUser;
    get isCurrentlyEnabled() {
        return this.isEnabled && !this.disabledAt;
    }
    get enablementDuration() {
        if (!this.enabledAt)
            return null;
        const endDate = this.disabledAt || new Date();
        return endDate.getTime() - this.enabledAt.getTime();
    }
    get hasCustomConfiguration() {
        return Object.keys(this.configuration).length > 0;
    }
    get enabledFeatureFlags() {
        return Object.entries(this.featureFlags)
            .filter(([_, enabled]) => enabled)
            .map(([flag, _]) => flag);
    }
    enable(userId) {
        this.isEnabled = true;
        this.enabledAt = new Date();
        this.enabledBy = userId;
        this.disabledAt = null;
        this.disabledBy = null;
    }
    disable(userId) {
        this.isEnabled = false;
        this.disabledAt = new Date();
        this.disabledBy = userId;
    }
    updateConfiguration(config) {
        this.configuration = { ...this.configuration, ...config };
    }
    toggleFeatureFlag(flagName, enabled) {
        this.featureFlags = {
            ...this.featureFlags,
            [flagName]: enabled,
        };
    }
    isFeatureEnabled(flagName) {
        return this.featureFlags[flagName] || false;
    }
    getConfigurationValue(key, defaultValue) {
        return this.configuration[key] ?? defaultValue;
    }
};
exports.TenantModule = TenantModule;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    (0, typeorm_1.Column)('uuid'),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TenantModule.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Module name',
        example: 'crm',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], TenantModule.prototype, "moduleName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the module is currently enabled for this tenant',
        example: true,
    }),
    (0, typeorm_1.Column)({ default: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], TenantModule.prototype, "isEnabled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Module version enabled for this tenant',
        example: '1.2.3',
        maxLength: 20,
    }),
    (0, typeorm_1.Column)({ length: 20 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d+\.\d+\.\d+$/, {
        message: 'Version must follow semantic versioning (e.g., 1.2.3)',
    }),
    __metadata("design:type", String)
], TenantModule.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant-specific module configuration',
        example: {
            maxLeads: 500,
            enableAutoAssignment: false,
            customFields: ['industry', 'company_size'],
        },
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TenantModule.prototype, "configuration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant-specific feature flag settings',
        example: {
            advancedReporting: true,
            mobileApp: false,
            customDashboard: true,
        },
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TenantModule.prototype, "featureFlags", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'When the module was enabled',
        example: '2023-12-01T10:00:00.000Z',
    }),
    (0, typeorm_1.Column)({ type: 'timestamp with time zone', default: () => 'NOW()' }),
    __metadata("design:type", Date)
], TenantModule.prototype, "enabledAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'User who enabled the module',
        example: '123e4567-e89b-12d3-a456-426614174001',
        required: false,
    }),
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TenantModule.prototype, "enabledBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'When the module was disabled',
        example: '2023-12-15T15:30:00.000Z',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'timestamp with time zone', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], TenantModule.prototype, "disabledAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'User who disabled the module',
        example: '123e4567-e89b-12d3-a456-426614174002',
        required: false,
    }),
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TenantModule.prototype, "disabledBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Configuration and feature flag change history',
        example: [
            {
                timestamp: '2024-01-01T12:00:00.000Z',
                userId: 'user-id',
                action: 'update',
                field: 'featureFlags.advancedReporting',
                oldValue: false,
                newValue: true,
            },
        ],
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], TenantModule.prototype, "auditTrail", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'tenantId' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], TenantModule.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => module_registry_entity_1.ModuleRegistry, (module) => module.tenantModules),
    (0, typeorm_1.JoinColumn)({ name: 'moduleName', referencedColumnName: 'name' }),
    __metadata("design:type", module_registry_entity_1.ModuleRegistry)
], TenantModule.prototype, "moduleRegistry", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'enabledBy' }),
    __metadata("design:type", user_entity_1.User)
], TenantModule.prototype, "enabledByUser", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'disabledBy' }),
    __metadata("design:type", user_entity_1.User)
], TenantModule.prototype, "disabledByUser", void 0);
exports.TenantModule = TenantModule = __decorate([
    (0, typeorm_1.Entity)('tenant_modules'),
    (0, typeorm_1.Index)(['tenantId', 'moduleName'], { unique: true }),
    (0, typeorm_1.Index)(['tenantId', 'isEnabled']),
    (0, typeorm_1.Index)(['moduleName'])
], TenantModule);
//# sourceMappingURL=tenant-module.entity.js.map