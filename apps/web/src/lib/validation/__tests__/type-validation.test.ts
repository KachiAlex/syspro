/**
 * Property-based tests for Type Validation
 * Feature: frontend-backend-integration, Property 15: API response type validation, Property 16: Type mismatch handling
 */

import { jest } from '@jest/globals';
import { TypeValidator, ValidationError } from '../type-validator';
import { AuthUser, LoginResponse, UserProfile } from '@syspro/shared';

describe('Type Validation - Property Tests', () => {
  let validator: TypeValidator;

  beforeEach(() => {
    validator = new TypeValidator();
  });

  /**
   * Property 15: API response type validation
   * For any API response, the response data should be validated 
   * against the expected TypeScript interface
   * Validates: Requirements 8.3
   */
  describe('Property 15: API response type validation', () => {
    test('should validate correct AuthUser objects', () => {
      const validAuthUsers = [
        {
          id: '123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: true,
          roles: ['user'],
          organizationId: 'org-123',
          tenantId: 'tenant-123',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        {
          id: '456',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          isActive: true,
          roles: ['admin', 'user'],
          organizationId: 'org-456',
          tenantId: 'tenant-456',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      validAuthUsers.forEach(user => {
        const result = validator.validateAuthUser(user);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.data).toEqual(user);
      });
    });

    test('should validate correct LoginResponse objects', () => {
      const validLoginResponses = [
        {
          success: true,
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'refresh-token-123',
            expiresIn: 3600,
            user: {
              id: '123',
              email: 'test@example.com',
              firstName: 'John',
              lastName: 'Doe',
              isActive: true,
              roles: ['user'],
              organizationId: 'org-123',
              tenantId: 'tenant-123',
              createdAt: '2023-01-01T00:00:00Z',
              updatedAt: '2023-01-01T00:00:00Z'
            }
          }
        },
        {
          success: false,
          message: 'Invalid credentials',
          errors: [
            { field: 'email', message: 'Email not found' }
          ]
        }
      ];

      validLoginResponses.forEach(response => {
        const result = validator.validateLoginResponse(response);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('should validate UserProfile objects with optional fields', () => {
      const validProfiles = [
        {
          id: '123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          avatar: 'https://example.com/avatar.jpg',
          timezone: 'UTC',
          language: 'en',
          isActive: true
        },
        {
          id: '456',
          email: 'minimal@example.com',
          firstName: 'Min',
          lastName: 'User',
          isActive: true
          // Optional fields omitted
        }
      ];

      validProfiles.forEach(profile => {
        const result = validator.validateUserProfile(profile);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('should validate arrays of objects', () => {
      const userArray = [
        {
          id: '1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          isActive: true,
          roles: ['user'],
          organizationId: 'org-1',
          tenantId: 'tenant-1',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          isActive: false,
          roles: ['user', 'admin'],
          organizationId: 'org-2',
          tenantId: 'tenant-2',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      const result = validator.validateArray(userArray, 'AuthUser');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(userArray);
    });
  });

  /**
   * Property 16: Type mismatch handling
   * For any API response that doesn't match the expected type, 
   * the system should handle the mismatch gracefully without crashing
   * Validates: Requirements 8.4
   */
  describe('Property 16: Type mismatch handling', () => {
    test('should handle missing required fields gracefully', () => {
      const invalidAuthUsers = [
        { email: 'test@example.com' }, // Missing required fields
        { id: '123' }, // Missing email and other required fields
        {}, // Empty object
        null, // Null value
        undefined, // Undefined value
        'string instead of object', // Wrong type
        123, // Wrong type
        [] // Array instead of object
      ];

      invalidAuthUsers.forEach(invalidUser => {
        const result = validator.validateAuthUser(invalidUser);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.data).toBeNull();
        
        // Should not throw an error
        expect(() => validator.validateAuthUser(invalidUser)).not.toThrow();
      });
    });

    test('should handle incorrect field types gracefully', () => {
      const invalidTypeUsers = [
        {
          id: 123, // Should be string
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          isActive: 'true', // Should be boolean
          roles: 'user', // Should be array
          organizationId: 'org-123',
          tenantId: 'tenant-123',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        },
        {
          id: '123',
          email: null, // Should be string
          firstName: 123, // Should be string
          lastName: [], // Should be string
          isActive: true,
          roles: ['user'],
          organizationId: 'org-123',
          tenantId: 'tenant-123',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      invalidTypeUsers.forEach(user => {
        const result = validator.validateAuthUser(user);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Verify specific field errors are reported
        const fieldErrors = result.errors.map(e => e.field);
        expect(fieldErrors.length).toBeGreaterThan(0);
      });
    });

    test('should handle malformed API responses gracefully', () => {
      const malformedResponses = [
        '{"invalid": json}', // Invalid JSON string
        { success: 'maybe' }, // Invalid success type
        { data: 'should be object' }, // Invalid data type
        { errors: 'should be array' }, // Invalid errors type
        { message: 123 }, // Invalid message type
        Buffer.from('binary data'), // Binary data
        new Date(), // Date object
        /regex/, // RegExp object
      ];

      malformedResponses.forEach(response => {
        expect(() => {
          const result = validator.validateLoginResponse(response);
          expect(result.isValid).toBe(false);
        }).not.toThrow();
      });
    });

    test('should provide detailed error information for debugging', () => {
      const invalidUser = {
        id: 123, // Wrong type
        email: 'invalid-email', // Invalid format
        firstName: '', // Empty string
        isActive: 'yes', // Wrong type
        roles: 'admin', // Wrong type
        // Missing required fields
      };

      const result = validator.validateAuthUser(invalidUser);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check that errors contain useful information
      result.errors.forEach(error => {
        expect(error.field).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.expectedType).toBeDefined();
        expect(error.actualValue).toBeDefined();
      });
    });

    test('should handle nested object validation failures', () => {
      const invalidLoginResponse = {
        success: true,
        data: {
          accessToken: 123, // Should be string
          refreshToken: null, // Should be string
          expiresIn: 'never', // Should be number
          user: {
            id: null, // Should be string
            email: 'invalid-email-format',
            // Missing other required fields
          }
        }
      };

      const result = validator.validateLoginResponse(invalidLoginResponse);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should have errors for nested fields
      const nestedErrors = result.errors.filter(e => e.field.includes('.'));
      expect(nestedErrors.length).toBeGreaterThan(0);
    });

    test('should handle circular references without crashing', () => {
      const circularObject: any = {
        id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        roles: ['user'],
        organizationId: 'org-123',
        tenantId: 'tenant-123',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      };
      
      // Create circular reference
      circularObject.self = circularObject;

      expect(() => {
        const result = validator.validateAuthUser(circularObject);
        // Should handle gracefully, even if validation fails
      }).not.toThrow();
    });

    test('should validate partial objects for updates', () => {
      const partialUpdates = [
        { firstName: 'Updated' },
        { lastName: 'NewLastName' },
        { email: 'newemail@example.com' },
        { isActive: false },
        { firstName: 'New', lastName: 'Name' }
      ];

      partialUpdates.forEach(update => {
        const result = validator.validatePartialUserProfile(update);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('should reject invalid partial updates', () => {
      const invalidPartialUpdates = [
        { firstName: 123 }, // Wrong type
        { email: 'invalid-email' }, // Invalid format
        { isActive: 'maybe' }, // Wrong type
        { unknownField: 'value' }, // Unknown field
        {} // Empty update
      ];

      invalidPartialUpdates.forEach(update => {
        const result = validator.validatePartialUserProfile(update);
        if (Object.keys(update).length === 0) {
          // Empty updates might be valid depending on implementation
          return;
        }
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
});