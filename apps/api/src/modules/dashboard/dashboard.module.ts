import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ModuleRegistryModule } from '../module-registry/module-registry.module';

@Module({
  imports: [ModuleRegistryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
