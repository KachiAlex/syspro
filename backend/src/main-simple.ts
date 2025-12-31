import { NestFactory } from '@nestjs/core';
import { Controller, Get, Post, Body, Module } from '@nestjs/common';

// Simple controller with no dependencies
@Controller()
class SimpleController {
  @Get()
  getHello() {
    return { message: 'Hello from Syspro API!', timestamp: new Date().toISOString() };
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('test-login')
  testLogin(@Body() body: any) {
    const { email, password } = body;
    
    // Simple hardcoded check for testing
    if (email === 'admin@syspro.com' && password === 'Admin@123') {
      return {
        success: true,
        message: 'Login successful',
        user: { email, role: 'ADMIN' }
      };
    }
    
    return { success: false, message: 'Invalid credentials' };
  }
}

// Minimal module with no external dependencies
@Module({
  controllers: [SimpleController],
})
class SimpleAppModule {}

export async function createSimpleApp() {
  const app = await NestFactory.create(SimpleAppModule, {
    cors: {
      origin: '*',
      credentials: true,
    },
  });

  app.setGlobalPrefix('api');
  
  return app;
}

// For local development
async function bootstrap() {
  const app = await createSimpleApp();
  await app.listen(4000);
  console.log('🚀 Simple API running on http://localhost:4000');
}

if (!process.env.VERCEL) {
  bootstrap();
}

export default createSimpleApp;