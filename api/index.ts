import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../backend/src/app.module';
import express from 'express';

const server = express();
let app: any;

async function bootstrap() {
  if (!app) {
    console.log('🚀 Initializing NestJS application...');
    
    app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
      { logger: ['error', 'warn', 'log', 'debug'] }
    );

    // Global prefix
    app.setGlobalPrefix('api');

    // CORS
    app.enableCors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    });

    // Validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    
    console.log('✅ NestJS application initialized');
    console.log('📊 Database connection status:', app.get('DataSource')?.isInitialized ? 'Connected' : 'Disconnected');
  }
  return app;
}

export default async (req: any, res: any) => {
  try {
    await bootstrap();
    server(req, res);
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

