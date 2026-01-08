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
exports.Organization = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const tenant_entity_1 = require("./tenant.entity");
const user_entity_1 = require("./user.entity");
let Organization = class Organization extends base_entity_1.BaseEntity {
    name;
    description;
    code;
    isActive;
    settings;
    email;
    phone;
    address;
    tenantId;
    tenant;
    parent;
    children;
    users;
    get userCount() {
        return this.users?.length || 0;
    }
    get hasChildren() {
        return this.children?.length > 0;
    }
    get level() {
        let level = 0;
        let current = this.parent;
        while (current) {
            level++;
            current = current.parent;
        }
        return level;
    }
    getPath() {
        const path = [];
        let current = this;
        while (current) {
            path.unshift(current.name);
            current = current.parent;
        }
        return path;
    }
    getFullPath() {
        return this.getPath().join(' > ');
    }
};
exports.Organization = Organization;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization name',
        example: 'Sales Department',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 100),
    __metadata("design:type", String)
], Organization.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization description',
        example: 'Handles all sales operations and customer relationships',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Organization.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization code or identifier',
        example: 'SALES_DEPT',
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Organization.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the organization is active',
        example: true,
    }),
    (0, typeorm_1.Column)({ default: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], Organization.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization-specific settings',
        example: {
            allowSubOrganizations: true,
            maxUsers: 100,
            features: ['crm', 'reports'],
        },
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], Organization.prototype, "settings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization contact email',
        example: 'sales@acme.com',
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Organization.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization contact phone',
        example: '+1234567890',
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Organization.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Organization address',
        example: '123 Business St, City, State 12345',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Organization.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], Organization.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, (tenant) => tenant.organizations, { onDelete: 'CASCADE' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], Organization.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.TreeParent)(),
    __metadata("design:type", Organization)
], Organization.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.TreeChildren)(),
    __metadata("design:type", Array)
], Organization.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_entity_1.User, (user) => user.organization),
    __metadata("design:type", Array)
], Organization.prototype, "users", void 0);
exports.Organization = Organization = __decorate([
    (0, typeorm_1.Entity)('organizations'),
    (0, typeorm_1.Tree)('materialized-path'),
    (0, typeorm_1.Index)(['tenantId']),
    (0, typeorm_1.Index)(['tenantId', 'name'])
], Organization);
//# sourceMappingURL=organization.entity.js.map