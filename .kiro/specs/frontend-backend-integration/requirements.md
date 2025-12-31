# Requirements Document

## Introduction

This specification defines the integration between the Next.js frontend application and the NestJS backend API to create a unified, properly architected full-stack application. The current system has duplicate API functionality in the frontend that should be replaced with proper backend integration.

## Glossary

- **Frontend_App**: The Next.js web application in apps/web
- **Backend_API**: The NestJS API application in apps/api  
- **API_Client**: HTTP client service for making requests to the backend
- **Auth_Service**: Frontend service managing authentication state and tokens
- **Route_Handler**: Next.js API route handlers (to be removed/replaced)
- **Component**: React component in the frontend application
- **Middleware**: Next.js middleware for request processing

## Requirements

### Requirement 1: Remove Duplicate API Routes

**User Story:** As a developer, I want to eliminate duplicate API functionality in the frontend, so that the system follows proper separation of concerns.

#### Acceptance Criteria

1. WHEN the frontend needs authentication, THE Frontend_App SHALL call the Backend_API instead of local route handlers
2. WHEN the frontend needs health checks, THE Frontend_App SHALL call the Backend_API instead of local route handlers  
3. THE Frontend_App SHALL remove all duplicate API route handlers from apps/web/src/app/api
4. THE Frontend_App SHALL maintain only proxy or middleware routes if needed for CORS or routing

### Requirement 2: Implement API Client Service

**User Story:** As a developer, I want a centralized API client service, so that all backend communication is consistent and maintainable.

#### Acceptance Criteria

1. THE API_Client SHALL provide methods for all backend endpoints (auth, users, organizations, tenants, health)
2. THE API_Client SHALL handle authentication headers automatically
3. THE API_Client SHALL handle error responses consistently
4. THE API_Client SHALL support request/response interceptors for logging and error handling
5. WHEN making requests, THE API_Client SHALL include proper tenant headers as required by the backend

### Requirement 3: Implement Authentication Integration

**User Story:** As a user, I want seamless authentication between frontend and backend, so that I can securely access the application.

#### Acceptance Criteria

1. WHEN a user logs in, THE Auth_Service SHALL call the Backend_API login endpoint
2. WHEN authentication succeeds, THE Auth_Service SHALL store JWT tokens securely
3. THE Auth_Service SHALL automatically refresh tokens before expiration
4. WHEN tokens expire, THE Auth_Service SHALL redirect users to login
5. THE Auth_Service SHALL provide authentication state to React components
6. WHEN a user logs out, THE Auth_Service SHALL clear stored tokens and call backend logout

### Requirement 4: Create User Interface Components

**User Story:** As a user, I want a proper login interface and dashboard, so that I can interact with the ERP system effectively.

#### Acceptance Criteria

1. THE Frontend_App SHALL provide a login form component with email, password, and tenant selection
2. THE Frontend_App SHALL provide a dashboard layout with navigation and user profile display
3. WHEN login fails, THE Component SHALL display appropriate error messages
4. WHEN login succeeds, THE Component SHALL redirect to the dashboard
5. THE Component SHALL display loading states during API requests
6. THE Component SHALL handle form validation before submitting to the backend

### Requirement 5: Implement Request Middleware

**User Story:** As a developer, I want proper request handling middleware, so that authentication and tenant context work correctly.

#### Acceptance Criteria

1. THE Middleware SHALL extract and validate JWT tokens from requests
2. THE Middleware SHALL add user context to authenticated requests  
3. THE Middleware SHALL handle tenant routing and validation
4. WHEN authentication fails, THE Middleware SHALL redirect to login page
5. THE Middleware SHALL protect dashboard routes from unauthenticated access

### Requirement 6: Environment Configuration

**User Story:** As a developer, I want proper environment configuration, so that the frontend can connect to different backend environments.

#### Acceptance Criteria

1. THE Frontend_App SHALL read backend API URL from environment variables
2. THE Frontend_App SHALL support different configurations for development, staging, and production
3. THE Frontend_App SHALL validate required environment variables on startup
4. WHEN environment variables are missing, THE Frontend_App SHALL display helpful error messages

### Requirement 7: Error Handling and User Feedback

**User Story:** As a user, I want clear feedback when errors occur, so that I understand what went wrong and how to proceed.

#### Acceptance Criteria

1. WHEN API requests fail, THE Frontend_App SHALL display user-friendly error messages
2. THE Frontend_App SHALL handle network errors gracefully with retry options
3. THE Frontend_App SHALL display loading indicators during API requests
4. WHEN validation errors occur, THE Frontend_App SHALL highlight specific form fields
5. THE Frontend_App SHALL log detailed errors for debugging while showing simple messages to users

### Requirement 8: Type Safety and Data Models

**User Story:** As a developer, I want type-safe communication between frontend and backend, so that integration errors are caught at compile time.

#### Acceptance Criteria

1. THE Frontend_App SHALL use TypeScript interfaces matching backend DTOs
2. THE API_Client SHALL provide typed methods for all endpoints
3. THE Frontend_App SHALL validate API responses against expected types
4. WHEN response types don't match, THE Frontend_App SHALL handle the mismatch gracefully
5. THE Frontend_App SHALL share common types with the backend through the shared library