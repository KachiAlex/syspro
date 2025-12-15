import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEnhancedController } from './user-enhanced.controller';
import { UserEnhancedService } from './user-enhanced.service';
import { UserActivityService } from './user-activity.service';
import { UserActivity } from './entities/user-activity.entity';
import { User } from '../../entities/user.entity';
import { UsersModule } from '../../modules/users/users.module';
import { TenantModule } from '../../modules/tenant/tenant.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserActivity]),
    UsersModule,
    TenantModule,
    SharedModule,
  ],
  controllers: [UserEnhancedController],
  providers: [UserEnhancedService, UserActivityService],
  exports: [UserEnhancedService, UserActivityService],
})
export class UserEnhancedModule {}

