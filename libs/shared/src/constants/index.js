"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEZONES = exports.LANGUAGES = exports.CURRENCIES = exports.DEFAULT_ROLES = exports.PERMISSIONS = exports.ERP_MODULES = exports.HTTP_STATUS = exports.ERROR_CODES = exports.RATE_LIMIT = exports.CACHE = exports.DATABASE = exports.VALIDATION = exports.PAGINATION = exports.AUTH_CONFIG = exports.API_CONFIG = exports.APP_CONFIG = void 0;
exports.APP_CONFIG = {
    NAME: 'Syspro ERP',
    VERSION: '1.0.0',
    DESCRIPTION: 'Production-grade multi-tenant ERP system',
    SUPPORT_EMAIL: 'support@syspro.com',
    COMPANY: 'Syscomptech & Subsidiaries'
};
exports.API_CONFIG = {
    VERSION: 'v1',
    PREFIX: '/api/v1',
    TIMEOUT: 30000,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    SUPPORTED_FILE_TYPES: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
};
exports.AUTH_CONFIG = {
    JWT_EXPIRES_IN: '24h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_RESET_EXPIRES_IN: '1h',
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000,
    SESSION_TIMEOUT: 30 * 60 * 1000
};
exports.PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1
};
exports.VALIDATION = {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
    TENANT_CODE_REGEX: /^[A-Z0-9_]{2,20}$/,
    PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
};
exports.DATABASE = {
    MAX_CONNECTIONS: 100,
    CONNECTION_TIMEOUT: 60000,
    QUERY_TIMEOUT: 30000,
    MIGRATION_TABLE: 'migrations',
    SEED_TABLE: 'seeds'
};
exports.CACHE = {
    TTL: {
        SHORT: 5 * 60,
        MEDIUM: 30 * 60,
        LONG: 24 * 60 * 60,
        VERY_LONG: 7 * 24 * 60 * 60
    },
    KEYS: {
        USER_SESSION: 'user:session:',
        TENANT_CONFIG: 'tenant:config:',
        PERMISSIONS: 'permissions:',
        RATE_LIMIT: 'rate_limit:'
    }
};
exports.RATE_LIMIT = {
    GLOBAL: {
        WINDOW_MS: 15 * 60 * 1000,
        MAX_REQUESTS: 1000
    },
    AUTH: {
        WINDOW_MS: 15 * 60 * 1000,
        MAX_REQUESTS: 10
    },
    API: {
        WINDOW_MS: 15 * 60 * 1000,
        MAX_REQUESTS: 100
    }
};
exports.ERROR_CODES = {
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',
    RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    INVALID_INPUT: 'INVALID_INPUT',
    REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
    TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
    MAINTENANCE_MODE: 'MAINTENANCE_MODE'
};
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};
exports.ERP_MODULES = {
    CRM: 'crm',
    INVENTORY: 'inventory',
    FINANCE: 'finance',
    HR: 'hr',
    PROJECTS: 'projects',
    REPORTS: 'reports',
    SETTINGS: 'settings'
};
exports.PERMISSIONS = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    MANAGE: 'manage',
    EXPORT: 'export',
    IMPORT: 'import'
};
exports.DEFAULT_ROLES = {
    SUPER_ADMIN: 'super_admin',
    TENANT_ADMIN: 'tenant_admin',
    MANAGER: 'manager',
    USER: 'user',
    VIEWER: 'viewer'
};
exports.CURRENCIES = [
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK', 'NZD',
    'MXN', 'SGD', 'HKD', 'NOK', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR', 'KRW'
];
exports.LANGUAGES = [
    'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
];
exports.TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney'
];
//# sourceMappingURL=index.js.map