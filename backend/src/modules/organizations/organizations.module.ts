import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { Organization } from '../../entities/organization.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    TenantModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}

