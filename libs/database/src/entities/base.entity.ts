import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BaseEntity as TypeOrmBaseEntity,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export abstract class BaseEntity extends TypeOrmBaseEntity {
  @ApiProperty({
    description: 'Unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-12-01T10:00:00.000Z',
  })
  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-12-01T10:00:00.000Z',
  })
  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Soft deletion timestamp',
    example: '2023-12-01T10:00:00.000Z',
    required: false,
  })
  @DeleteDateColumn({
    type: 'timestamp with time zone',
    nullable: true,
  })
  @Exclude()
  deletedAt?: Date;
}