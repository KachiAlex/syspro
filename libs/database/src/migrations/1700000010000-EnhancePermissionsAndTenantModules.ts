import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class EnhancePermissionsAndTenantModules1700000010000 implements MigrationInterface {
  name = 'EnhancePermissionsAndTenantModules1700000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend permissions table
    await queryRunner.addColumns('permissions', [
      new TableColumn({
        name: 'tenantId',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'name',
        type: 'varchar',
        length: '150',
        isNullable: true,
      }),
      new TableColumn({
        name: 'description',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'isActive',
        type: 'boolean',
        isNullable: false,
        default: true,
      }),
      new TableColumn({
        name: 'metadata',
        type: 'jsonb',
        isNullable: true,
      }),
    ]);

    // Backfill tenantId and name using existing data
    await queryRunner.query(`
      UPDATE permissions p
      SET "tenantId" = r."tenantId"
      FROM user_roles r
      WHERE p."roleId" = r.id
    `);

    await queryRunner.query(`
      UPDATE permissions
      SET "name" = CONCAT(resource, ':', action)
      WHERE "name" IS NULL
    `);

    // Enforce NOT NULL after backfill
    await queryRunner.changeColumns('permissions', [
      {
        oldColumn: new TableColumn({
          name: 'tenantId',
          type: 'uuid',
          isNullable: true,
        }),
        newColumn: new TableColumn({
          name: 'tenantId',
          type: 'uuid',
          isNullable: false,
        }),
      },
      {
        oldColumn: new TableColumn({
          name: 'name',
          type: 'varchar',
          length: '150',
          isNullable: true,
        }),
        newColumn: new TableColumn({
          name: 'name',
          type: 'varchar',
          length: '150',
          isNullable: false,
        }),
      },
    ]);

    // Create unique index for tenant + name
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'IDX_permissions_tenant_name',
        columnNames: ['tenantId', 'name'],
        isUnique: true,
      }),
    );

    // Extend tenant_modules with audit trail column
    await queryRunner.addColumn(
      'tenant_modules',
      new TableColumn({
        name: 'auditTrail',
        type: 'jsonb',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('tenant_modules', 'auditTrail');

    await queryRunner.dropIndex('permissions', 'IDX_permissions_tenant_name');

    await queryRunner.dropColumns('permissions', ['metadata', 'isActive', 'description', 'name', 'tenantId']);
  }
}