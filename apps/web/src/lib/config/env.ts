/**
 * Environment configuration for the frontend application
 * Validates and provides typed access to environment variables
 */

interface EnvironmentConfig {
  apiBaseUrl: string;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

interface EnvironmentValidationError {
  variable: string;
  message: string;
  required: boolean;
}

/**
 * Validates a single environment variable
 */
function validateEnvironmentVariable(
  name: string,
  value: string | undefined,
  options: {
    required?: boolean;
    defaultValue?: string;
    validator?: (value: string) => boolean;
    errorMessage?: string;
  } = {}
): { value: string | undefined; error?: EnvironmentValidationError } {
  const { required = false, defaultValue, validator, errorMessage } = options;

  // Check if required variable is missing
  if (required && !value) {
    return {
      value: defaultValue,
      error: {
        variable: name,
        message: errorMessage || `Missing required environment variable: ${name}`,
        required: true,
      },
    };
  }

  // Use default value if not provided
  const finalValue = value || defaultValue;

  // Run custom validator if provided
  if (finalValue && validator && !validator(finalValue)) {
    return {
      value: finalValue,
      error: {
        variable: name,
        message: errorMessage || `Invalid value for environment variable: ${name}`,
        required,
      },
    };
  }

  return { value: finalValue };
}

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and returns the environment configuration
 * Throws an error if required environment variables are missing or invalid
 */
function createEnvironmentConfig(): EnvironmentConfig {
  const errors: EnvironmentValidationError[] = [];
  
  // Validate API Base URL
  const apiBaseUrlResult = validateEnvironmentVariable(
    'NEXT_PUBLIC_API_BASE_URL',
    process.env.NEXT_PUBLIC_API_BASE_URL,
    {
      required: true,
      defaultValue: 'http://localhost:3001',
      validator: isValidUrl,
      errorMessage: 'NEXT_PUBLIC_API_BASE_URL must be a valid URL (e.g., http://localhost:3001)',
    }
  );
  
  if (apiBaseUrlResult.error) {
    errors.push(apiBaseUrlResult.error);
  }

  // Validate Node Environment
  const nodeEnvResult = validateEnvironmentVariable(
    'NODE_ENV',
    process.env.NODE_ENV,
    {
      defaultValue: 'development',
      validator: (value) => ['development', 'production', 'test'].includes(value),
      errorMessage: 'NODE_ENV must be one of: development, production, test',
    }
  );

  if (nodeEnvResult.error) {
    errors.push(nodeEnvResult.error);
  }

  // If there are validation errors, throw with helpful message
  if (errors.length > 0) {
    const errorMessage = [
      '❌ Environment Configuration Errors:',
      '',
      ...errors.map(error => `  • ${error.message}`),
      '',
      '📝 To fix these issues:',
      '  1. Create a .env.local file in your project root',
      '  2. Add the missing environment variables',
      '  3. Restart your development server',
      '',
      '📖 Example .env.local file:',
      '  NEXT_PUBLIC_API_BASE_URL=http://localhost:3001',
      '  NODE_ENV=development',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  const apiBaseUrl = apiBaseUrlResult.value!;
  const nodeEnv = nodeEnvResult.value!;

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''), // Remove trailing slash
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  };
}

/**
 * Validates environment configuration at startup
 * Shows user-friendly error messages for missing configuration
 */
export function validateEnvironment(): void {
  try {
    createEnvironmentConfig();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Environment configuration validated successfully');
      console.log(`📡 API Base URL: ${env.apiBaseUrl}`);
      console.log(`🌍 Environment: ${env.nodeEnv}`);
    }
  } catch (error) {
    if (typeof window !== 'undefined') {
      // In browser, show user-friendly error
      console.error(error);
      
      // You could also show a modal or toast notification here
      alert(
        'Configuration Error: Please check the console for details about missing environment variables.'
      );
    } else {
      // In server/build time, throw the error to stop the build
      throw error;
    }
  }
}

/**
 * Get environment configuration with runtime validation
 */
function getEnvironmentConfig(): EnvironmentConfig {
  try {
    return createEnvironmentConfig();
  } catch (error) {
    // In production, provide fallback values to prevent complete failure
    if (process.env.NODE_ENV === 'production') {
      console.error('Environment configuration error, using fallbacks:', error);
      
      return {
        apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://syspro-api.vercel.app', // Fallback to production API
        nodeEnv: 'production',
        isDevelopment: false,
        isProduction: true,
        isTest: false,
      };
    }
    
    // In development, throw the error to help developers fix the issue
    throw error;
  }
}

// Export the validated configuration
export const env = getEnvironmentConfig();

// Export types and utilities for use in other modules
export type { EnvironmentConfig, EnvironmentValidationError };