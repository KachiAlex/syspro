import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { UserTenantAccess } from '../../entities/user-tenant-access.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantContextService } from './tenant-context.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../entities/user.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(UserTenantAccess)
    private userTenantAccessRepository: Repository<UserTenantAccess>,
    private readonly tenantContext: TenantContextService,
    private readonly usersService: UsersService,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if code already exists
    const existing = await this.tenantRepository.findOne({
      where: { code: createTenantDto.code },
    });

    if (existing) {
      throw new BadRequestException('Tenant with this code already exists');
    }

    const tenant = this.tenantRepository.create(createTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async findByCode(code: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { code },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with code ${code} not found`);
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);

    if (updateTenantDto.code && updateTenantDto.code !== tenant.code) {
      const existing = await this.tenantRepository.findOne({
        where: { code: updateTenantDto.code },
      });

      if (existing) {
        throw new BadRequestException('Tenant with this code already exists');
      }
    }

    Object.assign(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.remove(tenant);
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const accesses = await this.userTenantAccessRepository.find({
      where: { userId, isActive: true },
      relations: ['tenant'],
    });

    return accesses.map((access) => access.tenant);
  }

  async grantUserAccess(
    userId: string,
    tenantId: string,
  ): Promise<UserTenantAccess> {
    // Check if access already exists
    const existing = await this.userTenantAccessRepository.findOne({
      where: { userId, tenantId },
    });

    if (existing) {
      existing.isActive = true;
      return this.userTenantAccessRepository.save(existing);
    }

    const access = this.userTenantAccessRepository.create({
      userId,
      tenantId,
      isActive: true,
    });

    return this.userTenantAccessRepository.save(access);
  }

  async revokeUserAccess(userId: string, tenantId: string): Promise<void> {
    const access = await this.userTenantAccessRepository.findOne({
      where: { userId, tenantId },
    });

    if (access) {
      access.isActive = false;
      await this.userTenantAccessRepository.save(access);
    }
  }

  async validateUserTenantAccess(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const user = await this.usersService.findOne(userId);

    // Super admin and CEO can access any tenant
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.CEO) {
      return true;
    }

    // Check explicit access
    const access = await this.userTenantAccessRepository.findOne({
      where: { userId, tenantId, isActive: true },
    });

    if (access) {
      return true;
    }

    // Check if tenantId matches user's organizationId (default tenant)
    return user.organizationId === tenantId;
  }
}

