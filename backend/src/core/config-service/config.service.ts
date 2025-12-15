import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuration, ConfigScope, ConfigType } from './entities/config.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { TenantContextService } from '../../modules/tenant/tenant-context.service';
import { EventPublisherService } from '../../shared/events/event-publisher.service';
import { EventType } from '../../shared/events/event.types';
import * as crypto from 'crypto';

@Injectable()
export class ConfigService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(Configuration)
    private configRepository: Repository<Configuration>,
    @InjectRepository(FeatureFlag)
    private featureFlagRepository: Repository<FeatureFlag>,
    private readonly tenantContext: TenantContextService,
    private readonly eventPublisher: EventPublisherService,
  ) {
    // In production, get from environment variable
    this.encryptionKey =
      process.env.CONFIG_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  async setConfig(
    key: string,
    value: any,
    scope: ConfigScope = ConfigScope.TENANT,
    moduleId?: string,
    description?: string,
  ): Promise<Configuration> {
    const tenantId = this.tenantContext.getTenant();
    const type = this.detectType(value);
    const stringValue = this.serializeValue(value, type);

    let config = await this.configRepository.findOne({
      where: { key, scope, tenantId, moduleId },
    });

    if (config) {
      config.value = stringValue;
      config.type = type;
      config.description = description || config.description;
    } else {
      config = this.configRepository.create({
        key,
        value: stringValue,
        type,
        scope,
        tenantId: scope === ConfigScope.TENANT ? tenantId : null,
        moduleId,
        description,
      });
    }

    const saved = await this.configRepository.save(config);

    await this.eventPublisher.publish(EventType.CONFIG_UPDATED, {
      key,
      scope,
      tenantId,
    });

    return saved;
  }

  async getConfig(
    key: string,
    scope?: ConfigScope,
    moduleId?: string,
  ): Promise<any> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = { key, isActive: true };

    if (scope) {
      where.scope = scope;
    }

    if (scope === ConfigScope.TENANT && tenantId) {
      where.tenantId = tenantId;
    }

    if (moduleId) {
      where.moduleId = moduleId;
    }

    const config = await this.configRepository.findOne({ where });

    if (!config) {
      return null;
    }

    return this.deserializeValue(config.value, config.type);
  }

  async getAllConfigs(scope?: ConfigScope, moduleId?: string): Promise<Configuration[]> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = { isActive: true };

    if (scope) {
      where.scope = scope;
    }

    if (scope === ConfigScope.TENANT && tenantId) {
      where.tenantId = tenantId;
    }

    if (moduleId) {
      where.moduleId = moduleId;
    }

    return this.configRepository.find({ where, order: { key: 'ASC' } });
  }

  async deleteConfig(key: string, scope?: ConfigScope): Promise<void> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = { key };

    if (scope) {
      where.scope = scope;
    }

    if (scope === ConfigScope.TENANT && tenantId) {
      where.tenantId = tenantId;
    }

    await this.configRepository.delete(where);
  }

  // Feature Flags
  async createFeatureFlag(
    key: string,
    name: string,
    description?: string,
  ): Promise<FeatureFlag> {
    const existing = await this.featureFlagRepository.findOne({ where: { key } });

    if (existing) {
      throw new BadRequestException(`Feature flag ${key} already exists`);
    }

    const flag = this.featureFlagRepository.create({
      key,
      name,
      description,
      isEnabled: false,
    });

    return this.featureFlagRepository.save(flag);
  }

  async toggleFeatureFlag(key: string, enabled: boolean): Promise<FeatureFlag> {
    const tenantId = this.tenantContext.getTenant();
    const flag = await this.featureFlagRepository.findOne({
      where: { key, tenantId: tenantId || null },
    });

    if (!flag) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    flag.isEnabled = enabled;
    flag.enabledAt = enabled ? new Date() : null;
    flag.disabledAt = enabled ? null : new Date();

    const saved = await this.featureFlagRepository.save(flag);

    await this.eventPublisher.publish(EventType.FEATURE_FLAG_TOGGLED, {
      key,
      enabled,
      tenantId,
    });

    return saved;
  }

  async isFeatureEnabled(key: string): Promise<boolean> {
    const tenantId = this.tenantContext.getTenant();
    const flag = await this.featureFlagRepository.findOne({
      where: { key, tenantId: tenantId || null },
    });

    return flag?.isEnabled || false;
  }

  // Helper methods
  private detectType(value: any): ConfigType {
    if (typeof value === 'boolean') return ConfigType.BOOLEAN;
    if (typeof value === 'number') return ConfigType.NUMBER;
    if (typeof value === 'object') return ConfigType.JSON;
    return ConfigType.STRING;
  }

  private serializeValue(value: any, type: ConfigType): string {
    if (type === ConfigType.JSON) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private deserializeValue(value: string, type: ConfigType): any {
    switch (type) {
      case ConfigType.BOOLEAN:
        return value === 'true';
      case ConfigType.NUMBER:
        return Number(value);
      case ConfigType.JSON:
        return JSON.parse(value);
      default:
        return value;
    }
  }

  private encrypt(value: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decrypt(encrypted: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

