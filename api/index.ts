import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../backend/src/app.module';
import express from 'express';
import cookieParser from 'cookie-parser';

const server = express();
server.use(cookieParser());
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
    const corsOrigins = (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        if (corsOrigins.length === 0) {
          return callback(new Error('CORS origin not allowed'), false);
        }
        if (corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('CORS origin not allowed'), false);
      },
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

