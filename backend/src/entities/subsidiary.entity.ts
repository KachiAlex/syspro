import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('subsidiaries')
export class Subsidiary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @ManyToOne(() => Organization, (org) => org.subsidiaries)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  organizationId: string;

  @OneToMany(() => Department, (dept) => dept.subsidiary)
  departments: Department[];

  @OneToMany(() => User, (user) => user.subsidiary)
  users: User[];

  @Column()
  tenantId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


