import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const PERMISSIONS_TABLE = 'permissions';
const TENANT_FK_NAME = 'FK_permissions_tenantId';
const TENANT_INDEX_NAME = 'IDX_permissions_tenantId';

export class AddTenantIdToPermissions1700000016000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      PERMISSIONS_TABLE,
      new TableColumn({
        name: 'tenantId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE "permissions" p
      SET "tenantId" = r."tenantId"
      FROM "user_roles" r
      WHERE p."roleId" = r."id"
        AND p."roleId" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "permissions"
      SET "tenantId" = (
        SELECT "id"
        FROM "tenants"
        WHERE "code" = 'PLATFORM'
        LIMIT 1
      )
      WHERE "tenantId" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "permissions"
      ALTER COLUMN "tenantId" SET NOT NULL
    `);

    await queryRunner.createForeignKey(
      PERMISSIONS_TABLE,
      new TableForeignKey({
        name: TENANT_FK_NAME,
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      PERMISSIONS_TABLE,
      new TableIndex({
        name: TENANT_INDEX_NAME,
        columnNames: ['tenantId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(PERMISSIONS_TABLE, TENANT_INDEX_NAME);
    await queryRunner.dropForeignKey(PERMISSIONS_TABLE, TENANT_FK_NAME);
    await queryRunner.dropColumn(PERMISSIONS_TABLE, 'tenantId');
  }
}
