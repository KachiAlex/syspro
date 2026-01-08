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
exports.UserRole = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const tenant_entity_1 = require("./tenant.entity");
const user_entity_1 = require("./user.entity");
const permission_entity_1 = require("./permission.entity");
let UserRole = class UserRole extends base_entity_1.BaseEntity {
    name;
    description;
    code;
    tenantId;
    tenant;
    users;
    permissions;
};
exports.UserRole = UserRole;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Role name',
        example: 'Admin',
        maxLength: 50,
    }),
    (0, typeorm_1.Column)({ length: 50 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], UserRole.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Role description',
        example: 'Full system administrator access',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserRole.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Role code for programmatic access',
        example: 'ADMIN',
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UserRole.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], UserRole.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, { onDelete: 'CASCADE' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], UserRole.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => user_entity_1.User, (user) => user.roles),
    __metadata("design:type", Array)
], UserRole.prototype, "users", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => permission_entity_1.Permission, (permission) => permission.role),
    __metadata("design:type", Array)
], UserRole.prototype, "permissions", void 0);
exports.UserRole = UserRole = __decorate([
    (0, typeorm_1.Entity)('user_roles'),
    (0, typeorm_1.Index)(['tenantId']),
    (0, typeorm_1.Index)(['tenantId', 'name'], { unique: true })
], UserRole);
//# sourceMappingURL=user-role.entity.js.map