import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '@syspro/database';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(
    tenantId: string,
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      tenantId,
      userId,
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
    });

    return this.auditLogRepository.save(auditLog);
  }

  async findByTenant(tenantId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  // Additional audit methods will be implemented here
}