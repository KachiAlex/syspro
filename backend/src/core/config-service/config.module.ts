import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { Configuration } from './entities/config.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { TenantModule } from '../../modules/tenant/tenant.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Configuration, FeatureFlag]),
    TenantModule,
    SharedModule,
  ],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

