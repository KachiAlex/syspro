import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsArray, IsOptional, IsEnum } from 'class-validator';

export enum DependencyActionType {
  ENABLE = 'enable',
  DISABLE = 'disable',
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
}

export enum ConflictType {
  VERSION_CONFLICT = 'version_conflict',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  MISSING_DEPENDENCY = 'missing_dependency',
  OPTIONAL_CONFLICT = 'optional_conflict',
}

export class DependencyActionDto {
  @ApiProperty({
    description: 'Action to perform',
    enum: DependencyActionType,
    example: DependencyActionType.ENABLE,
  })
  @IsEnum(DependencyActionType)
  action: DependencyActionType;

  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  @IsString()
  moduleName: string;

  @ApiProperty({
    description: 'Source version (for upgrades/downgrades)',
    example: '1.0.0',
    required: false,
  })
  @IsOptional()
  @IsString()
  fromVersion?: string;

  @ApiProperty({
    description: 'Target version',
    example: '1.2.0',
    required: false,
  })
  @IsOptional()
  @IsString()
  toVersion?: string;

  @ApiProperty({
    description: 'Reason for the action',
    example: 'Required dependency for CRM module',
  })
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Whether this action is optional',
    example: false,
  })
  @IsBoolean()
  isOptional: boolean;
}

export class DependencyConflictDto {
  @ApiProperty({
    description: 'Type of conflict',
    enum: ConflictType,
    example: ConflictType.VERSION_CONFLICT,
  })
  @IsEnum(ConflictType)
  type: ConflictType;

  @ApiProperty({
    description: 'Description of the conflict',
    example: 'Module versions are incompatible',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Modules affected by the conflict',
    type: [String],
    example: ['crm', 'analytics'],
  })
  @IsArray()
  @IsString({ each: true })
  affectedModules: string[];

  @ApiProperty({
    description: 'Suggested resolutions',
    type: [String],
    example: ['Upgrade analytics to version 2.0.0', 'Downgrade CRM to version 1.5.0'],
  })
  @IsArray()
  @IsString({ each: true })
  suggestions: string[];
}

export class DependencyResolutionDto {
  @ApiProperty({
    description: 'Whether the operation can proceed',
    example: true,
  })
  @IsBoolean()
  canProceed: boolean;

  @ApiProperty({
    description: 'Required actions to resolve dependencies',
    type: [DependencyActionDto],
  })
  @IsArray()
  requiredActions: DependencyActionDto[];

  @ApiProperty({
    description: 'Optional actions that enhance functionality',
    type: [DependencyActionDto],
  })
  @IsArray()
  optionalActions: DependencyActionDto[];

  @ApiProperty({
    description: 'Dependency conflicts that prevent the operation',
    type: [DependencyConflictDto],
  })
  @IsArray()
  conflicts: DependencyConflictDto[];

  @ApiProperty({
    description: 'Warnings about the operation',
    type: [String],
    example: ['Optional dependency analytics can enhance reporting features'],
  })
  @IsArray()
  @IsString({ each: true })
  warnings: string[];
}

export class DependencyNodeDto {
  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  @IsString()
  moduleName: string;

  @ApiProperty({
    description: 'Module version',
    example: '1.2.0',
  })
  @IsString()
  version: string;

  @ApiProperty({
    description: 'Required dependencies',
    type: [DependencyNodeDto],
  })
  @IsArray()
  dependsOn: DependencyNodeDto[];

  @ApiProperty({
    description: 'Optional dependencies',
    type: [DependencyNodeDto],
  })
  @IsArray()
  optionalDependencies: DependencyNodeDto[];

  @ApiProperty({
    description: 'Modules that depend on this one',
    type: [DependencyNodeDto],
  })
  @IsArray()
  dependents: DependencyNodeDto[];
}

export class EnhancedFunctionalityDto {
  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  @IsString()
  moduleName: string;

  @ApiProperty({
    description: 'Enhanced feature name',
    example: 'Advanced Email Campaigns',
  })
  @IsString()
  feature: string;

  @ApiProperty({
    description: 'Feature description',
    example: 'Create sophisticated email marketing campaigns with automation',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Optional dependencies that enable this feature',
    type: [String],
    example: ['email-marketing', 'analytics'],
  })
  @IsArray()
  @IsString({ each: true })
  enabledBy: string[];

  @ApiProperty({
    description: 'Required dependencies for this feature',
    type: [String],
    example: [],
  })
  @IsArray()
  @IsString({ each: true })
  requiredDependencies: string[];
}

export class ExecuteDependencyPlanDto {
  @ApiProperty({
    description: 'Actions to execute',
    type: [DependencyActionDto],
  })
  @IsArray()
  actions: DependencyActionDto[];

  @ApiProperty({
    description: 'Whether to execute optional actions',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeOptional?: boolean;
}

export class DependencyPlanResultDto {
  @ApiProperty({
    description: 'Whether all actions succeeded',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Results of executed actions',
    type: [Object],
  })
  @IsArray()
  results: any[];

  @ApiProperty({
    description: 'Errors that occurred during execution',
    type: [String],
    example: [],
  })
  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class AnalyzeDependenciesQueryDto {
  @ApiProperty({
    description: 'Module version to analyze (optional)',
    example: '1.2.0',
    required: false,
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiProperty({
    description: 'Include optional dependencies in analysis',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  includeOptional?: boolean;
}