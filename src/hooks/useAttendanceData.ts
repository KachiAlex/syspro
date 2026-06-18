"use client";

import { useEffect, useState } from "react";

export default function useAttendanceData(opts?: { tenantSlug?: string; action?: string }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const tenantSlug = opts?.tenantSlug;
    const action = opts?.action || "today";

    if (!tenantSlug) {
      setLoading(false);
      setError(new Error("tenantSlug is required"));
      return;
    }

    setLoading(true);
    fetch(`/api/attendance?action=${encodeURIComponent(action)}&tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.ok) setData(json.data);
        else setError(new Error(json?.error || "Unknown"));
      })
      .catch((err) => mounted && setError(err))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [opts?.tenantSlug, opts?.action]);

  return { data, loading, error };
}
