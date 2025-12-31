import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateAuditLogTable1700000006000 implements MigrationInterface {
  name = 'CreateAuditLogTable1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'action',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'resource',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'resourceId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'oldValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'newValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
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
      'audit_logs',
      new ForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'audit_logs',
      new ForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes for efficient querying
    await queryRunner.createIndex(
      'audit_logs',
      new Index('IDX_audit_logs_tenantId', ['tenantId']),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new Index('IDX_audit_logs_userId', ['userId']),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new Index('IDX_audit_logs_resource', ['resource']),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new Index('IDX_audit_logs_action', ['action']),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new Index('IDX_audit_logs_createdAt', ['createdAt']),
    );

    await queryRunner.createIndex(
      'audit_logs',
      new Index('IDX_audit_logs_resource_resourceId', ['resource', 'resourceId']),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs');
  }
}