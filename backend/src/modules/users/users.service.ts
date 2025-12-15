import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../entities/user.entity';
import { RegisterDto } from '../auth/dto/register.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createUserDto: RegisterDto | CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(organizationId?: string): Promise<User[]> {
    const tenantId = this.tenantContext.getTenant();
    const query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.organization', 'organization')
      .leftJoinAndSelect('user.subsidiary', 'subsidiary')
      .leftJoinAndSelect('user.department', 'department');

    if (tenantId) {
      query.where('user.tenantId = :tenantId', { tenantId });
    }

    if (organizationId) {
      query.andWhere('user.organizationId = :organizationId', { organizationId });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['organization', 'subsidiary', 'department'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['organization', 'subsidiary', 'department'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      lastLoginAt: new Date(),
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
  }

  async activate(id: string): Promise<User> {
    return this.update(id, { status: UserStatus.ACTIVE });
  }

  async deactivate(id: string): Promise<User> {
    return this.update(id, { status: UserStatus.INACTIVE });
  }
}

