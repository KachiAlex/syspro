import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateSubscriptionTable1700000005000 implements MigrationInterface {
  name = 'CreateSubscriptionTable1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for subscription status
    await queryRunner.query(`
      CREATE TYPE "subscription_status_enum" AS ENUM (
        'active',
        'canceled',
        'past_due',
        'unpaid',
        'trialing'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'canceled', 'past_due', 'unpaid', 'trialing'],
            default: "'trialing'",
          },
          {
            name: 'planId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'currentPeriodStart',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'currentPeriodEnd',
            type: 'timestamp with time zone',
            isNullable: false,
          },
          {
            name: 'cancelAtPeriodEnd',
            type: 'boolean',
            default: false,
          },
          {
            name: 'trialEnd',
            type: 'timestamp with time zone',
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
      'subscriptions',
      new TableForeignKey({
        columnNames: ['tenantId'],
        referencedTableName: 'tenants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_tenantId',
        columnNames: ['tenantId'],
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscriptions');
    await queryRunner.query('DROP TYPE "subscription_status_enum"');
  }
}