/**
 * Token storage utility for secure JWT token management
 * Handles storage and retrieval of authentication tokens
 */

import { AuthTokens } from '@syspro/shared';

// Storage keys
const ACCESS_TOKEN_KEY = 'syspro_access_token';
const REFRESH_TOKEN_KEY = 'syspro_refresh_token';
const TOKEN_EXPIRY_KEY = 'syspro_token_expiry';
const USER_DATA_KEY = 'syspro_user_data';

/**
 * Token storage interface
 */
export interface TokenStorage {
  setTokens(tokens: AuthTokens): void;
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  getTokenExpiry(): number | null;
  clearTokens(): void;
  isTokenExpired(): boolean;
  isTokenExpiringSoon(thresholdMinutes?: number): boolean;
}

/**
 * Browser-based token storage using localStorage
 * Falls back to memory storage if localStorage is not available
 */
class BrowserTokenStorage implements TokenStorage {
  private memoryStorage: Map<string, string> = new Map();
  private isLocalStorageAvailable: boolean;

  constructor() {
    this.isLocalStorageAvailable = this.checkLocalStorageAvailability();
  }

  /**
   * Check if localStorage is available
   */
  private checkLocalStorageAvailability(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set an item in storage
   */
  private setItem(key: string, value: string): void {
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('Failed to store in localStorage, falling back to memory:', error);
        this.memoryStorage.set(key, value);
      }
    } else {
      this.memoryStorage.set(key, value);
    }
  }

  /**
   * Get an item from storage
   */
  private getItem(key: string): string | null {
    if (this.isLocalStorageAvailable) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn('Failed to read from localStorage, falling back to memory:', error);
        return this.memoryStorage.get(key) || null;
      }
    } else {
      return this.memoryStorage.get(key) || null;
    }
  }

  /**
   * Remove an item from storage
   */
  private removeItem(key: string): void {
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Failed to remove from localStorage:', error);
      }
    }
    this.memoryStorage.delete(key);
  }

  /**
   * Store authentication tokens
   */
  setTokens(tokens: AuthTokens): void {
    this.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    this.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    
    // Calculate and store expiry time
    const expiryTime = Date.now() + (tokens.expiresIn * 1000);
    this.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  /**
   * Get the access token
   */
  getAccessToken(): string | null {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  /**
   * Get the refresh token
   */
  getRefreshToken(): string | null {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * Get the token expiry timestamp
   */
  getTokenExpiry(): number | null {
    const expiry = this.getItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    this.removeItem(ACCESS_TOKEN_KEY);
    this.removeItem(REFRESH_TOKEN_KEY);
    this.removeItem(TOKEN_EXPIRY_KEY);
    this.removeItem(USER_DATA_KEY);
  }

  /**
   * Check if the current token is expired
   */
  isTokenExpired(): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;
    
    return Date.now() >= expiry;
  }

  /**
   * Check if the token is expiring soon
   * @param thresholdMinutes - Minutes before expiry to consider "expiring soon" (default: 5)
   */
  isTokenExpiringSoon(thresholdMinutes: number = 5): boolean {
    const expiry = this.getTokenExpiry();
    if (!expiry) return true;
    
    const thresholdMs = thresholdMinutes * 60 * 1000;
    return Date.now() >= (expiry - thresholdMs);
  }

  /**
   * Store user data
   */
  setUserData(userData: any): void {
    this.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }

  /**
   * Get stored user data
   */
  getUserData(): any | null {
    const data = this.getItem(USER_DATA_KEY);
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to parse stored user data:', error);
      return null;
    }
  }
}

/**
 * Server-side token storage (no-op for SSR compatibility)
 */
class ServerTokenStorage implements TokenStorage {
  setTokens(tokens: AuthTokens): void {
    // No-op on server side
  }

  getAccessToken(): string | null {
    return null;
  }

  getRefreshToken(): string | null {
    return null;
  }

  getTokenExpiry(): number | null {
    return null;
  }

  clearTokens(): void {
    // No-op on server side
  }

  isTokenExpired(): boolean {
    return true;
  }

  isTokenExpiringSoon(): boolean {
    return true;
  }
}

/**
 * Create the appropriate token storage based on environment
 */
function createTokenStorage(): TokenStorage {
  if (typeof window === 'undefined') {
    return new ServerTokenStorage();
  }
  return new BrowserTokenStorage();
}

// Export the singleton instance
export const tokenStorage = createTokenStorage();