import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MeterEvent } from '../entities/meter-event.entity';
import { TenantContextService } from '../../../modules/tenant/tenant-context.service';

export interface UsageSummary {
  eventType: string;
  totalValue: number;
  count: number;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class MeteringService {
  constructor(
    @InjectRepository(MeterEvent)
    private meterEventRepository: Repository<MeterEvent>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async recordEvent(
    eventType: string,
    value: number = 1,
    meta?: Record<string, any>,
  ): Promise<MeterEvent> {
    const tenantId = this.tenantContext.requireTenant();

    const event = this.meterEventRepository.create({
      tenantId,
      eventType,
      value,
      meta,
      recordedAt: new Date(),
    });

    return this.meterEventRepository.save(event);
  }

  async getUsageSummary(
    eventType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageSummary> {
    const tenantId = this.tenantContext.requireTenant();

    const events = await this.meterEventRepository.find({
      where: {
        tenantId,
        eventType,
        recordedAt: Between(startDate, endDate),
      },
    });

    const totalValue = events.reduce((sum, event) => sum + event.value, 0);

    return {
      eventType,
      totalValue,
      count: events.length,
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  async getUsageByEventType(
    startDate: Date,
    endDate: Date,
  ): Promise<UsageSummary[]> {
    const tenantId = this.tenantContext.requireTenant();

    const events = await this.meterEventRepository.find({
      where: {
        tenantId,
        recordedAt: Between(startDate, endDate),
      },
    });

    // Aggregate by event type
    const summaryMap = new Map<string, UsageSummary>();

    events.forEach((event) => {
      const existing = summaryMap.get(event.eventType);
      if (existing) {
        existing.totalValue += event.value;
        existing.count += 1;
      } else {
        summaryMap.set(event.eventType, {
          eventType: event.eventType,
          totalValue: event.value,
          count: 1,
          periodStart: startDate,
          periodEnd: endDate,
        });
      }
    });

    return Array.from(summaryMap.values());
  }

  async getCurrentPeriodUsage(): Promise<UsageSummary[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.getUsageByEventType(startOfMonth, endOfMonth);
  }
}

