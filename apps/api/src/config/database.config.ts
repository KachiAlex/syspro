import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

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
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
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
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
} as DataSourceOptions);