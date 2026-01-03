import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateTenantModulesTable1700000008000 implements MigrationInterface {
  name = 'CreateTenantModulesTable1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tenant_modules table
    await queryRunner.createTable(
      new Table({
        name: 'tenant_modules',
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
            name: 'isEnabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'configuration',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'featureFlags',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'enabledAt',
            type: 'timestamp with time zone',
            default: 'NOW()',
          },
          {
            name: 'enabledBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'disabledAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'disabledBy',
            type: 'uuid',
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

    // Create unique constraint on tenant_id + module_name
    await queryRunner.createIndex(
      'tenant_modules',
      new Index({
        name: 'IDX_tenant_modules_tenant_module',
        columnNames: ['tenantId', 'moduleName'],
        isUnique: true,
      }),
    );

    // Create index for enabled modules lookup
    await queryRunner.createIndex(
      'tenant_modules',
      new Index({
        name: 'IDX_tenant_modules_tenant_enabled',
        columnNames: ['tenantId', 'isEnabled'],
      }),
    );

    // Create index for module lookup
    await queryRunner.createIndex(
      'tenant_modules',
      new Index({
        name: 'IDX_tenant_modules_module',
        columnNames: ['moduleName'],
      }),
    );

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'tenant_modules',
      new ForeignKey({
        name: 'FK_tenant_modules_tenant',
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'tenant_modules',
      new ForeignKey({
        name: 'FK_tenant_modules_module_registry',
        columnNames: ['moduleName'],
        referencedTableName: 'module_registry',
        referencedColumnNames: ['name'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'tenant_modules',
      new ForeignKey({
        name: 'FK_tenant_modules_enabled_by',
        columnNames: ['enabledBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'tenant_modules',
      new ForeignKey({
        name: 'FK_tenant_modules_disabled_by',
        columnNames: ['disabledBy'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('tenant_modules', 'FK_tenant_modules_disabled_by');
    await queryRunner.dropForeignKey('tenant_modules', 'FK_tenant_modules_enabled_by');
    await queryRunner.dropForeignKey('tenant_modules', 'FK_tenant_modules_module_registry');
    await queryRunner.dropForeignKey('tenant_modules', 'FK_tenant_modules_tenant');

    // Drop indexes
    await queryRunner.dropIndex('tenant_modules', 'IDX_tenant_modules_module');
    await queryRunner.dropIndex('tenant_modules', 'IDX_tenant_modules_tenant_enabled');
    await queryRunner.dropIndex('tenant_modules', 'IDX_tenant_modules_tenant_module');

    // Drop table
    await queryRunner.dropTable('tenant_modules');
  }
}