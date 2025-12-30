import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  // Support connection string (for Neon, Supabase, Vercel Postgres, etc.)
  const connectionString =
    configService.get<string>('POSTGRES_URL') ||
    configService.get<string>('DATABASE_URL');

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (connectionString) {
    const shouldEnableSsl =
      connectionString.includes('sslmode=require') ||
      connectionString.includes('neon.tech') ||
      connectionString.includes('amazonaws.com');

    const entitiesPath = [__dirname + '/../**/*.entity{.ts,.js}'];

    const shouldDropSchema =
      configService.get<string>('DROP_SCHEMA_ON_SYNC') === 'true';

    // In production, disable sync and use migrations instead
    const shouldSync = isProduction 
      ? false 
      : configService.get<string>('ENABLE_SYNC') === 'true';

    return {
      type: 'postgres',
      url: connectionString,
      entities: entitiesPath,
      synchronize: shouldSync,
      dropSchema: shouldDropSchema,
      logging: configService.get<string>('NODE_ENV') === 'development',
      ssl: shouldEnableSsl ? { rejectUnauthorized: false } : false,
      extra: shouldEnableSsl
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : undefined,
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      migrationsRun: isProduction, // Auto-run migrations in production
    };
  }

  // Fallback to individual environment variables
  const entitiesPath = [__dirname + '/../**/*.entity{.ts,.js}'];

  const shouldDropSchema =
    configService.get<string>('DROP_SCHEMA_ON_SYNC') === 'true';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'syspro'),
    password: configService.get<string>('DB_PASSWORD', 'syspro_password'),
    database: configService.get<string>('DB_NAME', 'syspro_db'),
    entities: entitiesPath,
    synchronize: configService.get<string>('ENABLE_SYNC') === 'true',
    logging: configService.get<string>('NODE_ENV') === 'development',
    ssl: false,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  };
};

