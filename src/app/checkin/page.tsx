"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, CheckCircle, AlertCircle, QrCode } from "lucide-react";

function CheckInFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("t");
  const [state, setState] = useState<"init" | "locating" | "submitting" | "done" | "error">("init");
  const [message, setMessage] = useState("");
  const [flagged, setFlagged] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No QR token found. Scan the QR code at your office.");
      return;
    }

    let cancelled = false;

    const run = async () => {
      setState("locating");
      const location = await new Promise<{ latitude: number; longitude: number; accuracy: number } | null>((resolve) => {
        if (!("geolocation" in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
        );
      });
      if (cancelled) return;

      setState("submitting");
      const res = await fetch("/api/hr/employees/portal/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_in",
          qrToken: token,
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;

      if (res.status === 401) {
        router.push(`/employee/login?redirect=${encodeURIComponent(`/checkin?t=${token}`)}`);
        return;
      }
      if (!res.ok) {
        setState("error");
        setMessage(data.error || "Check-in failed");
        return;
      }
      setFlagged(data.flagReason || null);
      setState("done");
      setMessage("Checked in successfully!");
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-sm w-full text-center">
        <QrCode className="w-10 h-10 text-blue-600 mx-auto mb-4" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">Office Check-in</h1>

        {(state === "init" || state === "locating" || state === "submitting") && (
          <div className="py-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              {state === "locating" ? "Getting your location..." : state === "submitting" ? "Verifying QR and location..." : "Preparing..."}
            </p>
            <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" /> Allow location access when prompted
            </p>
          </div>
        )}

        {state === "done" && (
          <div className="py-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-green-700">{message}</p>
            {flagged && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                Note: {flagged}. Your manager may review this.
              </p>
            )}
            <button
              onClick={() => router.push("/employee/dashboard")}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="py-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-red-700">{message}</p>
            <button
              onClick={() => router.push("/employee/dashboard")}
              className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <CheckInFlow />
    </Suspense>
  );
}
