import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Connection options
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  
  // Cache TTL settings
  defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '300', 10), // 5 minutes
  sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10), // 24 hours
  cacheTtl: parseInt(process.env.REDIS_CACHE_TTL || '1800', 10), // 30 minutes
}));