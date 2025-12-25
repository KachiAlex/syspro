import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  // Support connection string (for Neon, Supabase, Vercel Postgres, etc.)
  const connectionString =
    configService.get<string>('POSTGRES_URL') ||
    configService.get<string>('DATABASE_URL');

  if (connectionString) {
    const shouldEnableSsl =
      connectionString.includes('sslmode=require') ||
      connectionString.includes('neon.tech') ||
      connectionString.includes('amazonaws.com');

    return {
      type: 'postgres',
      url: connectionString,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: configService.get<string>('ENABLE_SYNC') === 'true',
      logging: configService.get<string>('NODE_ENV') === 'development',
      ssl: shouldEnableSsl ? { rejectUnauthorized: false } : false,
      extra: shouldEnableSsl
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : undefined,
    };
  }

  // Fallback to individual environment variables
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'syspro'),
    password: configService.get<string>('DB_PASSWORD', 'syspro_password'),
    database: configService.get<string>('DB_NAME', 'syspro_db'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: configService.get<string>('ENABLE_SYNC') === 'true',
    logging: configService.get<string>('NODE_ENV') === 'development',
    ssl: false,
  };
};

