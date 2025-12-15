import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

export const getRedisConfig = async (
  configService: ConfigService,
): Promise<CacheModuleOptions> => ({
  store: redisStore as any,
  host: configService.get<string>('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
  ttl: 300, // 5 minutes default TTL
});


