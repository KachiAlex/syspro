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
exports.ModuleUsageAnalytics = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const base_entity_1 = require("./base.entity");
const tenant_entity_1 = require("./tenant.entity");
let ModuleUsageAnalytics = class ModuleUsageAnalytics extends base_entity_1.BaseEntity {
    tenantId;
    moduleName;
    endpoint;
    requestCount;
    responseTimeMs;
    errorCount;
    date;
    hour;
    metadata;
    tenant;
    get successRate() {
        if (this.requestCount === 0)
            return 0;
        return ((this.requestCount - this.errorCount) / this.requestCount) * 100;
    }
    get hasErrors() {
        return this.errorCount > 0;
    }
    get isHighTraffic() {
        return this.requestCount > 100;
    }
    get averageResponseTime() {
        return this.responseTimeMs || 0;
    }
    static createKey(tenantId, moduleName, endpoint, date, hour) {
        const dateStr = date.toISOString().split('T')[0];
        return `${tenantId}:${moduleName}:${endpoint || 'all'}:${dateStr}:${hour}`;
    }
    static fromApiCall(tenantId, moduleName, endpoint, responseTimeMs, isError = false, metadata) {
        const now = new Date();
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const hour = now.getHours();
        return {
            tenantId,
            moduleName,
            endpoint,
            requestCount: 1,
            responseTimeMs,
            errorCount: isError ? 1 : 0,
            date,
            hour,
            metadata,
        };
    }
    incrementUsage(responseTimeMs, isError = false) {
        this.requestCount += 1;
        if (responseTimeMs !== undefined) {
            const totalTime = (this.responseTimeMs || 0) * (this.requestCount - 1) + responseTimeMs;
            this.responseTimeMs = Math.round(totalTime / this.requestCount);
        }
        if (isError) {
            this.errorCount += 1;
        }
    }
    merge(other) {
        const totalRequests = this.requestCount + other.requestCount;
        if (totalRequests > 0) {
            const thisTotal = (this.responseTimeMs || 0) * this.requestCount;
            const otherTotal = (other.responseTimeMs || 0) * other.requestCount;
            this.responseTimeMs = Math.round((thisTotal + otherTotal) / totalRequests);
        }
        this.requestCount = totalRequests;
        this.errorCount += other.errorCount;
        if (other.metadata) {
            this.metadata = { ...this.metadata, ...other.metadata };
        }
    }
};
exports.ModuleUsageAnalytics = ModuleUsageAnalytics;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    (0, typeorm_1.Column)('uuid'),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ModuleUsageAnalytics.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Module name',
        example: 'crm',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({ length: 100 }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModuleUsageAnalytics.prototype, "moduleName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'API endpoint accessed',
        example: '/api/v1/crm/leads',
        maxLength: 200,
        required: false,
    }),
    (0, typeorm_1.Column)({ length: 200, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ModuleUsageAnalytics.prototype, "endpoint", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of requests in this time period',
        example: 45,
    }),
    (0, typeorm_1.Column)({ default: 1 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModuleUsageAnalytics.prototype, "requestCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Average response time in milliseconds',
        example: 150,
        required: false,
    }),
    (0, typeorm_1.Column)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModuleUsageAnalytics.prototype, "responseTimeMs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of errors in this time period',
        example: 2,
    }),
    (0, typeorm_1.Column)({ default: 0 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], ModuleUsageAnalytics.prototype, "errorCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Date of the analytics record',
        example: '2023-12-01',
    }),
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", Date)
], ModuleUsageAnalytics.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Hour of the day (0-23)',
        example: 14,
    }),
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(23),
    __metadata("design:type", Number)
], ModuleUsageAnalytics.prototype, "hour", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Additional metadata for the analytics record',
        example: {
            userAgent: 'Mozilla/5.0...',
            ipCountry: 'US',
            deviceType: 'desktop',
        },
        required: false,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], ModuleUsageAnalytics.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'tenantId' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], ModuleUsageAnalytics.prototype, "tenant", void 0);
exports.ModuleUsageAnalytics = ModuleUsageAnalytics = __decorate([
    (0, typeorm_1.Entity)('module_usage_analytics'),
    (0, typeorm_1.Index)(['tenantId', 'date']),
    (0, typeorm_1.Index)(['moduleName', 'date']),
    (0, typeorm_1.Index)(['tenantId', 'moduleName', 'endpoint', 'date', 'hour'], { unique: true })
], ModuleUsageAnalytics);
//# sourceMappingURL=module-usage-analytics.entity.js.map