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
exports.Permission = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const user_role_entity_1 = require("./user-role.entity");
let Permission = class Permission extends base_entity_1.BaseEntity {
    tenantId;
    name;
    description;
    resource;
    action;
    isActive;
    metadata;
    conditions;
    roleId;
    role;
};
exports.Permission = Permission;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant that owns the permission',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    (0, typeorm_1.Column)('uuid'),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], Permission.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unique permission identifier (module:resource:action)',
        example: 'crm:leads:read',
    }),
    (0, typeorm_1.Column)({ length: 150 }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Permission.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Human readable description',
        example: 'Allows viewing CRM leads',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Permission.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Resource being protected',
        example: 'users',
    }),
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Permission.prototype, "resource", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Action being performed',
        example: 'create',
    }),
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], Permission.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the permission is currently active',
        example: true,
        required: false,
    }),
    (0, typeorm_1.Column)({ default: true }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], Permission.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Additional metadata for module context',
        example: { moduleName: 'crm', isCore: false },
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], Permission.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Additional conditions for the permission',
        example: { ownResource: true },
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], Permission.prototype, "conditions", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], Permission.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_role_entity_1.UserRole, (role) => role.permissions, { onDelete: 'CASCADE' }),
    __metadata("design:type", user_role_entity_1.UserRole)
], Permission.prototype, "role", void 0);
exports.Permission = Permission = __decorate([
    (0, typeorm_1.Entity)('permissions'),
    (0, typeorm_1.Index)(['roleId']),
    (0, typeorm_1.Index)(['resource', 'action']),
    (0, typeorm_1.Index)(['tenantId', 'name'], { unique: true })
], Permission);
//# sourceMappingURL=permission.entity.js.map