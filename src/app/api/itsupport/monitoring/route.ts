import { NextResponse } from 'next/server';

// Simulated monitoring data for dashboard hooks
const monitoringData = {
  uptime: 99.98,
  outages: 2,
  incidents: 5,
  lastIncident: {
    id: 'incident-123',
    detectedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    resolvedAt: null,
    description: 'Network degradation in Region A',
    severity: 'high',
  },
  metrics: [
    { timestamp: Date.now() - 3600 * 1000 * 4, uptime: 99.99 },
    { timestamp: Date.now() - 3600 * 1000 * 3, uptime: 99.97 },
    { timestamp: Date.now() - 3600 * 1000 * 2, uptime: 99.98 },
    { timestamp: Date.now() - 3600 * 1000, uptime: 99.98 },
    { timestamp: Date.now(), uptime: 99.98 },
  ],
};

export async function GET() {
  // Return simulated monitoring dashboard data
  return NextResponse.json({ data: monitoringData });
}
