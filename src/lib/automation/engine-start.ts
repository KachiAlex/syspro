// Frontend-local no-op engine starter to satisfy layout imports during build.
if (typeof window === "undefined") {
  const g = global as any;
  if (!g.__pisairtel_automation_engine_started) {
    g.__pisairtel_automation_engine_started = true;
    try {
      // Minimal log for server startup in the frontend package
      // eslint-disable-next-line no-console
      console.info("pisairtel-frontend: automation engine stub initialized");
    } catch (e) {
      // ignore
    }
  }
}

export {};
