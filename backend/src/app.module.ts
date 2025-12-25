import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { getRedisConfig } from './config/redis.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserEnhancedModule } from './core/user-service/user-enhanced.module';
import { RoleModule } from './core/role-service/role.module';
import { ModuleRegistryModule } from './core/module-registry/module-registry.module';
import { ConfigModule as ConfigServiceModule } from './core/config-service/config.module';
import { BillingModule } from './core/billing-service/billing.module';
import { SharedModule } from './shared/shared.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

const controllers: any[] = [AppController];

if (process.env.ENABLE_PLATFORM_SETUP === 'true') {
  const seedControllerPath = './scripts/' + 'seed-admin.controller';
  const { PlatformSetupController } = require(seedControllerPath);
  controllers.push(PlatformSetupController);
}

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    // Redis Cache
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getRedisConfig,
      inject: [ConfigService],
      isGlobal: true,
    }),
    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Application Modules
    TenantModule,
    SharedModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    // Core ERP Engine Services
    UserEnhancedModule,
    RoleModule,
    ModuleRegistryModule,
    ConfigServiceModule,
    BillingModule,
  ],
  controllers,
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
