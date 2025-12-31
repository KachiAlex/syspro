import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '@syspro/database';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async findByTenant(tenantId: string): Promise<Organization[]> {
    return this.organizationRepository.find({
      where: { tenantId },
      relations: ['parent', 'children', 'users'],
      order: { name: 'ASC' },
    });
  }

  // Additional organization management methods will be implemented here
}