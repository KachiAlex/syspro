import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateModuleRegistryTable1700000007000 implements MigrationInterface {
  name = 'CreateModuleRegistryTable1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "module_category_enum" AS ENUM('core', 'business', 'integration', 'analytics')
    `);
    
    await queryRunner.query(`
      CREATE TYPE "pricing_model_enum" AS ENUM('free', 'flat_rate', 'per_user', 'usage_based')
    `);

    // Create module_registry table
    await queryRunner.createTable(
      new Table({
        name: 'module_registry',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['core', 'business', 'integration', 'analytics'],
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isCore',
            type: 'boolean',
            default: false,
          },
          {
            name: 'pricingModel',
            type: 'enum',
            enum: ['free', 'flat_rate', 'per_user', 'usage_based'],
            isNullable: true,
          },
          {
            name: 'basePrice',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'perUserPrice',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'dependencies',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'optionalDependencies',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'configurationSchema',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'featureFlags',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'apiEndpoints',
            type: 'jsonb',
            default: "'[]'",
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

    // Create indexes
    await queryRunner.createIndex(
      'module_registry',
      new Index({
        name: 'IDX_module_registry_category',
        columnNames: ['category'],
      }),
    );

    await queryRunner.createIndex(
      'module_registry',
      new Index({
        name: 'IDX_module_registry_active',
        columnNames: ['isActive'],
      }),
    );

    await queryRunner.createIndex(
      'module_registry',
      new Index({
        name: 'IDX_module_registry_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('module_registry', 'IDX_module_registry_name');
    await queryRunner.dropIndex('module_registry', 'IDX_module_registry_active');
    await queryRunner.dropIndex('module_registry', 'IDX_module_registry_category');

    // Drop table
    await queryRunner.dropTable('module_registry');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "pricing_model_enum"`);
    await queryRunner.query(`DROP TYPE "module_category_enum"`);
  }
}