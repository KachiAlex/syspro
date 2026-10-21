export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  createAppointment, createMaster, createNote,
  dealCompetitors, deleteMaster, linkCompetitorToDeal, listAppointments,
  listCompetitors, listMaster, listNotes, listSms, listTerritories,
  sendSms, updateAppointmentStatus, upsertCompetitor, upsertTerritory,
} from "@/lib/crm/masters";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "crm", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    switch (searchParams.get("view") ?? "territories") {
      case "territories":
        return NextResponse.json({ territories: await listTerritories(context.tenantSlug) });
      case "industries":
        return NextResponse.json({ items: await listMaster(context.tenantSlug, "industries") });
      case "segments":
        return NextResponse.json({ items: await listMaster(context.tenantSlug, "segments") });
      case "competitors":
        return NextResponse.json({ competitors: await listCompetitors(context.tenantSlug) });
      case "deal-competitors":
        return NextResponse.json({ competitors: await dealCompetitors(context.tenantSlug, String(searchParams.get("dealId"))) });
      case "notes":
        return NextResponse.json({ notes: await listNotes(context.tenantSlug, searchParams.get("partyType") ?? undefined, searchParams.get("partyId") ?? undefined) });
      case "appointments":
        return NextResponse.json({ appointments: await listAppointments(context.tenantSlug, searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined) });
      case "sms":
        return NextResponse.json({ messages: await listSms(context.tenantSlug) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("CRM masters read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "crm", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    switch (body.action) {
      case "upsert-territory":
        return NextResponse.json({ territory: await upsertTerritory({
          tenantSlug: context.tenantSlug, id: body.id, name: String(body.name),
          parentId: body.parentId, isGroup: body.isGroup, manager: body.manager,
        }) });
      case "create-master":
        return NextResponse.json({ item: await createMaster(context.tenantSlug, body.kind, String(body.name), body.description) }, { status: 201 });
      case "delete-master":
        await deleteMaster(context.tenantSlug, body.kind, String(body.id));
        return NextResponse.json({ ok: true });
      case "upsert-competitor":
        return NextResponse.json({ competitor: await upsertCompetitor({
          tenantSlug: context.tenantSlug, id: body.id, name: String(body.name),
          website: body.website, strengths: body.strengths,
          weaknesses: body.weaknesses, notes: body.notes,
        }) });
      case "link-competitor":
        return NextResponse.json({ link: await linkCompetitorToDeal(context.tenantSlug, String(body.dealId), String(body.competitorId)) });
      case "create-note":
        return NextResponse.json({ note: await createNote({
          tenantSlug: context.tenantSlug, title: body.title,
          content: String(body.content), partyType: body.partyType,
          partyId: body.partyId, notifyOnLogin: body.notifyOnLogin,
          createdBy: context.userId,
        }) }, { status: 201 });
      case "create-appointment":
        return NextResponse.json({ appointment: await createAppointment({
          tenantSlug: context.tenantSlug, title: String(body.title),
          partyType: body.partyType, partyId: body.partyId,
          scheduledAt: String(body.scheduledAt), durationMinutes: body.durationMinutes,
          attendees: body.attendees, location: body.location, notes: body.notes,
          createdBy: context.userId,
        }) }, { status: 201 });
      case "appointment-status":
        return NextResponse.json({ appointment: await updateAppointmentStatus(context.tenantSlug, String(body.id), String(body.status)) });
      case "send-sms":
        return NextResponse.json({ message: await sendSms({
          tenantSlug: context.tenantSlug, to: String(body.to),
          message: String(body.message), relatedType: body.relatedType,
          relatedId: body.relatedId, sentBy: context.userId,
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /Invalid|required|must|not found/i.test(msg) ? 400 : 500 });
  }
}
