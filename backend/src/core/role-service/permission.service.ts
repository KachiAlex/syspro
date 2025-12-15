import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission, PermissionResource, PermissionAction } from './entities/permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { isActive: true },
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    return permission;
  }

  async findByResource(resource: PermissionResource): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { resource, isActive: true },
    });
  }

  async seedDefaultPermissions(): Promise<void> {
    const resources = Object.values(PermissionResource);
    const actions = Object.values(PermissionAction);

    const permissions: Permission[] = [];

    for (const resource of resources) {
      for (const action of actions) {
        const code = `${resource}:${action}`;
        const existing = await this.permissionRepository.findOne({
          where: { code },
        });

        if (!existing) {
          permissions.push(
            this.permissionRepository.create({
              name: `${resource} ${action}`,
              code,
              resource,
              action,
              description: `Permission to ${action.toLowerCase()} ${resource.toLowerCase()}`,
            }),
          );
        }
      }
    }

    if (permissions.length > 0) {
      await this.permissionRepository.save(permissions);
    }
  }
}

