import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateUserRoleTable1700000002000 implements MigrationInterface {
  name = 'CreateUserRoleTable1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
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
            length: '50',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'code',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'user_roles',
      new ForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'user_roles',
      new Index('IDX_user_roles_tenantId', ['tenantId']),
    );

    await queryRunner.createIndex(
      'user_roles',
      new Index('IDX_user_roles_tenant_name', ['tenantId', 'name'], { isUnique: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_roles');
  }
}