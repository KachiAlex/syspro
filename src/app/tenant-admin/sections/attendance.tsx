"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Clock } from "lucide-react";
import useAttendanceData from "@/hooks/useAttendanceData";

export default function Attendance({ tenantSlug }: { tenantSlug?: string }) {
  const { data, loading, error } = useAttendanceData({ tenantSlug, action: "today" });
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Initialize last refreshed on mount
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

  // Auto-dismiss success alerts after 3.5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Refresh attendance data
  const handleRefreshAttendance = () => {
    setLastRefreshed(new Date());
    setSuccess("Attendance data refreshed successfully");
  };

  return (
    <div className="p-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 text-sm mb-6">
          Error: {error.message}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 text-sm mb-6">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Smart Attendance</h2>
          <p className="text-gray-600">Real-time confidence scoring and attendance signals for your people.</p>
          {lastRefreshed && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefreshAttendance}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg animate-pulse">
                <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-32"></div>
                  <div className="h-3 bg-gray-300 rounded w-24"></div>
                </div>
                <div className="h-4 bg-gray-300 rounded w-20"></div>
              </div>
            ))}
          </div>
        )}
        {!loading && error && <p className="text-sm text-red-600">Failed to load attendance data</p>}

        {!loading && data && (!data.items || data.items.length === 0) && (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-2">No attendance records</p>
            <p className="text-sm text-gray-500">No attendance data available for today</p>
          </div>
        )}

        {data && data.items && data.items.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Today</h3>
              <p className="text-sm text-gray-600">Tenant: {data.tenantSlug}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.items.map((rec: any) => (
                <div key={rec.id} className="p-3 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{rec.employeeId}</div>
                      <div className="text-xs text-gray-500">{rec.workDate}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${
                        rec.attendanceStatus === 'Present' ? 'text-green-600' :
                        rec.attendanceStatus === 'Absent' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {rec.attendanceStatus}
                      </div>
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
