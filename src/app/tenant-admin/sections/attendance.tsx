"use client";

import React from "react";
import useAttendanceData from "@/hooks/useAttendanceData";

export default function Attendance({ tenantSlug }: { tenantSlug?: string }) {
  const { data, loading, error } = useAttendanceData({ tenantSlug, action: "today" });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Smart Attendance</h2>
        <p className="text-gray-600">Real-time confidence scoring and attendance signals for your people.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {loading && <p className="text-sm text-gray-500">Loading attendance…</p>}
        {error && <p className="text-sm text-red-600">Error: {error.message}</p>}

        {data && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Today</h3>
              <p className="text-sm text-gray-600">Tenant: {data.tenantSlug}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.items?.map((rec: any) => (
                <div key={rec.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{rec.employeeId}</div>
                      <div className="text-xs text-gray-500">{rec.workDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{rec.attendanceStatus}</div>
                      <div className="text-xs text-gray-500">Confidence: {rec.confidenceScore}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
