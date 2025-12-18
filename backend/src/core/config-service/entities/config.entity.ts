import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ConfigScope {
  SYSTEM = 'SYSTEM', // Global system configuration
  TENANT = 'TENANT', // Tenant-specific configuration
  MODULE = 'MODULE', // Module-specific configuration
  USER = 'USER', // User-specific configuration
}

export enum ConfigType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
  ENCRYPTED = 'ENCRYPTED', // For sensitive data
}

@Entity('configurations')
@Index(['scope', 'tenantId', 'moduleId', 'key'], { unique: true })
export class Configuration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string;

  @Column({ type: 'text' })
  value: string; // Stored as string, parsed based on type

  @Column({
    type: 'enum',
    enum: ConfigType,
    default: ConfigType.STRING,
  })
  type: ConfigType;

  @Column({
    type: 'enum',
    enum: ConfigScope,
    default: ConfigScope.TENANT,
  })
  scope: ConfigScope;

  @Column({ nullable: true })
  tenantId: string | null;

  @Column({ nullable: true })
  moduleId: string | null;

  @Column({ nullable: true })
  userId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: false })
  isEncrypted: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

