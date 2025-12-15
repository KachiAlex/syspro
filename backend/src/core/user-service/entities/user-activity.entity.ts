import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../entities/user.entity';

export enum ActivityType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  TWO_FA_ENABLED = 'TWO_FA_ENABLED',
  TWO_FA_DISABLED = 'TWO_FA_DISABLED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  OTHER = 'OTHER',
}

@Entity('user_activities')
export class UserActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}

