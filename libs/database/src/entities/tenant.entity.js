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
exports.Tenant = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const user_entity_1 = require("./user.entity");
const organization_entity_1 = require("./organization.entity");
const subscription_entity_1 = require("./subscription.entity");
let Tenant = class Tenant extends base_entity_1.BaseEntity {
    name;
    code;
    domain;
    isActive;
    settings;
    schemaName;
    users;
    organizations;
    subscriptions;
    get isTrialing() {
        return this.subscriptions?.some((sub) => sub.status === 'trialing' && sub.trialEnd && sub.trialEnd > new Date()) || false;
    }
    get activeSubscription() {
        return this.subscriptions?.find((sub) => sub.status === 'active');
    }
};
exports.Tenant = Tenant;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant name',
        example: 'Acme Corporation',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 100),
    __metadata("design:type", String)
], Tenant.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unique tenant code',
        example: 'ACME_CORP',
        maxLength: 20,
    }),
    (0, typeorm_1.Column)({ length: 20, unique: true }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 20),
    (0, class_validator_1.Matches)(/^[A-Z0-9_]+$/, {
        message: 'Code must contain only uppercase letters, numbers, and underscores',
    }),
    __metadata("design:type", String)
], Tenant.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant domain (optional)',
        example: 'acme.syspro.com',
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true, unique: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Tenant.prototype, "domain", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the tenant is active',
        example: true,
    }),
    (0, typeorm_1.Column)({ default: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], Tenant.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant-specific settings and configuration',
        example: {
            timezone: 'UTC',
            currency: 'USD',
            dateFormat: 'YYYY-MM-DD',
            language: 'en',
            features: ['crm', 'inventory'],
        },
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], Tenant.prototype, "settings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Database schema name for this tenant',
        example: 'tenant_acme_corp',
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Tenant.prototype, "schemaName", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_entity_1.User, (user) => user.tenant),
    __metadata("design:type", Array)
], Tenant.prototype, "users", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => organization_entity_1.Organization, (organization) => organization.tenant),
    __metadata("design:type", Array)
], Tenant.prototype, "organizations", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => subscription_entity_1.Subscription, (subscription) => subscription.tenant),
    __metadata("design:type", Array)
], Tenant.prototype, "subscriptions", void 0);
exports.Tenant = Tenant = __decorate([
    (0, typeorm_1.Entity)('tenants'),
    (0, typeorm_1.Index)(['code'], { unique: true }),
    (0, typeorm_1.Index)(['domain'], { unique: true, where: 'domain IS NOT NULL' })
], Tenant);
//# sourceMappingURL=tenant.entity.js.map