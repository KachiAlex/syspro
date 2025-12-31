import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { SimpleUser } from './entities/simple-user.entity';
import { SimpleAuthController } from './controllers/simple-auth.controller';
import { SeedController } from './controllers/seed.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([SimpleUser]),
  ],
  controllers: [AppController, SimpleAuthController, SeedController],
  providers: [AppService],
})
export class AppModule {}
