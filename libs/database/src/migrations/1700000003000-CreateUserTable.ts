import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateUserTable1700000003000 implements MigrationInterface {
  name = 'CreateUserTable1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for user status
    await queryRunner.query(`
      CREATE TYPE "user_status_enum" AS ENUM (
        'active',
        'inactive', 
        'suspended',
        'pending_verification'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'email',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'firstName',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'lastName',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'avatar',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'suspended', 'pending_verification'],
            default: "'pending_verification'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'emailVerified',
            type: 'boolean',
            default: false,
          },
          {
            name: 'lastLoginAt',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'failedLoginAttempts',
            type: 'integer',
            default: 0,
          },
          {
            name: 'lockedUntil',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'passwordResetToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'passwordResetExpires',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'emailVerificationToken',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organizationId',
            type: 'uuid',
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

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'users',
      new ForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'users',
      new ForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'users',
      new Index('IDX_users_email_tenant', ['email', 'tenantId'], { isUnique: true }),
    );

    await queryRunner.createIndex(
      'users',
      new Index('IDX_users_tenantId', ['tenantId']),
    );

    await queryRunner.createIndex(
      'users',
      new Index('IDX_users_organizationId', ['organizationId']),
    );

    await queryRunner.createIndex(
      'users',
      new Index('IDX_users_status', ['status']),
    );

    // Create user-role junction table
    await queryRunner.createTable(
      new Table({
        name: 'user_roles_junction',
        columns: [
          {
            name: 'userId',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'roleId',
            type: 'uuid',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_roles_junction',
      new ForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_roles_junction',
      new ForeignKey({
        columnNames: ['roleId'],
        referencedTableName: 'user_roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_roles_junction');
    await queryRunner.dropTable('users');
    await queryRunner.query('DROP TYPE "user_status_enum"');
  }
}