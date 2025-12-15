// API endpoint to seed the platform via HTTP request
// This can be called from Vercel's serverless environment

import { seedPlatform } from './seed-platform';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../config/database.config';
import { ConfigService } from '@nestjs/config';

export async function createAdminViaAPI() {
  const configService = new ConfigService();
  const dbConfig = getDatabaseConfig(configService);
  
  const dataSource = new DataSource({
    ...dbConfig,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  } as any);

  try {
    console.log('Initializing database connection...');
    await dataSource.initialize();
    console.log('Database connected');
    
    await seedPlatform(dataSource);
    
    await dataSource.destroy();
    
    return {
      success: true,
      message: 'Platform seeded successfully',
      credentials: {
        email: 'admin@syspro.com',
        password: 'Admin@123',
        warning: 'CHANGE THIS PASSWORD IMMEDIATELY!',
      },
    };
  } catch (error) {
    console.error('Seed error:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    throw error;
  }
}

