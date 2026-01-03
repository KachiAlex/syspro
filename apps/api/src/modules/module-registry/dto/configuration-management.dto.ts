import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateConfigurationDto {
  @ApiProperty({
    description: 'Configuration updates to apply',
    example: { maxUsers: 50, autoBackup: true },
  })
  @IsObject()
  configuration: Record<string, any>;

  @ApiProperty({
    description: 'Reason for the configuration change',
    example: 'Increased user limit for new department',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApplyTemplateDto {
  @ApiProperty({
    description: 'Name of the configuration template to apply',
    example: 'small-business',
  })
  @IsString()
  templateName: string;

  @ApiProperty({
    description: 'Configuration overrides to apply on top of template',
    example: { maxUsers: 30 },
    required: false,
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, any>;

  @ApiProperty({
    description: 'Reason for applying the template',
    example: 'Standardizing configuration for new tenant',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResetConfigurationDto {
  @ApiProperty({
    description: 'Reason for resetting configuration',
    example: 'Reverting to defaults after configuration issues',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConfigurationValidationResultDto {
  @ApiProperty({
    description: 'Whether the configuration is valid',
    example: true,
  })
  @IsBoolean()
  isValid: boolean;

  @ApiProperty({
    description: 'Validation errors if any',
    type: [String],
    example: ['maxUsers: must be a positive integer'],
  })
  @IsArray()
  errors: string[];

  @ApiProperty({
    description: 'Validation warnings if any',
    type: [String],
    example: ['Large user limits may impact performance'],
  })
  @IsArray()
  warnings: string[];
}

export class ConfigurationTemplateDto {
  @ApiProperty({
    description: 'Template name',
    example: 'small-business',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Template description',
    example: 'Configuration optimized for small businesses',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Template category',
    example: 'business-size',
  })
  @IsString()
  category: string;

  @ApiProperty({
    description: 'Default configuration values',
    example: { maxUsers: 25, storageLimit: '10GB' },
  })
  @IsObject()
  configuration: Record<string, any>;

  @ApiProperty({
    description: 'Default feature flag values',
    example: { advancedReporting: false, apiAccess: false },
  })
  @IsObject()
  featureFlags: Record<string, boolean>;

  @ApiProperty({
    description: 'Modules this template applies to',
    type: [String],
    example: ['crm', 'hr'],
  })
  @IsArray()
  applicableModules: string[];
}

export class ConfigurationAuditEntryDto {
  @ApiProperty({
    description: 'Timestamp of the change',
    example: '2023-12-01T10:30:00.000Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'User ID who made the change',
    example: 'user-123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Type of action performed',
    enum: ['update', 'reset', 'template_applied'],
    example: 'update',
  })
  @IsString()
  action: 'update' | 'reset' | 'template_applied';

  @ApiProperty({
    description: 'Configuration field that was changed',
    example: 'maxUsers',
  })
  @IsString()
  field: string;

  @ApiProperty({
    description: 'Previous value',
    example: 25,
  })
  oldValue: any;

  @ApiProperty({
    description: 'New value',
    example: 50,
  })
  newValue: any;

  @ApiProperty({
    description: 'Reason for the change',
    example: 'Increased limit for new department',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ValidateConfigurationDto {
  @ApiProperty({
    description: 'Configuration to validate',
    example: { maxUsers: 50, autoBackup: true },
  })
  @IsObject()
  configuration: Record<string, any>;

  @ApiProperty({
    description: 'Module version to validate against (optional)',
    example: '1.2.3',
    required: false,
  })
  @IsOptional()
  @IsString()
  version?: string;
}

export class GetTemplatesQueryDto {
  @ApiProperty({
    description: 'Filter templates by category',
    example: 'business-size',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;
}

export class GetAuditTrailQueryDto {
  @ApiProperty({
    description: 'Maximum number of audit entries to return',
    example: 50,
    required: false,
  })
  @IsOptional()
  limit?: number;
}