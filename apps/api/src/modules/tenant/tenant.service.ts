import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '@syspro/database';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({
      where: { id },
      relations: ['organizations', 'subscriptions'],
    });
  }

  async findByCode(code: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({
      where: { code },
      relations: ['organizations', 'subscriptions'],
    });
  }

  // Additional tenant management methods will be implemented here
}