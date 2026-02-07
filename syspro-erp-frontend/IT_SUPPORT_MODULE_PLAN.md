# IT Support Module Implementation Plan

## 1. Purpose & Placement
- Lives inside the tenant-admin workspace as a dedicated "IT Support" navigation section alongside CRM/Finance/Projects.
- Shares tenant, region, department, attendance, and finance data that tenant-admin already owns.
- Focuses on Incident → Diagnosis → Resolution → Learning loop with full traceability.

## 2. Core Capabilities
1. **Ticket Orchestration**
   - Ticket types: `internal` vs `customer` with impact level, priority, SLA category.
   - Lifecycle: New → Acknowledged → Diagnosing → In Progress → Awaiting Customer/Dependency → Resolved → Closed → Reopened.
   - Capture timestamps for each stage, auto-calc time-in-stage, aging, SLA status.

2. **SLA / Priority Engine**
   - SLA catalog per tenant (e.g., Critical: response 15 min, resolve 2 hrs).
   - Engine maintains countdown timers, breach predictions, escalations (Senior Engineer → HOD → Ops Manager).
   - Auto-notifications through notification service.

3. **Assignment Intelligence**
   - Inputs: engineer skills, certifications, branch, on-duty (attendance), open workload, past performance.
   - Outputs: primary engineer, backup engineer, override log w/ reason + approving manager.

4. **Field Dispatch**
   - Field job entity linked to ticket.
   - GPS tagging, travel + arrival confirmation, work logs (before/after), media uploads, customer sign-off.
   - Feeds attendance (on-site hours), payroll (field allowance), project costing (billable time).

5. **Monitoring & Incident Hooks**
   - API endpoints to ingest incidents from NMS, ISP logs, system monitors.
   - Auto-creates/updates tickets, displays uptime metrics + incident feed in dashboard.

6. **Knowledge Loop**
   - When a ticket resolves, prompt to create/update Knowledge Base Article (KBA).
   - Tag KBAs by ticket type, service, root cause. Suggest KBAs during diagnosis.

7. **Dashboards**
   - **Agent View**: assigned queue, SLA timers, escalations, KB suggestions.
   - **Manager View**: volume trends, SLA compliance, engineer performance, bottlenecks.
   - **Exec View**: uptime, incident frequency, SLA breaches, downtime cost.

## 3. Data Model Additions
| Entity | Key Fields |
| --- | --- |
| `tickets` | tenantId, type, impact, priority, slaId, lifecycle timestamps, departmentId, serviceId, regionId, source (erp/crm/email/api/mobile), createdBy, assignedEngineerId, status, rootCauseId |
| `ticket_comments` | ticketId, message, authorId, attachments |
| `ticket_activity_logs` | ticketId, action, actorId, metadata, timestamp |
| `sla_policies` | tenantId, priority, responseWithinMinutes, resolveWithinMinutes, escalationRules |
| `engineer_profiles` | employeeId, skills, certifications, branchId, onDuty, openTicketCount, performanceScore |
| `field_jobs` | ticketId, engineerId, location, gpsTrail, arrivalTime, completionTime, customerSignoff, workLogs |
| `incidents` | sourceSystem, severity, startTime, endTime, affectedServices, linkedTicketId |
| `knowledge_base_articles` | tenantId, category, title, content, relatedTicketIds, effectivenessScore |

## 4. API Surface (Next.js App Router Routes)
```
POST   /api/support/tickets           # create ticket from any source
GET    /api/support/tickets           # filtered list (type, status, SLA, region, etc.)
GET    /api/support/tickets/[id]
PATCH  /api/support/tickets/[id]      # status transitions, assignment overrides
POST   /api/support/tickets/[id]/comments
POST   /api/support/tickets/[id]/activities
POST   /api/support/tickets/[id]/field-jobs
POST   /api/support/incidents         # monitoring hook
GET    /api/support/incidents
POST   /api/support/sla               # manage SLA catalog per tenant
GET    /api/support/sla
POST   /api/support/assign            # assignment engine endpoint
POST   /api/support/knowledge-base    # create/update KB articles
GET    /api/support/dashboard/metrics # aggregated stats for dashboards
```
- Reuse existing `attendance`, `projects`, `finance` services via internal SDK/helpers (no duplication).

## 5. Tenant-Admin UI Integration
1. **Navigation** – Add “IT Support” entry in `NAVIGATION` with workspace similar to CRM/Finance.
2. **Workspace Layout**
   - Primary tabs: `Tickets`, `Incidents`, `Dispatch`, `Knowledge`, `Analytics`.
   - Ticket board with lifecycle swimlanes + SLA timers; filters for type/impact/region.
   - Assignment drawer showing recommended engineer, backup, override action.
   - Dispatch tab listing active field jobs w/ map snapshots.
   - Knowledge tab showing suggested KBAs, article effectiveness, gaps.
   - Analytics tab for managers/executives (charts for SLA compliance, downtime cost, engineer performance).
3. **Quick Actions**
   - “Log Incident”, “Dispatch Engineer”, “Escalate SLA”, “Publish KB Update”.

## 6. Automation Hooks
- **Auto Escalation**: scheduled job checks SLA timers, updates ticket status, triggers notifications.
- **Repeat Issue Detection**: cluster tickets by root cause/service + feed into analytics.
- **Root Cause Clustering**: integrate with existing analytics service or placeholder for ML pipeline.
- **Assignment Balancer**: watch engineer workload every few minutes; reassign when load > threshold.

## 7. Dependencies & Reuse
- **Attendance**: use `/api/hr/attendance` to know on-duty/on-site status.
- **Projects**: link long-running fixes to project budgets/time entries.
- **Finance**: expose billable support or downtime cost to CFO dashboards.
- **Notifications**: reuse notification service (email/SMS/Slack) for SLA alerts, field arrival, customer updates.

## 8. Implementation Phases
1. **Data + APIs** (tickets, SLA, assignment, dispatch, incidents, KB) with Prisma/postgres migrations.
2. **Tenant-Admin Workspace** (UI scaffolding, loading states, filters, timeline components).
3. **Assignment & SLA Engines** (cron/scheduled jobs, predictive breach warnings).
4. **Field Dispatch Enhancements** (GPS capture, media uploads, customer sign-off UI).
5. **Knowledge Loop** (post-resolution prompts, KB creation, suggestion panel).
6. **Monitoring Integrations** (webhook ingestion, dashboard cards, incident linking).

## 9. Items to Defer/Discard
- Do not build a bare ticket list; always show lifecycle context.
- Do not create a standalone monitoring stack; rely on ingesting signals via API hooks.
- Avoid manual assignment as default; keep override only for exceptions with log entry.

## 10. Next Steps
1. Create Prisma models & migrations for the new entities.
2. Scaffold `/api/support/*` routes with validation + multi-tenant guards.
3. Add `IT Support` workspace in tenant-admin UI with placeholder components.
4. Wire assignment engine to attendance + HR data.
5. Implement SLA timers + escalation notifications.
6. Build field job logging UI + API, integrate with attendance feeds.
7. Add knowledge base creation prompts + article storage.
8. Layer analytics components into dashboard tabs.
