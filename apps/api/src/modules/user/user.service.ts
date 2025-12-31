import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@syspro/database';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string, tenantId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, tenantId },
      relations: ['roles', 'organization'],
    });
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email, tenantId },
      relations: ['roles', 'organization'],
    });
  }

  // Additional user management methods will be implemented here
}