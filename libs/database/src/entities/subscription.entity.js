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
exports.Subscription = exports.SubscriptionStatus = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const tenant_entity_1 = require("./tenant.entity");
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["CANCELED"] = "canceled";
    SubscriptionStatus["PAST_DUE"] = "past_due";
    SubscriptionStatus["UNPAID"] = "unpaid";
    SubscriptionStatus["TRIALING"] = "trialing";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
let Subscription = class Subscription extends base_entity_1.BaseEntity {
    status;
    planId;
    currentPeriodStart;
    currentPeriodEnd;
    cancelAtPeriodEnd;
    trialEnd;
    tenantId;
    tenant;
};
exports.Subscription = Subscription;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Subscription status',
        enum: SubscriptionStatus,
        example: SubscriptionStatus.ACTIVE,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: SubscriptionStatus,
        default: SubscriptionStatus.TRIALING,
    }),
    (0, class_validator_1.IsEnum)(SubscriptionStatus),
    __metadata("design:type", String)
], Subscription.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Plan identifier',
        example: 'pro-monthly',
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Subscription.prototype, "planId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Current billing period start',
        example: '2023-12-01T00:00:00.000Z',
    }),
    (0, typeorm_1.Column)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Subscription.prototype, "currentPeriodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Current billing period end',
        example: '2023-12-31T23:59:59.000Z',
    }),
    (0, typeorm_1.Column)({ type: 'timestamp with time zone' }),
    __metadata("design:type", Date)
], Subscription.prototype, "currentPeriodEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether to cancel at period end',
        example: false,
    }),
    (0, typeorm_1.Column)({ default: false }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], Subscription.prototype, "cancelAtPeriodEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Trial end date',
        example: '2023-12-15T23:59:59.000Z',
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'timestamp with time zone', nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Date)
], Subscription.prototype, "trialEnd", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], Subscription.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, (tenant) => tenant.subscriptions, { onDelete: 'CASCADE' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], Subscription.prototype, "tenant", void 0);
exports.Subscription = Subscription = __decorate([
    (0, typeorm_1.Entity)('subscriptions'),
    (0, typeorm_1.Index)(['tenantId']),
    (0, typeorm_1.Index)(['status'])
], Subscription);
//# sourceMappingURL=subscription.entity.js.map