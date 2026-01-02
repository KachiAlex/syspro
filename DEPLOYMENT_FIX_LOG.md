# Deployment Fix Log

## Issue: Workspace Dependencies Not Supported by Vercel

**Error**: `Couldn't find package "@syspro/shared@workspace:*" required by "@syspro/web@1.0.0" on the "npm" registry.`

## Root Cause
Vercel's build environment doesn't support the `workspace:*` protocol used by modern package managers like Yarn and pnpm for monorepo workspace dependencies.

## Solution Applied

### 1. Removed Workspace Dependency
- Removed `"@syspro/shared": "workspace:*"` from `apps/web/package.json`

### 2. Fixed Duplicate eslint-config-next
- Removed duplicate `eslint-config-next` entry in devDependencies

### 3. Inlined Shared Types
- Created `apps/web/src/lib/types/shared.ts` with all necessary shared types
- Updated all imports from `@syspro/shared` to use local types:
  - `apps/web/src/lib/api/client.ts`
  - `apps/web/src/lib/auth/auth-service.ts`
  - `apps/web/src/lib/api/http-client.ts`
  - `apps/web/src/components/layout/dashboard-layout.tsx`
  - `apps/web/src/lib/validation/__tests__/type-validation.test.ts`
  - `apps/web/src/contexts/auth-context.tsx`
  - `apps/web/src/lib/auth/token-storage.ts`

## Issue: TypeScript Compilation Error - Axios Module Not Found

**Error**: `Cannot find module 'axios' or its corresponding type declarations.`

## Root Cause
In monorepo setups with Vercel, dependencies need to be available at the root level for proper module resolution during build.

## Solution Applied

### 4. Added Axios to Root Dependencies
- Added `"axios": "^1.6.2"` to root `package.json` dependencies
- This ensures axios is available during Vercel's build process

## Files Modified
- `apps/web/package.json` - Removed workspace dependency and duplicate eslint config
- `apps/web/src/lib/types/shared.ts` - Created with inlined shared types
- `package.json` - Added axios dependency at root level
- Multiple TypeScript files - Updated imports to use local types

## Expected Result
The Vercel deployment should now succeed because:
1. No workspace dependencies that Vercel can't resolve
2. All required types are available locally in the web app
3. No duplicate package.json entries
4. Axios is available at root level for proper module resolution

## Future Improvement
Consider configuring Vercel to properly handle workspace dependencies or using a build step that resolves workspace dependencies before deployment.