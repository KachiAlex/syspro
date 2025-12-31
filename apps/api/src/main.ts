import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TenantInterceptor } from './shared/interceptors/tenant.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`],
        manifestSrc: [`'self'`],
        frameSrc: [`'self'`],
      },
    },
  }));

  // CORS configuration
  const corsOrigins = nodeEnv === 'production' 
    ? [
        configService.get<string>('FRONTEND_URL'),
        'https://*.vercel.app',
        'https://syspro-erp.vercel.app'
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TenantInterceptor(),
    new TransformInterceptor(),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger documentation
  if (nodeEnv !== 'production' || configService.get<boolean>('ENABLE_SWAGGER', false)) {
    const config = new DocumentBuilder()
      .setTitle('Syspro ERP API')
      .setDescription('Production-grade multi-tenant ERP system API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addApiKey(
        {
          type: 'apiKey',
          name: 'X-Tenant-ID',
          in: 'header',
          description: 'Tenant identifier',
        },
        'tenant-key',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    app.close();
  });

  // For Vercel serverless functions
  if (process.env.VERCEL) {
    await app.init();
    return app.getHttpAdapter().getInstance();
  }

  // For local development
  await app.listen(port);
  
  console.log(`🚀 Syspro ERP API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`🌍 Environment: ${nodeEnv}`);
}

// Export for Vercel
export default bootstrap;

// Run locally
if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });
}