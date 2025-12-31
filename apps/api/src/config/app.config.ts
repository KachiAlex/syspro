import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME || 'Syspro ERP',
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Security
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Rate limiting
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  
  // File upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  
  // Pagination
  defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
  maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
  
  // Features
  enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
  enableMetrics: process.env.ENABLE_METRICS === 'true',
  maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
}));