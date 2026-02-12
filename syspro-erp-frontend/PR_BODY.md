Chore: fix TypeScript errors (tenant-admin + lib typing fixes)

Summary
- Fixes a large set of TypeScript errors across tenant-admin and several backend libraries.
- Adds RevOps scaffolding: DB migration, backend types & service, API route stubs, and frontend RevOps workspace.
- Adds CI workflow to run TypeScript check, Next build and tests.

Key files
- db/migrations/20260212_10_create_revops_tables.sql
- src/lib/revops/types.ts
- src/lib/revops/service.ts
- src/app/api/revops/** (route stubs)
- syspro-erp-frontend/src/app/tenant-admin/sections/revops-workspace.tsx
- .github/workflows/ci.yml

Verification steps taken
- `npx tsc --noEmit` completed with no TypeScript errors.
- `cd syspro-erp-frontend && npm run build`  Next build succeeded.
- `npm run test:run` (frontend)  vitest tests passed locally.

Notes for reviewers
- Review RevOps scaffolding for design/DB shape and read-only assumptions regarding CRM integration.
- Remaining technical debt: implement attribution/forecasting, and replace remaining pragmatic `any` uses in finance modules.

How to test locally
- From repo root:
  npm install
  npx tsc --noEmit
  cd syspro-erp-frontend
  npm install
  npm run build
  npm run test:run

If the GitHub CLI isn't available, please create the PR manually with the above title/body.
