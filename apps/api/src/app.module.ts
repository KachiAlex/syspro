import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import * as redisStore from 'cache-manager-redis-store';

// Configuration
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';
import { appConfig } from './config/app.config';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';

// Shared
import { DatabaseModule } from './shared/database/database.module';

// Guards
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from './modules/auth/guards/tenant.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    DatabaseModule,

    // Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        if (redisUrl) {
          return {
            store: redisStore,
            url: redisUrl,
            ttl: 300, // 5 minutes default
          };
        }
        
        // Fallback to in-memory cache
        return {
          ttl: 300,
        };
      },
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get<number>('THROTTLE_TTL', 60),
        limit: configService.get<number>('THROTTLE_LIMIT', 100),
      }),
      inject: [ConfigService],
    }),

    // JWT
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    HealthModule,
    AuthModule,
    TenantModule,
    UserModule,
    OrganizationModule,
    AuditModule,
  ],
  providers: [
    // Global JWT authentication guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global tenant guard (applied after JWT guard)
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
  ],
})
export class AppModule {}