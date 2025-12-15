import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    const tenantId = this.tenantContext.requireTenant();
    const organization = this.organizationsRepository.create({
      ...createOrganizationDto,
      tenantId,
    });
    return this.organizationsRepository.save(organization);
  }

  async findAll(): Promise<Organization[]> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = {};
    
    if (tenantId) {
      where.tenantId = tenantId;
    }

    return this.organizationsRepository.find({
      where,
      relations: ['subsidiaries', 'users'],
    });
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizationsRepository.findOne({
      where: { id },
      relations: ['subsidiaries', 'users'],
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);
    Object.assign(organization, updateOrganizationDto);
    return this.organizationsRepository.save(organization);
  }

  async remove(id: string): Promise<void> {
    const organization = await this.findOne(id);
    await this.organizationsRepository.remove(organization);
  }
}

