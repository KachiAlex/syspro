import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { User } from './user.entity';
import { Subsidiary } from './subsidiary.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  domain: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Subsidiary, (subsidiary) => subsidiary.organization)
  subsidiaries: Subsidiary[];

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


