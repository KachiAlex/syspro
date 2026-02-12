# Automation Module (initial)

This folder contains a minimal Automation Module prototype:

- `types.ts` — TypeScript types for automations, rules, and events.
- `event-bus.ts` — Small in-memory event bus (Node EventEmitter).
- `rule-engine.ts` — In-memory rule engine skeleton.
- `engine-start.ts` — Bootstraps a sample rule and starts the engine.

Quick start:

1. Run migrations:

```bash
node ./scripts/run-migrations-with-url.js "$DATABASE_URL"
```

2. Seed sample automation (local DB):

```bash
DATABASE_URL="$DATABASE_URL" node ./scripts/seed-automation.js
```

3. Start the frontend dev server. The engine starter is imported in the app layout
   and will register a sample rule and subscribe to events.

To publish events to the engine, POST to the automation API endpoint:

```
POST /api/automation
{ "type": "vendor.created", "payload": { ... } }
```

Next steps: load rules from the DB, add durable event ingestion, action handlers (webhooks/email),
and persistence for runs/logs.
