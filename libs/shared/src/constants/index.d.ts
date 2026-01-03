export declare const APP_CONFIG: {
    readonly NAME: "Syspro ERP";
    readonly VERSION: "1.0.0";
    readonly DESCRIPTION: "Production-grade multi-tenant ERP system";
    readonly SUPPORT_EMAIL: "support@syspro.com";
    readonly COMPANY: "Syscomptech & Subsidiaries";
};
export declare const API_CONFIG: {
    readonly VERSION: "v1";
    readonly PREFIX: "/api/v1";
    readonly TIMEOUT: 30000;
    readonly MAX_FILE_SIZE: number;
    readonly SUPPORTED_FILE_TYPES: readonly ["image/jpeg", "image/png", "image/gif", "application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
};
export declare const AUTH_CONFIG: {
    readonly JWT_EXPIRES_IN: "24h";
    readonly REFRESH_TOKEN_EXPIRES_IN: "7d";
    readonly PASSWORD_MIN_LENGTH: 8;
    readonly PASSWORD_RESET_EXPIRES_IN: "1h";
    readonly MAX_LOGIN_ATTEMPTS: 5;
    readonly LOCKOUT_DURATION: number;
    readonly SESSION_TIMEOUT: number;
};
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
    readonly MIN_LIMIT: 1;
};
export declare const VALIDATION: {
    readonly EMAIL_REGEX: RegExp;
    readonly PHONE_REGEX: RegExp;
    readonly TENANT_CODE_REGEX: RegExp;
    readonly PASSWORD_REGEX: RegExp;
};
export declare const DATABASE: {
    readonly MAX_CONNECTIONS: 100;
    readonly CONNECTION_TIMEOUT: 60000;
    readonly QUERY_TIMEOUT: 30000;
    readonly MIGRATION_TABLE: "migrations";
    readonly SEED_TABLE: "seeds";
};
export declare const CACHE: {
    readonly TTL: {
        readonly SHORT: number;
        readonly MEDIUM: number;
        readonly LONG: number;
        readonly VERY_LONG: number;
    };
    readonly KEYS: {
        readonly USER_SESSION: "user:session:";
        readonly TENANT_CONFIG: "tenant:config:";
        readonly PERMISSIONS: "permissions:";
        readonly RATE_LIMIT: "rate_limit:";
    };
};
export declare const RATE_LIMIT: {
    readonly GLOBAL: {
        readonly WINDOW_MS: number;
        readonly MAX_REQUESTS: 1000;
    };
    readonly AUTH: {
        readonly WINDOW_MS: number;
        readonly MAX_REQUESTS: 10;
    };
    readonly API: {
        readonly WINDOW_MS: number;
        readonly MAX_REQUESTS: 100;
    };
};
export declare const ERROR_CODES: {
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly TOKEN_INVALID: "TOKEN_INVALID";
    readonly ACCOUNT_LOCKED: "ACCOUNT_LOCKED";
    readonly ACCOUNT_DISABLED: "ACCOUNT_DISABLED";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly TENANT_ACCESS_DENIED: "TENANT_ACCESS_DENIED";
    readonly RESOURCE_ACCESS_DENIED: "RESOURCE_ACCESS_DENIED";
    readonly VALIDATION_FAILED: "VALIDATION_FAILED";
    readonly DUPLICATE_ENTRY: "DUPLICATE_ENTRY";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly REQUIRED_FIELD_MISSING: "REQUIRED_FIELD_MISSING";
    readonly TENANT_NOT_FOUND: "TENANT_NOT_FOUND";
    readonly USER_NOT_FOUND: "USER_NOT_FOUND";
    readonly RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
    readonly OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED";
    readonly QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    readonly INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
    readonly MAINTENANCE_MODE: "MAINTENANCE_MODE";
};
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE_ENTITY: 422;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const ERP_MODULES: {
    readonly CRM: "crm";
    readonly INVENTORY: "inventory";
    readonly FINANCE: "finance";
    readonly HR: "hr";
    readonly PROJECTS: "projects";
    readonly REPORTS: "reports";
    readonly SETTINGS: "settings";
};
export declare const PERMISSIONS: {
    readonly CREATE: "create";
    readonly READ: "read";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly MANAGE: "manage";
    readonly EXPORT: "export";
    readonly IMPORT: "import";
};
export declare const DEFAULT_ROLES: {
    readonly SUPER_ADMIN: "super_admin";
    readonly TENANT_ADMIN: "tenant_admin";
    readonly MANAGER: "manager";
    readonly USER: "user";
    readonly VIEWER: "viewer";
};
export declare const CURRENCIES: readonly ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "SEK", "NZD", "MXN", "SGD", "HKD", "NOK", "TRY", "RUB", "INR", "BRL", "ZAR", "KRW"];
export declare const LANGUAGES: readonly ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar", "hi"];
export declare const TIMEZONES: readonly ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney"];
//# sourceMappingURL=index.d.ts.map