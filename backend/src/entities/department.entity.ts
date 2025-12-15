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
import { Subsidiary } from './subsidiary.entity';
import { User } from './user.entity';

export enum DepartmentType {
  HR = 'HR',
  OPERATIONS = 'OPERATIONS',
  IT = 'IT',
  MARKETING = 'MARKETING',
  FINANCE = 'FINANCE',
  SALES = 'SALES',
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  OTHER = 'OTHER',
}

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  code: string;

  @Column({
    type: 'enum',
    enum: DepartmentType,
    default: DepartmentType.OTHER,
  })
  type: DepartmentType;

  @ManyToOne(() => Subsidiary, (subsidiary) => subsidiary.departments)
  @JoinColumn({ name: 'subsidiaryId' })
  subsidiary: Subsidiary;

  @Column()
  subsidiaryId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'managerId' })
  manager: User;

  @Column({ nullable: true })
  managerId: string;

  @OneToMany(() => User, (user) => user.department)
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


