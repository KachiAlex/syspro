import { Controller, Post, Body, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimpleUser } from '../entities/simple-user.entity';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class SimpleAuthController {
  constructor(
    @InjectRepository(SimpleUser)
    private userRepository: Repository<SimpleUser>,
  ) {}

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return { success: false, message: 'Invalid password' };
    }

    // Return success (no JWT for now, just simple response)
    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  @Get('users')
  async getUsers() {
    const users = await this.userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'createdAt'],
    });
    return { users };
  }
}