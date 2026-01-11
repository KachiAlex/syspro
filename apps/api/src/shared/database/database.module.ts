import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
      dataSourceFactory: async (options) => {
        const dataSource = new DataSource(options as any);
        await dataSource.initialize();

        // Guard against production databases missing migrations.
        // Idempotent and safe to run on every cold start.
        await dataSource.query(`
          ALTER TABLE "permissions"
          ADD COLUMN IF NOT EXISTS "tenantId" uuid,
          ADD COLUMN IF NOT EXISTS "name" character varying(150)
        `);

        await dataSource.query(`
          ALTER TABLE "permissions"
          ADD COLUMN IF NOT EXISTS "description" text,
          ADD COLUMN IF NOT EXISTS "isActive" boolean DEFAULT true,
          ADD COLUMN IF NOT EXISTS "metadata" jsonb
        `);

        await dataSource.query(`
          UPDATE "permissions"
          SET "name" = CONCAT("resource", ':', "action")
          WHERE "name" IS NULL
        `);

        return dataSource;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}