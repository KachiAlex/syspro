import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { License } from '../entities/license.entity';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { TenantContextService } from '../../../modules/tenant/tenant-context.service';
import { EventPublisherService } from '../../../shared/events/event-publisher.service';
import { EventType } from '../../../shared/events/event.types';

@Injectable()
export class LicensingService {
  constructor(
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private readonly tenantContext: TenantContextService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async enableModule(
    moduleKey: string,
    quota?: number,
    expiresAt?: Date,
  ): Promise<License> {
    const tenantId = this.tenantContext.requireTenant();

    // Check if subscription allows this module
    const subscription = await this.subscriptionRepository.findOne({
      where: { tenantId, status: SubscriptionStatus.ACTIVE },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription found');
    }

    // Check if module is included in plan features
    const planFeatures = subscription.plan.features || {};
    if (!planFeatures[moduleKey] && !planFeatures['*']) {
      throw new BadRequestException(
        `Module ${moduleKey} is not included in current plan`,
      );
    }

    let license = await this.licenseRepository.findOne({
      where: { tenantId, moduleKey },
    });

    if (license) {
      license.enabled = true;
      license.quota = quota || license.quota;
      license.expiresAt = expiresAt || license.expiresAt;
      license.startedAt = license.startedAt || new Date();
    } else {
      license = this.licenseRepository.create({
        tenantId,
        moduleKey,
        enabled: true,
        quota,
        expiresAt,
        startedAt: new Date(),
      });
    }

    const saved = await this.licenseRepository.save(license);

    await this.eventPublisher.publish(EventType.MODULE_ENABLED, {
      tenantId,
      moduleKey,
      licenseId: saved.id,
    });

    return saved;
  }

  async disableModule(moduleKey: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();

    const license = await this.licenseRepository.findOne({
      where: { tenantId, moduleKey },
    });

    if (!license) {
      throw new NotFoundException(`License for module ${moduleKey} not found`);
    }

    license.enabled = false;
    await this.licenseRepository.save(license);

    await this.eventPublisher.publish(EventType.MODULE_DISABLED, {
      tenantId,
      moduleKey,
      licenseId: license.id,
    });
  }

  async checkLicense(moduleKey: string): Promise<boolean> {
    const tenantId = this.tenantContext.getTenant();
    if (!tenantId) return false;

    const license = await this.licenseRepository.findOne({
      where: { tenantId, moduleKey, enabled: true },
    });

    if (!license) return false;

    // Check expiration
    if (license.expiresAt && license.expiresAt < new Date()) {
      return false;
    }

    // Check quota
    if (license.quota && license.usedQuota >= license.quota) {
      return false;
    }

    return true;
  }

  async incrementUsage(moduleKey: string, amount: number = 1): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();

    const license = await this.licenseRepository.findOne({
      where: { tenantId, moduleKey, enabled: true },
    });

    if (!license) {
      throw new NotFoundException(`License for module ${moduleKey} not found`);
    }

    if (license.quota && license.usedQuota + amount > license.quota) {
      throw new BadRequestException('Quota exceeded');
    }

    license.usedQuota += amount;
    await this.licenseRepository.save(license);
  }

  async getLicenses(): Promise<License[]> {
    const tenantId = this.tenantContext.requireTenant();

    return this.licenseRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }
}

