import { Controller, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimpleUser } from '../entities/simple-user.entity';
import * as bcrypt from 'bcrypt';

@Controller('seed')
export class SeedController {
  constructor(
    @InjectRepository(SimpleUser)
    private userRepository: Repository<SimpleUser>,
  ) {}

  @Post('admin')
  async createAdmin() {
    try {
      // Check if admin already exists
      const existingAdmin = await this.userRepository.findOne({
        where: { email: 'admin@syspro.com' },
      });

      if (existingAdmin) {
        return {
          success: true,
          message: 'Admin user already exists',
          credentials: {
            email: 'admin@syspro.com',
            password: 'Admin@123',
          },
        };
      }

      // Create admin user
      const hashedPassword = await bcrypt.hash('Admin@123', 10);
      
      const adminUser = this.userRepository.create({
        email: 'admin@syspro.com',
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
      });

      await this.userRepository.save(adminUser);

      return {
        success: true,
        message: 'Admin user created successfully',
        credentials: {
          email: 'admin@syspro.com',
          password: 'Admin@123',
          warning: 'CHANGE THIS PASSWORD IMMEDIATELY!',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create admin user',
        error: error.message,
      };
    }
  }
}