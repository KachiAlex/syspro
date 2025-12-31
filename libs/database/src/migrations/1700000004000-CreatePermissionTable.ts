import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreatePermissionTable1700000004000 implements MigrationInterface {
  name = 'CreatePermissionTable1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'resource',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'action',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'conditions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'roleId',
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
      'permissions',
      new ForeignKey({
        columnNames: ['roleId'],
        referencedTableName: 'user_roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'permissions',
      new Index('IDX_permissions_roleId', ['roleId']),
    );

    await queryRunner.createIndex(
      'permissions',
      new Index('IDX_permissions_resource_action', ['resource', 'action']),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions');
  }
}