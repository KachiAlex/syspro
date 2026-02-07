# IT Support Test Plan

This checklist validates the end-to-end IT Support workspace using the mock service layer shipped under `src/lib/support-data.ts`.

## Prerequisites
- Dev server running locally: `npm run dev`
- Browser pointed to `/tenant-admin?tenantSlug=kreatix-default`

## Smoke Path
1. **Open Workspace**
   - Navigate to **IT & Support** from the tenant-admin sidebar.
   - Validate that the ticket board, SLA radar, incidents, and assignment cards render without errors.
2. **Create Ticket**
   - Click **New ticket**, populate title/description, leave defaults for impact/priority, and submit.
   - Confirm the new ticket appears at the top of the board and the ticket count statistic increments.
3. **Inspect Detail Panel**
   - Select the new ticket.
   - Verify priority/status chips, SLA countdown, region/service labels, timeline, and empty states load.
4. **Comment + Status Update**
   - Add an internal note; it should prepend to the collaboration list.
   - Change status to **In progress** and confirm the chip and activity timeline update.
5. **Dispatch Field Crew**
   - Click **Dispatch field crew**; a new field job card should appear with scheduled time and engineer ID.
6. **Validate Metrics**
   - Open tickets/critical counts reflect the new ticket’s status.
   - SLA radar lists any at-risk tickets; dashboard cards remain responsive.
7. **Resilience Check**
   - Trigger a dev server restart (Fast Refresh) and ensure the workspace gracefully reloads; no stuck “Ticket not found” errors.

## API Spot Checks
Use REST client or Thunder Client to hit:
- `GET /api/support/tickets?tenantSlug=kreatix-default`
- `POST /api/support/tickets` with a minimal payload
- `GET /api/support/tickets/{id}/comments`
- `POST /api/support/tickets/{id}/comments`
- `POST /api/support/tickets/{id}` to change status

All responses should be HTTP 2xx with structured JSON matching the helper definitions.

## Automated Coverage
- Run `npm run test:it-support` to execute the Vitest suite targeting `src/__tests__/it-support.test.ts`.
- Tests validate ticket creation, timeline updates, field dispatches, dashboard metrics, and assignment suggestions emitted by `src/lib/support-data.ts`.
- Treat passing results as a gate before manual smoke checks to ensure helpers remain stable.

## Exit Criteria
- All smoke steps succeed without console errors.
- API spot checks return expected payloads.
- UI reflects ticket/comment/dispatch mutations in real time without manual refresh.
