// Server-side bootstrap: start the DB-backed automation rule engine once per
// process. Imported by the app layout so the engine is live whenever the
// server is running.
import { startRuleEngine } from "./rule-engine";

if (typeof window === "undefined") {
  const g = global as any;
  if (!g.__pisairtel_automation_engine_started) {
    g.__pisairtel_automation_engine_started = true;
    try {
      startRuleEngine();
      // eslint-disable-next-line no-console
      console.info("pisairtel-frontend: automation rule engine started");
    } catch {
      // engine start is best-effort — failures must not break app startup
    }
  }
}

export {};
