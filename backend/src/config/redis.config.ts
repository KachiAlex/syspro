import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';

export const getRedisConfig = async (
  configService: ConfigService,
): Promise<CacheModuleOptions> => {
  const redisUrl = configService.get<string>('REDIS_URL');
  const redisHost = configService.get<string>('REDIS_HOST');

  // If no Redis configuration is provided (e.g., on Vercel), fall back to in-memory cache
  if (!redisUrl && !redisHost) {
    return {
      ttl: 300,
    };
  }

  if (redisUrl) {
    return {
      store: redisStore as any,
      url: redisUrl,
      ttl: 300,
    };
  }

  return {
    store: redisStore as any,
    host: redisHost || 'localhost',
    port: configService.get<number>('REDIS_PORT', 6379),
    ttl: 300,
  };
};

