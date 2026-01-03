import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpgradeModuleVersionDto {
  @ApiProperty({
    description: 'Target version to upgrade to',
    example: '1.2.3',
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semantic versioning (e.g., 1.2.3)',
  })
  targetVersion: string;
}

export class DowngradeModuleVersionDto {
  @ApiProperty({
    description: 'Target version to downgrade to',
    example: '1.1.0',
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semantic versioning (e.g., 1.2.3)',
  })
  targetVersion: string;
}

export class VersionUpgradeResultDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Version upgraded from',
    example: '1.1.0',
  })
  fromVersion: string;

  @ApiProperty({
    description: 'Version upgraded to',
    example: '1.2.0',
  })
  toVersion: string;

  @ApiProperty({
    description: 'Whether migration is required',
    example: false,
  })
  migrationRequired: boolean;

  @ApiProperty({
    description: 'Migration steps if required',
    type: [String],
    required: false,
  })
  migrationSteps?: string[];

  @ApiProperty({
    description: 'Warnings about the upgrade',
    type: [String],
    required: false,
  })
  warnings?: string[];
}

export class VersionCompatibilityDto {
  @ApiProperty({
    description: 'Module version',
    example: '1.2.0',
  })
  version: string;

  @ApiProperty({
    description: 'Versions compatible with this version',
    type: [String],
    example: ['1.1.0', '1.2.1', '1.3.0'],
  })
  compatibleWith: string[];

  @ApiProperty({
    description: 'Versions incompatible with this version',
    type: [String],
    example: ['2.0.0', '0.9.0'],
  })
  incompatibleWith: string[];

  @ApiProperty({
    description: 'Whether this version is deprecated',
    example: false,
  })
  deprecated: boolean;

  @ApiProperty({
    description: 'Deprecation date if deprecated',
    example: '2024-12-31T00:00:00.000Z',
    required: false,
  })
  deprecationDate?: Date;

  @ApiProperty({
    description: 'Migration path if deprecated',
    example: 'Upgrade to version 1.0.0 or higher',
    required: false,
  })
  migrationPath?: string;
}

export class ModuleVersionListDto {
  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  name: string;

  @ApiProperty({
    description: 'Module display name',
    example: 'Customer Relationship Management',
  })
  displayName: string;

  @ApiProperty({
    description: 'Module version',
    example: '1.2.3',
  })
  version: string;

  @ApiProperty({
    description: 'Whether this is the latest version',
    example: true,
  })
  isLatest: boolean;

  @ApiProperty({
    description: 'Whether this version is deprecated',
    example: false,
  })
  isDeprecated: boolean;

  @ApiProperty({
    description: 'Module category',
    example: 'business',
  })
  category: string;

  @ApiProperty({
    description: 'Module description',
    example: 'Comprehensive CRM system for managing customer relationships',
  })
  description?: string;

  @ApiProperty({
    description: 'Release date',
    example: '2023-12-01T00:00:00.000Z',
  })
  createdAt: Date;
}