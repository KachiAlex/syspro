import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { runInitialSeed } from './initial-seed';

// Load environment variables
config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'syspro_user',
  password: process.env.DB_PASSWORD || 'syspro_password',
  database: process.env.DB_NAME || 'syspro_erp_dev',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runSeeds() {
  try {
    console.log('🔌 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    await runInitialSeed(AppDataSource);

    console.log('🏁 All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seed process failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run seeds if this file is executed directly
if (require.main === module) {
  runSeeds();
}

export { runSeeds };