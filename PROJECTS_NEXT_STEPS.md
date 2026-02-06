# Project Module Next Steps

1. **Data models + migrations**
   - Port the new in-memory entities (`projects`, `workstreams`, `tasks`, `task_assignments`, `time_logs`, `capacity_snapshots`, `skills`) to SQL migrations with tenant/department/branch scoping and audit columns.
   - Wire finance linkage by storing `project_id` on budget lines and invoice/billables tables.

2. **API hardening**
   - Extend `/api/projects`, `/api/projects/workstreams`, `/api/projects/tasks`, `/api/projects/assignments`, `/api/projects/capacity`, and `/api/projects/time-entries` to read/write from the database and support pagination plus PATCH/DELETE verbs.
   - Add approval + status transition endpoints (e.g., `/api/projects/{id}/approve`, `/api/projects/{id}/status`).

3. **Smart assignment + capacity services**
   - Expand `src/lib/project-fit.ts` to ingest live attendance/utilization metrics and push rebalancing actions.
   - Schedule a background job (queue/cron) that recalculates utilization, predicts delay risk, and emits automation alerts.

4. **Integration hooks**
   - Attendance: replace placeholder fetch with a durable event (queue/webhook) carrying contribution weight + timestamps.
   - Performance: persist contribution deltas for HR review and surface them in the performance module.
   - Finance: sync approved budgets/spend to accounting ledgers; expose billable hours to the invoices API.

5. **Role-based access + audit**
   - Extend policy middleware to check Employee/Dept Head/PM/HR roles per route.
   - Store assignment overrides with justification, capacity snapshot, approver id, and surface them in an audit feed.

6. **Testing + telemetry**
   - Add Vitest coverage for the new API handlers, `project-fit` scoring, and capacity math.
   - Provide Playwright smoke covering the Project tab flows (filters, Kanban interactions, smart assignment drawer).
   - Emit structured logs/events for automation actions (duration, impacted department, next action).
