/**
 * Development authentication utilities
 * Provides fallback authentication for development and testing
 */

export interface DevAuthHeaders {
  'X-User-Id': string;
  'X-User-Email': string;
  'X-User-Name'?: string;
  'X-Tenant-Slug': string;
  'X-Role-Id': string;
}

/**
 * Get default development auth headers
 */
export function getDevAuthHeaders(overrides?: Partial<DevAuthHeaders>): DevAuthHeaders {
  return {
    'X-User-Id': 'dev-user-123',
    'X-User-Email': 'dev@example.com',
    'X-User-Name': 'Development User',
    'X-Tenant-Slug': 'dev-tenant',
    'X-Role-Id': 'admin',
    ...overrides,
  };
}

/**
 * Add development auth headers to a fetch request
 */
export function addDevAuthToFetch(input: RequestInfo | URL, init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  
  const devHeaders = getDevAuthHeaders();
  Object.entries(devHeaders).forEach(([key, value]) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  return {
    ...init,
    headers,
  };
}

/**
 * Create a URL with development auth query parameters
 */
export function addDevAuthToUrl(baseUrl: string, overrides?: Partial<DevAuthHeaders>): string {
  const url = new URL(baseUrl);
  const devHeaders = getDevAuthHeaders(overrides);
  
  Object.entries(devHeaders).forEach(([key, value]) => {
    const queryKey = key.replace('X-', '').toLowerCase();
    url.searchParams.set(queryKey, value);
  });

  return url.toString();
}

/**
 * Development user presets for different roles
 */
export const devUsers = {
  admin: {
    'X-User-Id': 'dev-admin-123',
    'X-User-Email': 'admin@example.com',
    'X-User-Name': 'Development Admin',
    'X-Tenant-Slug': 'dev-tenant',
    'X-Role-Id': 'admin',
  },
  manager: {
    'X-User-Id': 'dev-manager-456',
    'X-User-Email': 'manager@example.com',
    'X-User-Name': 'Development Manager',
    'X-Tenant-Slug': 'dev-tenant',
    'X-Role-Id': 'manager',
  },
  viewer: {
    'X-User-Id': 'dev-viewer-789',
    'X-User-Email': 'viewer@example.com',
    'X-User-Name': 'Development Viewer',
    'X-Tenant-Slug': 'dev-tenant',
    'X-Role-Id': 'viewer',
  },
} as const;
