import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Module, ModuleStatus } from './entities/module.entity';
import { TenantModule } from './entities/tenant-module.entity';
import { TenantContextService } from '../../modules/tenant/tenant-context.service';
import { EventPublisherService } from '../../shared/events/event-publisher.service';
import { EventType } from '../../shared/events/event.types';

@Injectable()
export class ModuleRegistryService {
  constructor(
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    private readonly tenantContext: TenantContextService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async registerModule(moduleData: {
    name: string;
    code: string;
    version: string;
    description?: string;
    author?: string;
    dependencies?: string[];
    metadata?: Record<string, any>;
  }): Promise<Module> {
    const existing = await this.moduleRepository.findOne({
      where: { code: moduleData.code },
    });

    if (existing) {
      throw new BadRequestException(`Module with code ${moduleData.code} already exists`);
    }

    const module = this.moduleRepository.create(moduleData);
    const saved = await this.moduleRepository.save(module);

    await this.eventPublisher.publish(EventType.MODULE_REGISTERED, {
      moduleId: saved.id,
      moduleCode: saved.code,
      version: saved.version,
    });

    return saved;
  }

  async findAll(): Promise<Module[]> {
    return this.moduleRepository.find({
      where: { status: ModuleStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Module> {
    const module = await this.moduleRepository.findOne({ where: { id } });

    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }

    return module;
  }

  async findByCode(code: string): Promise<Module> {
    const module = await this.moduleRepository.findOne({ where: { code } });

    if (!module) {
      throw new NotFoundException(`Module with code ${code} not found`);
    }

    return module;
  }

  async enableModuleForTenant(moduleId: string): Promise<TenantModule> {
    const tenantId = this.tenantContext.requireTenant();
    const module = await this.findOne(moduleId);

    // Check dependencies
    if (module.dependencies && module.dependencies.length > 0) {
      const enabledModules = await this.getEnabledModulesForTenant();
      const enabledCodes = enabledModules.map((m) => m.module.code);

      const missingDeps = module.dependencies.filter(
        (dep) => !enabledCodes.includes(dep),
      );

      if (missingDeps.length > 0) {
        throw new BadRequestException(
          `Missing dependencies: ${missingDeps.join(', ')}`,
        );
      }
    }

    let tenantModule = await this.tenantModuleRepository.findOne({
      where: { moduleId, tenantId },
    });

    if (tenantModule) {
      tenantModule.isEnabled = true;
      tenantModule.enabledAt = new Date();
      tenantModule.disabledAt = null;
    } else {
      tenantModule = this.tenantModuleRepository.create({
        moduleId,
        tenantId,
        isEnabled: true,
        enabledAt: new Date(),
      });
    }

    const saved = await this.tenantModuleRepository.save(tenantModule);

    await this.eventPublisher.publish(EventType.MODULE_ENABLED, {
      moduleId,
      moduleName: module.name,
      tenantId,
    });

    return saved;
  }

  async disableModuleForTenant(moduleId: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();
    const module = await this.findOne(moduleId);

    if (module.isSystemModule) {
      throw new BadRequestException('Cannot disable system module');
    }

    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { moduleId, tenantId },
    });

    if (tenantModule) {
      tenantModule.isEnabled = false;
      tenantModule.disabledAt = new Date();
      await this.tenantModuleRepository.save(tenantModule);

      await this.eventPublisher.publish(EventType.MODULE_DISABLED, {
        moduleId,
        moduleName: module.name,
        tenantId,
      });
    }
  }

  async getEnabledModulesForTenant(): Promise<TenantModule[]> {
    const tenantId = this.tenantContext.requireTenant();

    return this.tenantModuleRepository.find({
      where: { tenantId, isEnabled: true },
      relations: ['module'],
      order: { createdAt: 'ASC' },
    });
  }

  async isModuleEnabled(moduleCode: string): Promise<boolean> {
    const tenantId = this.tenantContext.getTenant();
    if (!tenantId) return false;

    const module = await this.moduleRepository.findOne({
      where: { code: moduleCode },
    });

    if (!module) return false;

    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { moduleId: module.id, tenantId, isEnabled: true },
    });

    return !!tenantModule;
  }

  async updateModuleVersion(moduleId: string, version: string): Promise<Module> {
    const module = await this.findOne(moduleId);
    module.version = version;
    const updated = await this.moduleRepository.save(module);

    await this.eventPublisher.publish(EventType.MODULE_UPDATED, {
      moduleId,
      version,
    });

    return updated;
  }
}

