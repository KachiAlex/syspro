import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateTenantTable1700000000000 implements MigrationInterface {
  name = 'CreateTenantTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tenants',
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
            isNullable: false,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '20',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'domain',
            type: 'varchar',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'settings',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'schemaName',
            type: 'varchar',
            isNullable: true,
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

    // Create indexes
    await queryRunner.createIndex(
      'tenants',
      new Index('IDX_tenants_code', ['code'], { isUnique: true }),
    );

    await queryRunner.createIndex(
      'tenants',
      new Index('IDX_tenants_domain', ['domain'], { 
        isUnique: true,
        where: 'domain IS NOT NULL',
      }),
    );

    await queryRunner.createIndex(
      'tenants',
      new Index('IDX_tenants_isActive', ['isActive']),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tenants');
  }
}