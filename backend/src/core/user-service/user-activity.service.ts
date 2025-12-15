import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivity, ActivityType } from './entities/user-activity.entity';
import { TenantContextService } from '../../modules/tenant/tenant-context.service';

@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivity)
    private activityRepository: Repository<UserActivity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async logActivity(
    userId: string,
    activityType: ActivityType,
    description: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserActivity> {
    const tenantId = this.tenantContext.requireTenant();

    const activity = this.activityRepository.create({
      userId,
      tenantId,
      activityType,
      description,
      metadata,
      ipAddress,
      userAgent,
    });

    return this.activityRepository.save(activity);
  }

  async getUserActivities(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const tenantId = this.tenantContext.requireTenant();
    const skip = (page - 1) * limit;

    const [activities, total] = await this.activityRepository.findAndCount({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecentActivities(userId: string, limit: number = 10) {
    const tenantId = this.tenantContext.requireTenant();

    return this.activityRepository.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

