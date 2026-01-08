import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateModuleUsageAnalyticsTable1700000009000 implements MigrationInterface {
  name = 'CreateModuleUsageAnalyticsTable1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create module_usage_analytics table
    await queryRunner.createTable(
      new Table({
        name: 'module_usage_analytics',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenantId',
            type: 'uuid',
          },
          {
            name: 'moduleName',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'endpoint',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'requestCount',
            type: 'integer',
            default: 1,
          },
          {
            name: 'responseTimeMs',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'errorCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'date',
            type: 'date',
          },
          {
            name: 'hour',
            type: 'integer',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
        ],
      }),
      true,
    );

    // Create unique constraint on tenant_id + module_name + endpoint + date + hour
    await queryRunner.createIndex(
      'module_usage_analytics',
      new TableIndex({
        name: 'IDX_module_usage_analytics_unique',
        columnNames: ['tenantId', 'moduleName', 'endpoint', 'date', 'hour'],
        isUnique: true,
      }),
    );

    // Create index for tenant + date queries
    await queryRunner.createIndex(
      'module_usage_analytics',
      new TableIndex({
        name: 'IDX_module_usage_analytics_tenant_date',
        columnNames: ['tenantId', 'date'],
      }),
    );

    // Create index for module + date queries
    await queryRunner.createIndex(
      'module_usage_analytics',
      new TableIndex({
        name: 'IDX_module_usage_analytics_module_date',
        columnNames: ['moduleName', 'date'],
      }),
    );

    // Create index for hour-based queries
    await queryRunner.createIndex(
      'module_usage_analytics',
      new TableIndex({
        name: 'IDX_module_usage_analytics_hour',
        columnNames: ['date', 'hour'],
      }),
    );

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'module_usage_analytics',
      new TableForeignKey({
        name: 'FK_module_usage_analytics_tenant',
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Add check constraint for hour (0-23)
    await queryRunner.query(`
      ALTER TABLE "module_usage_analytics" 
      ADD CONSTRAINT "CHK_module_usage_analytics_hour" 
      CHECK ("hour" >= 0 AND "hour" <= 23)
    `);

    // Add check constraint for positive counts
    await queryRunner.query(`
      ALTER TABLE "module_usage_analytics" 
      ADD CONSTRAINT "CHK_module_usage_analytics_request_count" 
      CHECK ("requestCount" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "module_usage_analytics" 
      ADD CONSTRAINT "CHK_module_usage_analytics_error_count" 
      CHECK ("errorCount" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "module_usage_analytics" 
      ADD CONSTRAINT "CHK_module_usage_analytics_response_time" 
      CHECK ("responseTimeMs" IS NULL OR "responseTimeMs" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop check constraints
    await queryRunner.query(`ALTER TABLE "module_usage_analytics" DROP CONSTRAINT "CHK_module_usage_analytics_response_time"`);
    await queryRunner.query(`ALTER TABLE "module_usage_analytics" DROP CONSTRAINT "CHK_module_usage_analytics_error_count"`);
    await queryRunner.query(`ALTER TABLE "module_usage_analytics" DROP CONSTRAINT "CHK_module_usage_analytics_request_count"`);
    await queryRunner.query(`ALTER TABLE "module_usage_analytics" DROP CONSTRAINT "CHK_module_usage_analytics_hour"`);

    // Drop foreign key
    await queryRunner.dropForeignKey('module_usage_analytics', 'FK_module_usage_analytics_tenant');

    // Drop indexes
    await queryRunner.dropIndex('module_usage_analytics', 'IDX_module_usage_analytics_hour');
    await queryRunner.dropIndex('module_usage_analytics', 'IDX_module_usage_analytics_module_date');
    await queryRunner.dropIndex('module_usage_analytics', 'IDX_module_usage_analytics_tenant_date');
    await queryRunner.dropIndex('module_usage_analytics', 'IDX_module_usage_analytics_unique');

    // Drop table
    await queryRunner.dropTable('module_usage_analytics');
  }
}