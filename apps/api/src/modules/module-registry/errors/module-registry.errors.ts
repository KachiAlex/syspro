import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base error class for module registry errors
 */
export class ModuleRegistryError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly code: string = 'MODULE_REGISTRY_ERROR',
    public readonly details?: Record<string, any>,
  ) {
    super(
      {
        success: false,
        message,
        code,
        details,
      },
      status,
    );
  }
}

/**
 * Module not found error
 */
export class ModuleNotFoundError extends ModuleRegistryError {
  constructor(moduleName: string) {
    super(
      `Module '${moduleName}' not found`,
      HttpStatus.NOT_FOUND,
      'MODULE_NOT_FOUND',
      { moduleName },
    );
  }
}

/**
 * Module already exists error
 */
export class ModuleAlreadyExistsError extends ModuleRegistryError {
  constructor(moduleName: string) {
    super(
      `Module '${moduleName}' already exists`,
      HttpStatus.CONFLICT,
      'MODULE_ALREADY_EXISTS',
      { moduleName },
    );
  }
}

/**
 * Module validation error
 */
export class ModuleValidationError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'MODULE_VALIDATION_ERROR',
      details,
    );
  }
}

/**
 * Module dependency error
 */
export class ModuleDependencyError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'MODULE_DEPENDENCY_ERROR',
      details,
    );
  }
}

/**
 * Module compatibility error
 */
export class ModuleCompatibilityError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'MODULE_COMPATIBILITY_ERROR',
      details,
    );
  }
}

/**
 * Module version error
 */
export class ModuleVersionError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'MODULE_VERSION_ERROR',
      details,
    );
  }
}

/**
 * Module configuration error
 */
export class ModuleConfigurationError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'MODULE_CONFIGURATION_ERROR',
      details,
    );
  }
}

/**
 * Module access denied error
 */
export class ModuleAccessDeniedError extends ModuleRegistryError {
  constructor(moduleName: string, reason?: string) {
    super(
      `Access denied to module '${moduleName}'${reason ? `: ${reason}` : ''}`,
      HttpStatus.FORBIDDEN,
      'MODULE_ACCESS_DENIED',
      { moduleName, reason },
    );
  }
}

/**
 * Module disabled error
 */
export class ModuleDisabledError extends ModuleRegistryError {
  constructor(moduleName: string) {
    super(
      `Module '${moduleName}' is disabled`,
      HttpStatus.FORBIDDEN,
      'MODULE_DISABLED',
      { moduleName },
    );
  }
}

/**
 * Module core module error (cannot disable core modules)
 */
export class ModuleCoreModuleError extends ModuleRegistryError {
  constructor(moduleName: string) {
    super(
      `Cannot disable core module '${moduleName}'`,
      HttpStatus.BAD_REQUEST,
      'MODULE_CORE_MODULE_ERROR',
      { moduleName },
    );
  }
}

/**
 * Tenant module not found error
 */
export class TenantModuleNotFoundError extends ModuleRegistryError {
  constructor(tenantId: string, moduleName: string) {
    super(
      `Module '${moduleName}' is not enabled for tenant '${tenantId}'`,
      HttpStatus.NOT_FOUND,
      'TENANT_MODULE_NOT_FOUND',
      { tenantId, moduleName },
    );
  }
}

/**
 * Tenant module already enabled error
 */
export class TenantModuleAlreadyEnabledError extends ModuleRegistryError {
  constructor(tenantId: string, moduleName: string) {
    super(
      `Module '${moduleName}' is already enabled for tenant '${tenantId}'`,
      HttpStatus.CONFLICT,
      'TENANT_MODULE_ALREADY_ENABLED',
      { tenantId, moduleName },
    );
  }
}

/**
 * Permission error
 */
export class PermissionError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.FORBIDDEN,
      'PERMISSION_ERROR',
      details,
    );
  }
}

/**
 * Billing integration error
 */
export class BillingIntegrationError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'BILLING_INTEGRATION_ERROR',
      details,
    );
  }
}

/**
 * Webhook error
 */
export class WebhookError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'WEBHOOK_ERROR',
      details,
    );
  }
}

/**
 * Configuration schema validation error
 */
export class ConfigurationSchemaValidationError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'CONFIGURATION_SCHEMA_VALIDATION_ERROR',
      details,
    );
  }
}

/**
 * Feature flag error
 */
export class FeatureFlagError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'FEATURE_FLAG_ERROR',
      details,
    );
  }
}

/**
 * Analytics error
 */
export class AnalyticsError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'ANALYTICS_ERROR',
      details,
    );
  }
}

/**
 * Invalid input error
 */
export class InvalidInputError extends ModuleRegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      'INVALID_INPUT',
      details,
    );
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends ModuleRegistryError {
  constructor(message: string = 'Unauthorized', details?: Record<string, any>) {
    super(
      message,
      HttpStatus.UNAUTHORIZED,
      'UNAUTHORIZED',
      details,
    );
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends ModuleRegistryError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_SERVER_ERROR',
      details,
    );
  }
}
