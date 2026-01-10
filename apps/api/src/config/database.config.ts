import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

import {
  Tenant,
  User,
  UserRole,
  Permission,
  Organization,
  Subscription,
  AuditLog,
  ModuleRegistry,
  TenantModule,
  ModuleUsageAnalytics,
} from '@syspro/database';
import { SnakeNamingStrategy } from '../shared/database/snake-naming.strategy';

const rootDir = path.resolve(__dirname, '..', '..', '..');
const distDir = path.join(rootDir, 'dist', 'libs', 'database');
const entityPatterns = [
  path.join(rootDir, 'apps', 'api', 'dist', 'apps', 'api', 'src', '**', '*.entity{.ts,.js}'),
  path.join(distDir, '**', '*.entity.js'),
];
const srcMigrationPatterns = [
  path.join(rootDir, 'apps', 'api', 'src', 'database', 'migrations', '*{.ts,.js}'),
  path.join(rootDir, 'libs', 'database', 'src', 'migrations', '*{.ts,.js}'),
];
const distMigrationPatterns = [
  path.join(rootDir, 'apps', 'api', 'dist', 'apps', 'api', 'src', 'database', 'migrations', '*{.ts,.js}'),
  path.join(distDir, 'database', 'migrations', '*{.ts,.js}'),
];

const entityClasses = [
  Tenant,
  User,
  UserRole,
  Permission,
  Organization,
  Subscription,
  AuditLog,
  ModuleRegistry,
  TenantModule,
  ModuleUsageAnalytics,
];

export const databaseConfig = registerAs('database', (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  const config: TypeOrmModuleOptions = {
    type: 'postgres',
    url: process.env.DATABASE_URL,

    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'syspro_user',
    password: process.env.DB_PASSWORD || 'syspro_password',
    database: process.env.DB_NAME || 'syspro_erp_dev',
    entities: isProduction ? entityClasses : entityPatterns,
    migrations: isProduction ? distMigrationPatterns : srcMigrationPatterns,
    namingStrategy: new SnakeNamingStrategy(),

    synchronize: !isProduction && process.env.NODE_ENV === 'development',
    logging: isProduction ? ['error'] : ['query', 'error'],
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    extra: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS || (isProduction ? '5' : '100'), 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || (isProduction ? '10000' : '30000'), 10),
      // Serverless optimizations
      ...(isProduction && {
        statement_timeout: 30000,
        query_timeout: 30000,
        connectionTimeoutMillis: 30000,
      }),
    },
  };

  return config;
});

// DataSource for migrations
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'syspro_user',
  password: process.env.DB_PASSWORD || 'syspro_password',
  database: process.env.DB_NAME || 'syspro_erp_dev',
  entities: process.env.NODE_ENV === 'production' ? entityClasses : entityPatterns,
  migrations: process.env.NODE_ENV === 'production' ? distMigrationPatterns : srcMigrationPatterns,

  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
} as DataSourceOptions);