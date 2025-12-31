import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, UserRole, Organization } from '@syspro/database';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRole, Organization])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}