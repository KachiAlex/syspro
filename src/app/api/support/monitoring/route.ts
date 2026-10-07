export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { listIncidents, listTickets } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "itsupport", "read");
  if (_gate1) return _gate1;
  const tenantSlug = context.tenantSlug;

  const [incidents, tickets] = await Promise.all([
    listIncidents(tenantSlug),
    listTickets(tenantSlug),
  ]);

  const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "monitoring");
  const outages = openIncidents.filter((i) => i.severity === "critical").length;
  const resolved = incidents.filter((i) => i.status === "resolved" || i.status === "closed").length;

  // Uptime approximation: share of incidents that are not currently open
  const uptime = incidents.length === 0
    ? 100
    : Math.round(((incidents.length - openIncidents.length) / incidents.length) * 1000) / 10;

  const lastIncident = [...incidents]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())[0];

  return NextResponse.json({
    data: {
      uptime,
      outages,
      incidents: incidents.length,
      openIncidents: openIncidents.length,
      resolvedIncidents: resolved,
      openTickets: tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length,
      lastIncident: lastIncident
        ? {
            id: lastIncident.id,
            detectedAt: lastIncident.detectedAt,
            resolvedAt: lastIncident.resolvedAt,
            description: lastIncident.summary ?? lastIncident.incidentType ?? "Incident",
            severity: lastIncident.severity,
            status: lastIncident.status,
          }
        : undefined,
    },
  });
}
